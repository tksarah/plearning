const DEFAULT_OPENAI_API_BASE = "https://api.openai.com/v1";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

function normalizeModelList(models) {
  return models
    .map((model) => model.trim())
    .filter(Boolean);
}

function isGeminiConfigured(env) {
  return Boolean(
    env.GEMINI_API_KEY ||
      env.GEMINI_MODEL ||
      String(env.OPENAI_API_BASE || "").includes("generativelanguage.googleapis.com")
  );
}

function getDefaultModel(env) {
  if (env.OPENAI_MODEL) {
    return env.OPENAI_MODEL.trim();
  }

  if (env.GEMINI_MODEL) {
    return env.GEMINI_MODEL.trim();
  }

  return isGeminiConfigured(env) ? DEFAULT_GEMINI_MODEL : DEFAULT_OPENAI_MODEL;
}

export function getConfiguredProvider(env = process.env) {
  return isGeminiConfigured(env) ? "gemini" : "openai";
}

export function getConfiguredModels(env) {
  const defaultModel = getDefaultModel(env);
  if (!isModelSwitchEnabled(env)) {
    return [defaultModel];
  }

  const configured = normalizeModelList((env.ALLOWED_MODELS || defaultModel).split(","));
  return configured.length > 0 ? configured : [defaultModel];
}

export function isModelSwitchEnabled(env) {
  return String(env.ENABLE_MODEL_SWITCH || "false").toLowerCase() === "true";
}

export function resolveModel(env, requestedModel) {
  const models = getConfiguredModels(env);
  if (!isModelSwitchEnabled(env)) {
    return models[0];
  }

  if (requestedModel && models.includes(requestedModel)) {
    return requestedModel;
  }

  return models[0];
}

export function isMockMode(env) {
  return String(env.USE_MOCK_LLM || "false").toLowerCase() === "true";
}

export function createMockReply(messages) {
  const latest = messages[messages.length - 1]?.content || "";
  return [
    "これはモック応答です。実際のAPIキーを使うと、入力プロンプトに沿った回答がここに表示されます。",
    "",
    "入力の要点:",
    latest.slice(0, 500)
  ].join("\n");
}

function toOpenAIMessages(messages) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content
  }));
}

export async function generateReply({
  env,
  messages,
  model,
  temperature = 0.4,
  responseFormat = null
}) {
  if (isMockMode(env)) {
    return createMockReply(messages);
  }

  const apiKey = env.OPENAI_API_KEY || env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY or GEMINI_API_KEY is not set");
  }

  const baseUrl = (
    env.OPENAI_API_BASE ||
    (isGeminiConfigured(env) ? DEFAULT_GEMINI_API_BASE : DEFAULT_OPENAI_API_BASE)
  ).replace(/\/$/, "");
  const body = {
    model,
    messages: toOpenAIMessages(messages),
    temperature
  };

  if (responseFormat) {
    body.response_format = responseFormat;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error("OpenAI response did not contain a reply");
  }

  return reply;
}

import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  generateReply,
  getConfiguredModels,
  getConfiguredProvider,
  isMockMode,
  isModelSwitchEnabled,
  resolveModel
} from "./llmClient.js";
import {
  basicSteps,
  caseStudies,
  getBasicStepById,
  getCaseStudyById,
  getLessonSummaries,
  rubricItems
} from "./lessons.js";

dotenv.config();

const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);
const frontendDir = join(currentDir, "..", "frontend");
const DEFAULT_HISTORY_TTL_MINUTES = 30;
const SESSION_ARCHIVE_LIMIT = 24;
const MAX_PROMPT_LENGTH = 8000;
const MAX_HISTORY_MESSAGE_LENGTH = 4000;

function toPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getRuntimeConfig(env) {
  const historyTtlMinutes = toPositiveNumber(
    env.CHAT_HISTORY_TTL_MINUTES,
    DEFAULT_HISTORY_TTL_MINUTES
  );
  const historyVisibleCount = Math.floor(toPositiveNumber(env.SESSION_HISTORY_VISIBLE_COUNT, 10));
  const provider = getConfiguredProvider(env);
  const models = getConfiguredModels(env);

  return {
    provider,
    models,
    selectedModel: models[0],
    modelSwitchEnabled: isModelSwitchEnabled(env),
    historyTtlMinutes,
    historyVisibleCount,
    mockMode: isMockMode(env)
  };
}

function normalizeOutputFormat(value) {
  return value === "rich" ? "rich" : "plain";
}

function stripMarkdown(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```/g, ""))
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .trim();
}

function normalizeClientId(value) {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

function getHistoryClientId(request) {
  return normalizeClientId(request.query?.clientId) || normalizeClientId(request.body?.clientId);
}

function sanitizeHistoryMessage(message) {
  if (!message || typeof message !== "object") {
    return null;
  }

  const role = typeof message.role === "string" ? message.role : "";
  if (!["user", "assistant", "system"].includes(role)) {
    return null;
  }

  const content = typeof message.content === "string" ? message.content : "";
  if (!content.trim()) {
    return null;
  }

  return {
    role,
    content: content.slice(0, MAX_HISTORY_MESSAGE_LENGTH),
    ...(typeof message.outputFormat === "string"
      ? { outputFormat: normalizeOutputFormat(message.outputFormat) }
      : {})
  };
}

function getPromptDraftKeyType(key) {
  const [type, id] = String(key || "").split(":");
  if (type === "basic" && getBasicStepById(id)) return "basic";
  if (type === "case" && getCaseStudyById(id)) return "case";
  return "";
}

function sanitizePromptDrafts(promptDrafts) {
  if (!promptDrafts || typeof promptDrafts !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(promptDrafts)
      .filter(([key, value]) => getPromptDraftKeyType(key) && typeof value === "string")
      .slice(0, 80)
      .map(([key, value]) => [key, value.slice(0, MAX_PROMPT_LENGTH)])
  );
}

function inferAttemptExercise(attempt) {
  if (attempt?.exerciseType === "basic") {
    const stepId =
      typeof attempt.stepId === "string"
        ? attempt.stepId
        : typeof attempt.lessonId === "string"
          ? attempt.lessonId
          : "";
    return getBasicStepById(stepId) ? { exerciseType: "basic", stepId } : null;
  }

  if (attempt?.exerciseType === "case") {
    const caseId =
      typeof attempt.caseId === "string"
        ? attempt.caseId
        : typeof attempt.lessonId === "string"
          ? attempt.lessonId
          : "";
    return getCaseStudyById(caseId) ? { exerciseType: "case", caseId } : null;
  }

  if (typeof attempt?.stepId === "string" && getBasicStepById(attempt.stepId)) {
    return { exerciseType: "basic", stepId: attempt.stepId };
  }

  if (typeof attempt?.caseId === "string" && getCaseStudyById(attempt.caseId)) {
    return { exerciseType: "case", caseId: attempt.caseId };
  }

  if (typeof attempt?.lessonId === "string" && getBasicStepById(attempt.lessonId)) {
    return { exerciseType: "basic", stepId: attempt.lessonId };
  }

  return null;
}

function sanitizeAttempt(attempt) {
  if (!attempt || typeof attempt !== "object") {
    return null;
  }

  const exercise = inferAttemptExercise(attempt);
  const prompt = typeof attempt.prompt === "string" ? attempt.prompt.slice(0, MAX_PROMPT_LENGTH) : "";
  const assistantReply =
    typeof attempt.assistantReply === "string"
      ? attempt.assistantReply.slice(0, MAX_HISTORY_MESSAGE_LENGTH)
      : "";

  if (!exercise || !prompt.trim()) {
    return null;
  }

  const createdAt = typeof attempt.createdAt === "number" ? attempt.createdAt : Date.now();
  const base = {
    id:
      typeof attempt.id === "string" && attempt.id.trim()
        ? attempt.id.slice(0, 120)
        : `attempt-${createdAt}`,
    exerciseType: exercise.exerciseType,
    prompt,
    assistantReply,
    createdAt,
    evaluation:
      attempt.evaluation && typeof attempt.evaluation === "object" ? attempt.evaluation : null,
    score: attempt.score && typeof attempt.score === "object" ? attempt.score : null,
    revisionHint: typeof attempt.revisionHint === "string" ? attempt.revisionHint : "",
    model: typeof attempt.model === "string" ? attempt.model : "",
    provider: typeof attempt.provider === "string" ? attempt.provider : ""
  };

  if (exercise.exerciseType === "case") {
    return {
      ...base,
      caseId: exercise.caseId,
      lessonId: exercise.caseId,
      scenarioId: exercise.caseId
    };
  }

  return {
    ...base,
    stepId: exercise.stepId,
    lessonId: exercise.stepId,
    scenarioId: `${exercise.stepId}-scenario`
  };
}

function sanitizeHistoryState(state) {
  const fallbackStepId = basicSteps[0]?.id || "";
  const fallbackCaseId = caseStudies[0]?.id || "";
  const activeStepId =
    typeof state?.activeStepId === "string" && getBasicStepById(state.activeStepId)
      ? state.activeStepId
      : typeof state?.activeLessonId === "string" && getBasicStepById(state.activeLessonId)
        ? state.activeLessonId
        : fallbackStepId;
  const activeCaseId =
    typeof state?.activeCaseId === "string" && getCaseStudyById(state.activeCaseId)
      ? state.activeCaseId
      : fallbackCaseId;
  const activeExerciseType = state?.activeExerciseType === "case" ? "case" : "basic";
  const attempts = Array.isArray(state?.attempts)
    ? state.attempts.map(sanitizeAttempt).filter(Boolean).slice(0, SESSION_ARCHIVE_LIMIT)
    : [];
  const chatMessages = Array.isArray(state?.chatMessages)
    ? state.chatMessages.map(sanitizeHistoryMessage).filter(Boolean).slice(-40)
    : [];
  const promptDrafts = sanitizePromptDrafts(state?.promptDrafts);

  return {
    activeExerciseType,
    activeStepId,
    activeCaseId,
    activeLessonId: activeStepId,
    activeScenarioId: `${activeStepId}-scenario`,
    attempts,
    chatMessages,
    promptDrafts
  };
}

function buildBasicExercise(step) {
  return {
    exerciseType: "basic",
    id: step.id,
    stepId: step.id,
    displayLabel: step.displayLabel,
    title: step.title,
    shortTitle: step.shortTitle,
    focus: step.focus,
    audience: "日常タスク",
    promptScenario: step.promptScenario,
    referenceItems: step.referenceItems || [],
    sourceText: step.sourceText,
    principles: step.principles || [],
    evaluationRubricIds: step.evaluationRubricIds || [],
    checklist: step.successChecklist || [],
    nextAction:
      step.step < basicSteps.length
        ? `${basicSteps[step.step]?.displayLabel || `STEP${step.step + 1}`}へ進み、精度を上げる観点を試してください。`
        : "基本演習は完了です。実践演習で1つの業務ケースにまとめて使ってみましょう。"
  };
}

function buildCaseExercise(caseStudy) {
  return {
    exerciseType: "case",
    id: caseStudy.id,
    caseId: caseStudy.id,
    title: caseStudy.title,
    shortTitle: caseStudy.shortTitle,
    focus: caseStudy.focus,
    audience: caseStudy.audience,
    promptScenario: caseStudy.promptScenario,
    referenceItems: caseStudy.referenceItems || [],
    sourceText: caseStudy.sourceText,
    principles: ["目的", "成功条件", "制約", "背景（コンテキスト）", "出力形式"],
    checklist: caseStudy.checklist || [],
    nextAction:
      "ケーススタディの結果を見直し、自分の業務で使うテンプレートとして残してください。"
  };
}

function getExerciseRubricItems(exercise) {
  if (exercise?.exerciseType !== "basic") {
    return rubricItems;
  }

  const targetIds = Array.isArray(exercise.evaluationRubricIds)
    ? exercise.evaluationRubricIds
    : [];
  const targetItems = rubricItems.filter((item) => targetIds.includes(item.id));
  return targetItems.length > 0 ? targetItems : rubricItems;
}

function resolveAttemptExercise(body) {
  const requestedType =
    body?.exerciseType === "basic" || body?.exerciseType === "case" ? body.exerciseType : "";

  if (body?.exerciseType && !requestedType) {
    return { error: "exerciseType is invalid" };
  }

  if (requestedType === "case" || (!requestedType && typeof body?.caseId === "string")) {
    const caseId =
      typeof body?.caseId === "string"
        ? body.caseId
        : typeof body?.lessonId === "string"
          ? body.lessonId
          : "";
    const caseStudy = getCaseStudyById(caseId);
    return caseStudy ? { exercise: buildCaseExercise(caseStudy) } : { error: "caseId is invalid" };
  }

  if (requestedType === "basic" || (!requestedType && typeof body?.stepId === "string")) {
    const stepId =
      typeof body?.stepId === "string"
        ? body.stepId
        : typeof body?.lessonId === "string"
          ? body.lessonId
          : "";
    const step = getBasicStepById(stepId);
    return step ? { exercise: buildBasicExercise(step) } : { error: "stepId is invalid" };
  }

  if (typeof body?.lessonId === "string") {
    const step = getBasicStepById(body.lessonId);
    if (step) return { exercise: buildBasicExercise(step) };
    const caseStudy = getCaseStudyById(body.lessonId);
    if (caseStudy) return { exercise: buildCaseExercise(caseStudy) };
    return { error: "lessonId is invalid" };
  }

  return { error: "stepId is invalid" };
}

function buildAttemptMessages({ prompt }) {
  return [
    {
      role: "system",
      content:
        "You are the AI assistant inside a Japanese prompt-practice exercise. Follow only the learner's prompt below. Respond in Japanese unless the prompt explicitly asks otherwise. If required information is missing, ask concise clarification questions instead of inventing facts."
    },
    {
      role: "user",
      content: prompt
    }
  ];
}

function buildEvaluationMessages({
  exercise,
  prompt,
  assistantReply,
  activeRubricItems = rubricItems
}) {
  return [
    {
      role: "system",
      content:
        "あなたは生成AI研修のプロンプト評価者です。OpenAIのプロンプト指針に沿って、明確な目的、成功条件、制約、背景（コンテキスト）、出力形式を評価します。必ずJSONオブジェクトのみを返してください。"
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          task:
            "次の受講者プロンプトを0-4点で評価し、改善に使える短い助言を日本語で返してください。",
          outputSchema: {
            items: activeRubricItems.map((item) => ({
              id: item.id,
              score: "0から4の整数",
              reason: "日本語で1文",
              advice: "日本語で1文"
            })),
            summary: "日本語で2文以内",
            bestPoint: "最も良かった点を日本語で1文",
            priorityFix: "最優先で直す点を日本語で1文",
            revisionHint: "次に直すべきことを日本語で1から2文",
            nextStep: "次の演習行動を日本語で1文"
          },
          passRule: "合計70%以上、かつ0点項目がない場合に合格。",
          exercise,
          rubricItems: activeRubricItems,
          learnerPrompt: prompt,
          assistantReply
        },
        null,
        2
      )
    }
  ];
}

function getScoreBySignals(prompt, signals, fallbackScore = 1) {
  const text = prompt.toLowerCase();
  const matches = signals.filter((signal) => text.includes(signal.toLowerCase())).length;
  if (matches >= 3) return 4;
  if (matches === 2) return 3;
  if (matches === 1) return 2;
  return fallbackScore;
}

function createHeuristicEvaluation({ exercise, prompt }) {
  const signalsByItem = {
    goal: ["goal", "目的", "作って", "整理", "要約", "レビュー", "洗い出し", "案内", "直して"],
    success: ["success criteria", "成功条件", "条件", "判断", "分かる", "含める", "できる"],
    context: [
      "context",
      "背景",
      "コンテキスト",
      "読み手",
      "対象",
      "利用場面",
      "友人",
      "チーム",
      "会議",
      "顧客",
      "社内"
    ],
    constraints: [
      "constraints",
      "制約",
      "禁止",
      "避け",
      "断定しない",
      "作らない",
      "不足",
      "以内",
      "予算"
    ],
    output: ["output", "出力", "形式", "表", "箇条書き", "文字", "トーン", "件名"]
  };

  const exerciseBoosts = {
    "basic-core": ["goal", "success", "constraints", "context", "output"],
    "case-meeting": ["goal", "success", "constraints", "context", "output"],
    "case-request": ["goal", "success", "constraints", "context", "output"],
    "case-proposal": ["goal", "success", "constraints", "context", "output"]
  };

  const activeRubricItems = getExerciseRubricItems(exercise);
  const boosted = new Set(exerciseBoosts[exercise.id] || []);
  const items = activeRubricItems.map((item) => {
    const score = Math.min(
      4,
      getScoreBySignals(prompt, signalsByItem[item.id] || [], boosted.has(item.id) ? 2 : 1)
    );
    return {
      id: item.id,
      label: item.label,
      score,
      maxScore: item.maxScore,
      reason:
        score >= 3
          ? `${item.label}の指定が読み取れます。`
          : `${item.label}の指定がまだ弱く、回答のぶれを減らす余地があります。`,
      advice:
        score >= 3
          ? "この観点は維持し、ほかの不足項目を補ってください。"
          : `${item.label}を短い1文で明示すると、回答が安定します。`
    };
  });

  return normalizeEvaluation(
    {
      items,
      summary:
        exercise.exerciseType === "basic"
          ? "この演習の観点だけで確認しました。まずは指定された型に集中して整えましょう。"
          : "モック評価です。実際のAPIキー利用時は、回答内容も含めてより細かく評価します。",
      bestPoint:
        "狙いが書かれているため、AIが何を返せばよいか判断しやすくなっています。",
      priorityFix:
        "点数が低い観点を1つ選び、プロンプトに短い条件として追記してください。",
      revisionHint:
        exercise.exerciseType === "basic"
          ? "この演習の観点が伝わるように、プロンプトの該当箇所を短く書き足してください。"
          : "Role / Goal / Success criteria / Context / Constraints / Output のうち、不足している1項目を足して再実行してください。",
      nextStep: exercise.nextAction
    },
    activeRubricItems
  );
}

function parseEvaluationJson(rawText) {
  const trimmed = String(rawText || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("Evaluation response was not valid JSON");
  }
}

function normalizeEvaluation(parsed, activeRubricItems = rubricItems) {
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.items)) {
    throw new Error("Evaluation JSON did not contain items");
  }

  const items = activeRubricItems.map((rubricItem) => {
    const incoming = parsed.items.find((item) => item?.id === rubricItem.id) || {};
    const score = Number(incoming.score);
    const normalizedScore = Number.isFinite(score)
      ? Math.max(0, Math.min(rubricItem.maxScore, Math.round(score)))
      : 0;

    return {
      id: rubricItem.id,
      label: rubricItem.label,
      maxScore: rubricItem.maxScore,
      score: normalizedScore,
      reason:
        typeof incoming.reason === "string" && incoming.reason.trim()
          ? incoming.reason.trim()
          : "評価理由が返されませんでした。",
      advice:
        typeof incoming.advice === "string" && incoming.advice.trim()
          ? incoming.advice.trim()
          : "この観点をプロンプトに明示してください。"
    };
  });

  const total = items.reduce((sum, item) => sum + item.score, 0);
  const max = items.reduce((sum, item) => sum + item.maxScore, 0);
  const percentage = Math.round((total / max) * 100);
  const zeroScoreItems = items.filter((item) => item.score === 0).map((item) => item.id);

  return {
    items,
    total,
    max,
    percentage,
    passed: percentage >= 70 && zeroScoreItems.length === 0,
    zeroScoreItems,
    summary:
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : "評価サマリーが返されませんでした。",
    bestPoint:
      typeof parsed.bestPoint === "string" && parsed.bestPoint.trim()
        ? parsed.bestPoint.trim()
        : "目的に沿ってプロンプトを書こうとしている点は良いです。",
    priorityFix:
      typeof parsed.priorityFix === "string" && parsed.priorityFix.trim()
        ? parsed.priorityFix.trim()
        : "最も低い採点項目を1つ選び、具体的な指定を追記してください。",
    revisionHint:
      typeof parsed.revisionHint === "string" && parsed.revisionHint.trim()
        ? parsed.revisionHint.trim()
        : "低い点数の観点を1つ選び、プロンプトに追記してください。",
    nextStep:
      typeof parsed.nextStep === "string" && parsed.nextStep.trim()
        ? parsed.nextStep.trim()
        : "修正してもう一度実行してください。"
  };
}

function createEvaluationFailure(activeRubricItems = rubricItems) {
  return {
    evaluation: null,
    score: {
      total: 0,
      max: activeRubricItems.reduce((sum, item) => sum + item.maxScore, 0),
      percentage: 0,
      passed: false
    },
    revisionHint: "評価に失敗したため再実行してください。",
    evaluationError: true
  };
}

async function evaluatePrompt({ env, exercise, prompt, assistantReply, model }) {
  const activeRubricItems = getExerciseRubricItems(exercise);

  if (isMockMode(env)) {
    const evaluation = createHeuristicEvaluation({ exercise, prompt, assistantReply });
    return {
      evaluation,
      score: {
        total: evaluation.total,
        max: evaluation.max,
        percentage: evaluation.percentage,
        passed: evaluation.passed
      },
      revisionHint: evaluation.revisionHint,
      evaluationError: false
    };
  }

  try {
    const rawEvaluation = await generateReply({
      env,
      model,
      messages: buildEvaluationMessages({ exercise, prompt, assistantReply, activeRubricItems }),
      temperature: 0.1,
      responseFormat: { type: "json_object" }
    });
    const evaluation = normalizeEvaluation(parseEvaluationJson(rawEvaluation), activeRubricItems);
    return {
      evaluation,
      score: {
        total: evaluation.total,
        max: evaluation.max,
        percentage: evaluation.percentage,
        passed: evaluation.passed
      },
      revisionHint: evaluation.revisionHint,
      evaluationError: false
    };
  } catch (error) {
    console.error(error);
    return createEvaluationFailure(activeRubricItems);
  }
}

export function createApp({ env = process.env } = {}) {
  const app = express();
  const runtimeConfig = getRuntimeConfig(env);
  const historyTtlMs = runtimeConfig.historyTtlMinutes * 60 * 1000;
  const historyStore = new Map();

  function cleanupExpiredHistories() {
    const now = Date.now();
    for (const [clientId, entry] of historyStore.entries()) {
      if (!entry || entry.expiresAt <= now) {
        historyStore.delete(clientId);
      }
    }
  }

  function getStoredHistory(clientId) {
    const entry = historyStore.get(clientId);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt <= Date.now()) {
      historyStore.delete(clientId);
      return null;
    }
    return entry;
  }

  function saveStoredHistory(clientId, payload) {
    const now = Date.now();
    const entry = {
      ...sanitizeHistoryState(payload),
      savedAt: now,
      expiresAt: now + historyTtlMs
    };
    historyStore.set(clientId, entry);
    return entry;
  }

  setInterval(cleanupExpiredHistories, Math.min(historyTtlMs, 10 * 60 * 1000)).unref?.();

  app.use(
    cors({
      origin: env.ALLOWED_ORIGIN && env.ALLOWED_ORIGIN !== "*" ? env.ALLOWED_ORIGIN : true,
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: ["Content-Type"]
    })
  );
  app.use(express.json({ limit: "96kb" }));
  app.use(express.static(frontendDir));

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.get("/api/config", (_request, response) => {
    response.json({
      ...runtimeConfig,
      basicSteps,
      caseStudies,
      lessons: getLessonSummaries(),
      rubricItems
    });
  });

  app.get("/api/history", (request, response) => {
    const clientId = getHistoryClientId(request);
    if (!clientId) {
      response.status(400).json({ error: "clientId is required" });
      return;
    }

    const entry = getStoredHistory(clientId);
    response.json({
      ...sanitizeHistoryState(entry),
      savedAt: entry?.savedAt || null,
      historyTtlMinutes: runtimeConfig.historyTtlMinutes,
      historyVisibleCount: runtimeConfig.historyVisibleCount
    });
  });

  app.put("/api/history", (request, response) => {
    const clientId = getHistoryClientId(request);
    if (!clientId) {
      response.status(400).json({ error: "clientId is required" });
      return;
    }

    const entry = saveStoredHistory(clientId, request.body);
    response.json({
      ...entry,
      historyTtlMinutes: runtimeConfig.historyTtlMinutes,
      historyVisibleCount: runtimeConfig.historyVisibleCount
    });
  });

  app.delete("/api/history", (request, response) => {
    const clientId = getHistoryClientId(request);
    if (!clientId) {
      response.status(400).json({ error: "clientId is required" });
      return;
    }

    historyStore.delete(clientId);
    response.json({ ok: true });
  });

  app.post("/api/chat", async (request, response) => {
    const { message, history, model: requestedModel, outputFormat: requestedOutputFormat } =
      request.body ?? {};
    const outputFormat = normalizeOutputFormat(requestedOutputFormat);

    if (typeof message !== "string" || !message.trim()) {
      response.status(400).json({ error: "message is required" });
      return;
    }

    if (message.length > MAX_PROMPT_LENGTH) {
      response.status(400).json({ error: "message is too long" });
      return;
    }

    const model = resolveModel(env, requestedModel);
    const messages = [
      {
        role: "system",
        content:
          "You are a helpful classroom AI assistant for prompt-practice learners. Answer concisely in Japanese unless the user asks otherwise."
      },
      ...(Array.isArray(history)
        ? history
            .map(sanitizeHistoryMessage)
            .filter((item) => item && item.role !== "system")
            .map((item) => ({ role: item.role, content: item.content }))
        : []),
      {
        role: "user",
        content: message.trim()
      }
    ];

    try {
      const reply = await generateReply({ env, messages, model });
      response.json({
        reply: outputFormat === "plain" ? stripMarkdown(reply) : reply,
        outputFormat,
        model,
        provider: runtimeConfig.provider
      });
    } catch (error) {
      console.error(error);
      response.status(500).json({ error: "API request failed" });
    }
  });

  app.post("/api/attempts", async (request, response) => {
    const { prompt, model: requestedModel } = request.body ?? {};

    if (typeof prompt !== "string" || !prompt.trim()) {
      response.status(400).json({ error: "prompt is required" });
      return;
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      response.status(400).json({ error: "prompt is too long" });
      return;
    }

    const resolvedExercise = resolveAttemptExercise(request.body ?? {});
    if (resolvedExercise.error) {
      response.status(400).json({ error: resolvedExercise.error });
      return;
    }

    const exercise = resolvedExercise.exercise;
    const model = resolveModel(env, requestedModel);

    try {
      const assistantReply = await generateReply({
        env,
        model,
        messages: buildAttemptMessages({ exercise, prompt: prompt.trim() }),
        temperature: 0.4
      });
      const evaluationResult = await evaluatePrompt({
        env,
        exercise,
        prompt: prompt.trim(),
        assistantReply,
        model
      });
      const createdAt = Date.now();
      const identity =
        exercise.exerciseType === "case"
          ? { caseId: exercise.caseId, lessonId: exercise.caseId, scenarioId: exercise.caseId }
          : {
              stepId: exercise.stepId,
              lessonId: exercise.stepId,
              scenarioId: `${exercise.stepId}-scenario`
            };

      response.json({
        id: `attempt-${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
        exerciseType: exercise.exerciseType,
        ...identity,
        prompt: prompt.trim(),
        assistantReply,
        createdAt,
        model,
        provider: runtimeConfig.provider,
        ...evaluationResult
      });
    } catch (error) {
      console.error(error);
      response.status(500).json({ error: "Attempt execution failed" });
    }
  });

  app.use((error, _request, response, _next) => {
    console.error(error);
    response.status(500).json({ error: "Unexpected server error" });
  });

  return app;
}

if (process.argv[1] === currentFile) {
  const port = Number(process.env.PORT || 3000);
  const app = createApp();
  app.listen(port, () => {
    console.log(`プロンプト練習アプリを起動しました: http://localhost:${port}`);
  });
}

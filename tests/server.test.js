import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApp } from "../backend/server.js";

const testEnv = {
  ...process.env,
  USE_MOCK_LLM: "true",
  OPENAI_MODEL: "mock-model",
  OPENAI_API_BASE: "",
  GEMINI_API_KEY: "",
  GEMINI_MODEL: "",
  ALLOWED_MODELS: "mock-model,other-model",
  ENABLE_MODEL_SWITCH: "true",
  CHAT_HISTORY_TTL_MINUTES: "30",
  SESSION_HISTORY_VISIBLE_COUNT: "10"
};

let server;
let baseUrl;

before(async () => {
  const app = createApp({ env: testEnv });
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

test("health and config expose basic steps and case studies", async () => {
  const health = await requestJson("/api/health");
  assert.equal(health.response.status, 200);
  assert.equal(health.data.ok, true);

  const config = await requestJson("/api/config");
  assert.equal(config.response.status, 200);
  assert.equal(config.data.provider, "openai");
  assert.equal(config.data.mockMode, true);
  assert.equal(config.data.basicSteps.length, 1);
  assert.equal(config.data.caseStudies.length, 3);
  assert.equal(config.data.lessons.length, 1);
  assert.equal(config.data.rubricItems.length, 5);
  assert.equal(config.data.basicSteps[0].id, "basic-core");
  assert.equal(config.data.basicSteps[0].displayLabel, "基本");
  assert.equal(config.data.basicSteps[0].estimatedMinutes, 5);
  assert.match(config.data.basicSteps[0].promptScenario, /AIを活用しようとしています/);
  assert.equal(typeof config.data.basicSteps[0].sourceText, "string");
  assert.ok(config.data.basicSteps[0].sourceText.length > 0);
  assert.ok(Array.isArray(config.data.basicSteps[0].referenceItems));
  assert.ok(config.data.basicSteps[0].referenceItems.length > 0);
  assert.ok(Array.isArray(config.data.basicSteps[0].principles));
  assert.ok(Array.isArray(config.data.basicSteps[0].successChecklist));
  assert.deepEqual(config.data.basicSteps[0].evaluationRubricIds, [
    "goal",
    "success",
    "constraints",
    "context",
    "output"
  ]);
  assert.ok(Array.isArray(config.data.caseStudies[0].checklist));
  assert.ok(config.data.caseStudies.every((caseStudy) => caseStudy.promptScenario));
  assert.match(config.data.caseStudies[0].promptScenario, /AIを活用しようとしています/);
});

test("gemini-compatible config can use Gemini key and OPENAI_MODEL when model switch is off", async () => {
  const app = createApp({
    env: {
      USE_MOCK_LLM: "true",
      GEMINI_API_KEY: "test-key",
      OPENAI_API_BASE: "https://generativelanguage.googleapis.com/v1beta/openai",
      OPENAI_MODEL: "gemini-test-model",
      ALLOWED_MODELS: "gpt-4o-mini",
      ENABLE_MODEL_SWITCH: "false"
    }
  });
  let localServer;
  let localBaseUrl;
  await new Promise((resolve) => {
    localServer = app.listen(0, () => {
      const address = localServer.address();
      localBaseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });

  try {
    const response = await fetch(`${localBaseUrl}/api/config`);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.provider, "gemini");
    assert.equal(data.selectedModel, "gemini-test-model");
    assert.deepEqual(data.models, ["gemini-test-model"]);
  } finally {
    await new Promise((resolve) => localServer.close(resolve));
  }
});

test("attempt endpoint validates required fields", async () => {
  const emptyPrompt = await requestJson("/api/attempts", {
    method: "POST",
    body: JSON.stringify({
      exerciseType: "basic",
      stepId: "basic-core",
      prompt: ""
    })
  });
  assert.equal(emptyPrompt.response.status, 400);
  assert.equal(emptyPrompt.data.error, "prompt is required");

  const invalidStep = await requestJson("/api/attempts", {
    method: "POST",
    body: JSON.stringify({
      exerciseType: "basic",
      stepId: "missing",
      prompt: "Goal: test"
    })
  });
  assert.equal(invalidStep.response.status, 400);
  assert.equal(invalidStep.data.error, "stepId is invalid");

  const invalidCase = await requestJson("/api/attempts", {
    method: "POST",
    body: JSON.stringify({
      exerciseType: "case",
      caseId: "missing",
      prompt: "Goal: test"
    })
  });
  assert.equal(invalidCase.response.status, 400);
  assert.equal(invalidCase.data.error, "caseId is invalid");

  const invalidLegacyLesson = await requestJson("/api/attempts", {
    method: "POST",
    body: JSON.stringify({
      lessonId: "missing",
      prompt: "Goal: test"
    })
  });
  assert.equal(invalidLegacyLesson.response.status, 400);
  assert.equal(invalidLegacyLesson.data.error, "lessonId is invalid");
});

test("attempt execution sends only the learner prompt to the assistant", async () => {
  const result = await requestJson("/api/attempts", {
    method: "POST",
    body: JSON.stringify({
      exerciseType: "basic",
      stepId: "basic-core",
      prompt: "Goal: テスト用に短く返してください。",
      model: "mock-model"
    })
  });

  assert.equal(result.response.status, 200);
  assert.match(result.data.assistantReply, /Goal: テスト用に短く返してください。/);
  assert.doesNotMatch(result.data.assistantReply, /演習シーン/);
  assert.doesNotMatch(result.data.assistantReply, /利用場面/);
  assert.doesNotMatch(result.data.assistantReply, /材料:/);
  assert.doesNotMatch(result.data.assistantReply, /受講者のプロンプト/);
});

test("all basic exercises can run in mock mode with evaluation", async () => {
  const { data: config } = await requestJson("/api/config");
  const expectedRubricIds = ["goal", "success", "constraints", "context", "output"];

  for (const step of config.basicSteps) {
    const result = await requestJson("/api/attempts", {
      method: "POST",
      body: JSON.stringify({
        exerciseType: "basic",
        stepId: step.id,
        prompt: step.starterPrompt,
        model: "other-model"
      })
    });

    assert.equal(result.response.status, 200);
    assert.equal(result.data.exerciseType, "basic");
    assert.equal(result.data.stepId, step.id);
    assert.equal(result.data.lessonId, step.id);
    assert.equal(result.data.model, "other-model");
    assert.ok(result.data.assistantReply.length > 0);
    assert.equal(step.id, "basic-core");
    assert.deepEqual(step.evaluationRubricIds, expectedRubricIds);
    assert.deepEqual(
      result.data.evaluation.items.map((item) => item.id),
      expectedRubricIds
    );
    assert.equal(typeof result.data.evaluation.bestPoint, "string");
    assert.equal(typeof result.data.evaluation.priorityFix, "string");
    assert.equal(result.data.score.max, 20);
    assert.equal(typeof result.data.revisionHint, "string");
  }
});

test("all case studies can run in mock mode with evaluation", async () => {
  const { data: config } = await requestJson("/api/config");
  const expectedRubricIds = ["goal", "success", "constraints", "context", "output"];

  for (const caseStudy of config.caseStudies) {
    const result = await requestJson("/api/attempts", {
      method: "POST",
      body: JSON.stringify({
        exerciseType: "case",
        caseId: caseStudy.id,
        prompt: caseStudy.starterPrompt,
        model: "other-model"
      })
    });

    assert.equal(result.response.status, 200);
    assert.equal(result.data.exerciseType, "case");
    assert.equal(result.data.caseId, caseStudy.id);
    assert.equal(result.data.lessonId, caseStudy.id);
    assert.equal(result.data.model, "other-model");
    assert.ok(result.data.assistantReply.length > 0);
    assert.deepEqual(
      result.data.evaluation.items.map((item) => item.id),
      expectedRubricIds
    );
    assert.equal(typeof result.data.evaluation.bestPoint, "string");
    assert.equal(typeof result.data.evaluation.priorityFix, "string");
    assert.equal(result.data.score.max, 20);
    assert.equal(typeof result.data.revisionHint, "string");
  }
});

test("chat endpoint remains compatible with simple chat requests", async () => {
  const result = await requestJson("/api/chat", {
    method: "POST",
    body: JSON.stringify({
      message: "こんにちは",
      history: [],
      model: "mock-model",
      outputFormat: "plain"
    })
  });

  assert.equal(result.response.status, 200);
  assert.equal(result.data.provider, "openai");
  assert.equal(result.data.outputFormat, "plain");
  assert.ok(result.data.reply.length > 0);
});

test("history can be saved, loaded, and deleted by clientId", async () => {
  const clientId = "test-client";
  const save = await requestJson(`/api/history?clientId=${clientId}`, {
    method: "PUT",
    body: JSON.stringify({
      activeExerciseType: "basic",
      activeStepId: "basic-core",
      activeCaseId: "case-meeting",
      attempts: [
        {
          id: "attempt-1",
          exerciseType: "basic",
          stepId: "basic-core",
          prompt: "Goal: summarize",
          assistantReply: "ok",
          createdAt: Date.now(),
          score: { percentage: 80, passed: true }
        }
      ],
      promptDrafts: {
        "basic:basic-core": "Goal: summarize"
      }
    })
  });
  assert.equal(save.response.status, 200);
  assert.equal(save.data.activeExerciseType, "basic");
  assert.equal(save.data.activeStepId, "basic-core");
  assert.equal(save.data.activeCaseId, "case-meeting");
  assert.equal(save.data.attempts.length, 1);

  const load = await requestJson(`/api/history?clientId=${clientId}`);
  assert.equal(load.response.status, 200);
  assert.equal(load.data.attempts.length, 1);
  assert.equal(load.data.promptDrafts["basic:basic-core"], "Goal: summarize");

  const clear = await requestJson(`/api/history?clientId=${clientId}`, { method: "DELETE" });
  assert.equal(clear.response.status, 200);
  assert.equal(clear.data.ok, true);

  const afterClear = await requestJson(`/api/history?clientId=${clientId}`);
  assert.equal(afterClear.response.status, 200);
  assert.equal(afterClear.data.attempts.length, 0);
});

test("old lesson history falls back to basic step 1 and drops old attempts", async () => {
  const clientId = "old-history-client";
  const save = await requestJson(`/api/history?clientId=${clientId}`, {
    method: "PUT",
    body: JSON.stringify({
      activeLessonId: "legacy-transfer",
      activeScenarioId: "my-workflow",
      attempts: [
        {
          id: "old-attempt",
          lessonId: "legacy-transfer",
          scenarioId: "my-workflow",
          prompt: "old prompt",
          assistantReply: "old reply",
          createdAt: Date.now(),
          score: { percentage: 80, passed: true }
        }
      ],
      promptDrafts: {
        "legacy-transfer:my-workflow": "old prompt"
      }
    })
  });

  assert.equal(save.response.status, 200);
  assert.equal(save.data.activeExerciseType, "basic");
  assert.equal(save.data.activeStepId, "basic-core");
  assert.equal(save.data.activeLessonId, "basic-core");
  assert.equal(save.data.attempts.length, 0);
  assert.deepEqual(save.data.promptDrafts, {});

  const load = await requestJson(`/api/history?clientId=${clientId}`);
  assert.equal(load.response.status, 200);
  assert.equal(load.data.activeExerciseType, "basic");
  assert.equal(load.data.activeStepId, "basic-core");
  assert.equal(load.data.attempts.length, 0);
});

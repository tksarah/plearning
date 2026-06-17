const clientIdStorageKey = "promptPractice.clientId.v2";
const historyLimit = 24;

const elements = {
  basicTab: document.getElementById("basicTab"),
  caseTab: document.getElementById("caseTab"),
  basicView: document.getElementById("basicView"),
  caseView: document.getElementById("caseView"),
  basicStepNav: document.getElementById("basicStepNav"),
  caseCards: document.getElementById("caseCards"),
  clearHistoryButton: document.getElementById("clearHistoryButton"),
  statusPill: document.getElementById("statusPill"),
  basicKicker: document.getElementById("basicKicker"),
  basicTitle: document.getElementById("basicTitle"),
  basicFocus: document.getElementById("basicFocus"),
  basicPromptScenario: document.getElementById("basicPromptScenario"),
  basicReferenceList: document.getElementById("basicReferenceList"),
  basicSourceText: document.getElementById("basicSourceText"),
  basicPrincipleList: document.getElementById("basicPrincipleList"),
  basicChecklist: document.getElementById("basicChecklist"),
  basicBadExample: document.getElementById("basicBadExample"),
  basicHint: document.getElementById("basicHint"),
  basicPromptInput: document.getElementById("basicPromptInput"),
  useBasicStarterButton: document.getElementById("useBasicStarterButton"),
  runBasicButton: document.getElementById("runBasicButton"),
  prevBasicButton: document.getElementById("prevBasicButton"),
  nextBasicButton: document.getElementById("nextBasicButton"),
  caseTitle: document.getElementById("caseTitle"),
  caseFocus: document.getElementById("caseFocus"),
  casePromptScenario: document.getElementById("casePromptScenario"),
  caseReferenceList: document.getElementById("caseReferenceList"),
  caseSourceText: document.getElementById("caseSourceText"),
  caseChecklist: document.getElementById("caseChecklist"),
  casePromptInput: document.getElementById("casePromptInput"),
  useCaseStarterButton: document.getElementById("useCaseStarterButton"),
  runCaseButton: document.getElementById("runCaseButton"),
  copyPromptButton: document.getElementById("copyPromptButton"),
  exportPdfButton: document.getElementById("exportPdfButton"),
  exportTextButton: document.getElementById("exportTextButton"),
  exportJsonButton: document.getElementById("exportJsonButton"),
  exportCsvButton: document.getElementById("exportCsvButton"),
  resultSection: document.getElementById("resultSection"),
  assistantOutput: document.getElementById("assistantOutput"),
  scoreSummary: document.getElementById("scoreSummary"),
  bestPoint: document.getElementById("bestPoint"),
  priorityFix: document.getElementById("priorityFix"),
  revisionHint: document.getElementById("revisionHint"),
  overallWeatherMark: document.getElementById("overallWeatherMark"),
  basicRubricFeedback: document.getElementById("basicRubricFeedback")
};

const state = {
  clientId: getOrCreateClientId(),
  config: null,
  basicSteps: [],
  caseStudies: [],
  rubricItems: [],
  activeExerciseType: "basic",
  activeStepId: "",
  activeCaseId: "",
  attempts: [],
  chatMessages: [],
  promptDrafts: {},
  currentAttempt: null,
  selectedModel: "",
  isRunning: false
};

let saveTimer = null;

const weatherMarks = {
  sunny: {
    label: "晴れ",
    message: "よくできています",
    src: "./assets/weather/sunny.png"
  },
  cloudy: {
    label: "くもり",
    message: "もう少しです",
    src: "./assets/weather/cloudy.png"
  },
  rainy: {
    label: "雨",
    message: "見直しましょう",
    src: "./assets/weather/rainy.png"
  }
};

function getOrCreateClientId() {
  const existingClientId = localStorage.getItem(clientIdStorageKey);
  if (existingClientId) {
    return existingClientId;
  }

  const generatedClientId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem(clientIdStorageKey, generatedClientId);
  return generatedClientId;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getWeatherKeyFromPercentage(percentage) {
  const numericPercentage = Number(percentage);
  if (!Number.isFinite(numericPercentage)) return null;
  if (numericPercentage >= 75) return "sunny";
  if (numericPercentage >= 50) return "cloudy";
  return "rainy";
}

function getWeatherKeyFromRubricItem(item) {
  const score = Number(item?.score);
  const maxScore = Number(item?.maxScore);
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return null;

  if (maxScore === 4) {
    if (score >= 3) return "sunny";
    if (score >= 2) return "cloudy";
    return "rainy";
  }

  const ratio = score / maxScore;
  if (ratio >= 0.75) return "sunny";
  if (ratio >= 0.5) return "cloudy";
  return "rainy";
}

function createWeatherMark(key, { variant = "item", prefix = "" } = {}) {
  const weather = weatherMarks[key];
  if (!weather) return null;

  const mark = document.createElement("span");
  mark.className = `weather-mark weather-mark-${variant} weather-mark-${key}`;
  mark.title = weather.message;
  mark.setAttribute(
    "aria-label",
    `${prefix ? `${prefix}: ` : ""}${weather.label}、${weather.message}`
  );

  const image = document.createElement("img");
  image.src = weather.src;
  image.alt = "";
  image.loading = "lazy";
  image.decoding = "async";
  image.setAttribute("aria-hidden", "true");
  mark.appendChild(image);

  if (variant === "overall") {
    const text = document.createElement("span");
    text.className = "weather-mark-copy";
    text.textContent = `${weather.label}: ${weather.message}`;
    mark.appendChild(text);
  }

  return mark;
}

function renderOverallWeatherMark(evaluation) {
  elements.overallWeatherMark.replaceChildren();

  const fallbackPercentage =
    Number.isFinite(Number(evaluation?.total)) &&
    Number.isFinite(Number(evaluation?.max)) &&
    Number(evaluation.max) > 0
      ? Math.round((Number(evaluation.total) / Number(evaluation.max)) * 100)
      : null;
  const weatherKey = getWeatherKeyFromPercentage(evaluation?.percentage ?? fallbackPercentage);
  const mark = createWeatherMark(weatherKey, {
    variant: "overall",
    prefix: "全体"
  });

  if (!mark) {
    elements.overallWeatherMark.hidden = true;
    return;
  }

  elements.overallWeatherMark.hidden = false;
  elements.overallWeatherMark.appendChild(mark);
}

function clearOverallWeatherMark() {
  elements.overallWeatherMark.replaceChildren();
  elements.overallWeatherMark.hidden = true;
}

function renderInlineMarkdown(text) {
  return escapeHtml(text || "")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>");
}

function splitTableRow(line) {
  let trimmed = String(line || "").trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((cell) => cell.trim());
}

function looksLikeTableRow(line) {
  return String(line || "").includes("|") && splitTableRow(line).length > 1;
}

function isTableSeparator(line) {
  const cells = splitTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

function renderMarkdownTable(lines, startIndex) {
  const headers = splitTableRow(lines[startIndex]);
  const rows = [];
  let index = startIndex + 2;

  while (index < lines.length && looksLikeTableRow(lines[index]) && lines[index].trim()) {
    if (!isTableSeparator(lines[index])) {
      rows.push(splitTableRow(lines[index]));
    }
    index += 1;
  }

  const headerMarkup = headers
    .map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`)
    .join("");
  const rowMarkup = rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${renderInlineMarkdown(cell)}</td>`).join("")}</tr>`
    )
    .join("");

  return {
    html: `<div class="markdown-table-wrap"><table><thead><tr>${headerMarkup}</tr></thead><tbody>${rowMarkup}</tbody></table></div>`,
    nextIndex: index
  };
}

function isBlockStart(line, nextLine = "") {
  const trimmed = String(line || "").trim();
  return (
    /^```/.test(trimmed) ||
    /^#{1,6}\s+/.test(trimmed) ||
    /^([-*_])\1\1+$/.test(trimmed) ||
    /^[-*+]\s+/.test(trimmed) ||
    /^\d+[.)]\s+/.test(trimmed) ||
    (looksLikeTableRow(trimmed) && isTableSeparator(nextLine))
  );
}

function renderMarkdownOutput(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (/^```/.test(trimmed)) {
      const codeLines = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      blocks.push(`<h4>${renderInlineMarkdown(headingMatch[2])}</h4>`);
      index += 1;
      continue;
    }

    if (/^([-*_])\1\1+$/.test(trimmed)) {
      blocks.push("<hr />");
      index += 1;
      continue;
    }

    if (looksLikeTableRow(trimmed) && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const renderedTable = renderMarkdownTable(lines, index);
      blocks.push(renderedTable.html);
      index = renderedTable.nextIndex;
      continue;
    }

    if (/^[-*+]\s+/.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^[-*+]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*+]\s+/, ""));
        index += 1;
      }
      blocks.push(`<ul>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
      continue;
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+[.)]\s+/, ""));
        index += 1;
      }
      blocks.push(`<ol>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ol>`);
      continue;
    }

    const paragraphLines = [trimmed];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !isBlockStart(lines[index], lines[index + 1] || "")
    ) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push(`<p>${renderInlineMarkdown(paragraphLines.join(" "))}</p>`);
  }

  return blocks.join("");
}

function getCurrentStep() {
  return (
    state.basicSteps.find((step) => step.id === state.activeStepId) || state.basicSteps[0] || null
  );
}

function getCurrentStepIndex() {
  const index = state.basicSteps.findIndex((step) => step.id === state.activeStepId);
  return index >= 0 ? index : 0;
}

function getCurrentCase() {
  return (
    state.caseStudies.find((caseStudy) => caseStudy.id === state.activeCaseId) ||
    state.caseStudies[0] ||
    null
  );
}

function getActiveId(type = state.activeExerciseType) {
  return type === "case" ? state.activeCaseId : state.activeStepId;
}

function getDraftKey(type = state.activeExerciseType, id = getActiveId(type)) {
  return `${type}:${id}`;
}

function getPromptElement(type = state.activeExerciseType) {
  return type === "case" ? elements.casePromptInput : elements.basicPromptInput;
}

function getStarterPrompt(type = state.activeExerciseType, id = getActiveId(type)) {
  if (type === "case") {
    return state.caseStudies.find((caseStudy) => caseStudy.id === id)?.starterPrompt || "";
  }
  return state.basicSteps.find((step) => step.id === id)?.starterPrompt || "";
}

function setStatus(text) {
  if (elements.statusPill) {
    elements.statusPill.textContent = text;
  }
}

function setRunning(isRunning, type = state.activeExerciseType) {
  state.isRunning = isRunning;
  for (const control of [
    elements.runBasicButton,
    elements.runCaseButton,
    elements.basicPromptInput,
    elements.casePromptInput,
    elements.useBasicStarterButton,
    elements.useCaseStarterButton,
    elements.prevBasicButton,
    elements.nextBasicButton,
    elements.basicTab,
    elements.caseTab
  ]) {
    control.disabled = isRunning;
  }
  for (const button of document.querySelectorAll(".step-button, .case-card")) {
    button.disabled = isRunning;
  }

  elements.runBasicButton.textContent =
    isRunning && type === "basic" ? "実行中..." : "このプロンプトで実行";
  elements.runCaseButton.textContent =
    isRunning && type === "case" ? "実行中..." : "このプロンプトで実行";

  if (isRunning) {
    elements.resultSection.hidden = false;
    elements.assistantOutput.innerHTML =
      '<p class="loading">AI出力と評価を作成しています...</p>';
    setStatus("実行中");
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
}

function getHistoryEndpoint() {
  return `/api/history?clientId=${encodeURIComponent(state.clientId)}`;
}

async function loadHistory() {
  try {
    const data = await fetchJson(getHistoryEndpoint());
    state.activeExerciseType = data.activeExerciseType === "case" ? "case" : "basic";
    state.activeStepId = state.basicSteps.some((step) => step.id === data.activeStepId)
      ? data.activeStepId
      : state.basicSteps[0]?.id || "";
    state.activeCaseId = state.caseStudies.some((caseStudy) => caseStudy.id === data.activeCaseId)
      ? data.activeCaseId
      : state.caseStudies[0]?.id || "";
    state.attempts = Array.isArray(data.attempts) ? data.attempts : [];
    state.chatMessages = Array.isArray(data.chatMessages) ? data.chatMessages : [];
    state.promptDrafts =
      data.promptDrafts && typeof data.promptDrafts === "object" ? data.promptDrafts : {};
  } catch {
    state.activeExerciseType = "basic";
    state.activeStepId = state.basicSteps[0]?.id || "";
    state.activeCaseId = state.caseStudies[0]?.id || "";
    state.attempts = [];
    state.chatMessages = [];
    state.promptDrafts = {};
  }
}

async function saveHistory() {
  await fetchJson(getHistoryEndpoint(), {
    method: "PUT",
    body: JSON.stringify({
      activeExerciseType: state.activeExerciseType,
      activeStepId: state.activeStepId,
      activeCaseId: state.activeCaseId,
      attempts: state.attempts.slice(0, historyLimit),
      chatMessages: state.chatMessages,
      promptDrafts: state.promptDrafts
    })
  }).catch((error) => {
    console.error(error);
  });
}

function scheduleSaveHistory() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void saveHistory();
  }, 450);
}

function syncPromptToDraft(type = state.activeExerciseType) {
  const id = getActiveId(type);
  if (!id) return;
  state.promptDrafts[getDraftKey(type, id)] = getPromptElement(type).value;
}

function loadPromptForActive() {
  const type = state.activeExerciseType;
  const id = getActiveId(type);
  const draft = state.promptDrafts[getDraftKey(type, id)];
  getPromptElement(type).value = typeof draft === "string" ? draft : "";
}

function findLatestAttempt(type = state.activeExerciseType, id = getActiveId(type)) {
  return (
    state.attempts.find((attempt) =>
      type === "case"
        ? attempt.exerciseType === "case" && attempt.caseId === id
        : attempt.exerciseType === "basic" && attempt.stepId === id
    ) || null
  );
}

function getStepDisplayLabel(step) {
  if (step?.displayLabel) {
    return step.displayLabel;
  }
  return step?.step ? `STEP ${step.step}` : "基本";
}

function renderTabs() {
  const isCase = state.activeExerciseType === "case";
  elements.basicTab.classList.toggle("active", !isCase);
  elements.caseTab.classList.toggle("active", isCase);
  elements.basicTab.setAttribute("aria-selected", String(!isCase));
  elements.caseTab.setAttribute("aria-selected", String(isCase));
  elements.basicView.hidden = isCase;
  elements.caseView.hidden = !isCase;
}

function renderBasicNav() {
  elements.basicStepNav.innerHTML = "";
  elements.basicStepNav.hidden = state.basicSteps.length <= 1;
  if (elements.basicStepNav.hidden) {
    return;
  }

  for (const step of state.basicSteps) {
    const latest = findLatestAttempt("basic", step.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "step-button",
      step.id === state.activeStepId ? "active" : "",
      latest ? "completed" : ""
    ]
      .filter(Boolean)
      .join(" ");
    button.innerHTML = `
      <span class="step-number">${escapeHtml(getStepDisplayLabel(step))}</span>
      <span class="step-title">${escapeHtml(step.shortTitle || step.title)}</span>
      ${latest ? '<span class="step-status">実行済み</span>' : ""}
    `;
    button.addEventListener("click", () => switchBasicStep(step.id));
    elements.basicStepNav.appendChild(button);
  }
}

function renderCaseCards() {
  elements.caseCards.innerHTML = "";
  for (const caseStudy of state.caseStudies) {
    const latest = findLatestAttempt("case", caseStudy.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "case-card",
      caseStudy.id === state.activeCaseId ? "active" : "",
      latest?.score?.passed ? "passed" : ""
    ]
      .filter(Boolean)
      .join(" ");
    button.innerHTML = `
      <span class="case-title">${escapeHtml(caseStudy.shortTitle || caseStudy.title)}</span>
      <span class="case-focus">${escapeHtml(caseStudy.focus)}</span>
      ${latest ? '<span class="case-meta">実行済み</span>' : ""}
    `;
    button.addEventListener("click", () => switchCase(caseStudy.id));
    elements.caseCards.appendChild(button);
  }
}

function renderList(container, items) {
  container.innerHTML = "";
  for (const text of items || []) {
    const item = document.createElement("li");
    item.textContent = text;
    container.appendChild(item);
  }
}

function renderReferenceInfo({ listElement, textElement, referenceItems, sourceText }) {
  const items = Array.isArray(referenceItems) ? referenceItems.filter(Boolean) : [];
  listElement.replaceChildren();

  if (items.length) {
    for (const item of items) {
      const block = document.createElement("div");
      block.className = "reference-item";

      const label = document.createElement("p");
      label.className = "reference-item-label";
      label.textContent = item.label || "";

      const value = document.createElement("p");
      value.className = "reference-item-value";
      value.textContent = item.value || "";

      block.append(label, value);
      listElement.appendChild(block);
    }
    listElement.hidden = false;
    textElement.hidden = true;
    textElement.textContent = "";
    return;
  }

  listElement.hidden = true;
  textElement.hidden = false;
  textElement.textContent = sourceText || "";
}

function renderPrinciples(container, principles) {
  container.innerHTML = "";
  for (const principle of principles || []) {
    const chip = document.createElement("span");
    chip.className = "principle-chip";
    chip.textContent = principle;
    container.appendChild(chip);
  }
}

function renderBasicContent() {
  const step = getCurrentStep();
  if (!step) return;

  const index = getCurrentStepIndex();
  const hasMultipleBasicSteps = state.basicSteps.length > 1;
  const focusText = step.focus || "";
  elements.basicKicker.textContent = getStepDisplayLabel(step);
  elements.basicTitle.textContent = step.title;
  elements.basicFocus.textContent = focusText;
  elements.basicFocus.hidden = !focusText;
  elements.basicPromptScenario.textContent = step.promptScenario || step.sourceText;
  renderReferenceInfo({
    listElement: elements.basicReferenceList,
    textElement: elements.basicSourceText,
    referenceItems: step.referenceItems,
    sourceText: step.sourceText
  });
  elements.basicBadExample.textContent = step.badExample;
  elements.basicHint.textContent = step.hint || step.guide || "";
  renderPrinciples(elements.basicPrincipleList, step.principles);
  renderList(elements.basicChecklist, step.successChecklist || step.improvementPoints);
  elements.prevBasicButton.hidden = !hasMultipleBasicSteps;
  elements.nextBasicButton.hidden = !hasMultipleBasicSteps;
  elements.prevBasicButton.disabled = !hasMultipleBasicSteps || index === 0 || state.isRunning;
  elements.nextBasicButton.disabled =
    !hasMultipleBasicSteps || index >= state.basicSteps.length - 1 || state.isRunning;
}

function renderCaseContent() {
  const caseStudy = getCurrentCase();
  if (!caseStudy) return;

  elements.caseTitle.textContent = caseStudy.title;
  elements.caseFocus.textContent = caseStudy.focus;
  elements.casePromptScenario.textContent = caseStudy.promptScenario || caseStudy.sourceText;
  renderReferenceInfo({
    listElement: elements.caseReferenceList,
    textElement: elements.caseSourceText,
    referenceItems: caseStudy.referenceItems,
    sourceText: caseStudy.sourceText
  });
  renderList(elements.caseChecklist, caseStudy.checklist);
}

function renderBasicRubricFeedback(items) {
  const feedbackItems = (Array.isArray(items) ? items : items ? [items] : []).filter(Boolean);
  elements.basicRubricFeedback.replaceChildren();

  if (!feedbackItems.length) {
    elements.basicRubricFeedback.hidden = true;
    return;
  }

  const list = document.createElement("div");
  list.className = "basic-feedback-list";

  for (const item of feedbackItems) {
    const block = document.createElement("div");
    block.className = "basic-feedback-item";

    const head = document.createElement("div");
    head.className = "basic-feedback-head";

    const title = document.createElement("p");
    title.className = "basic-focus-title";
    title.textContent = item.label || "観点";
    head.append(title);

    const weatherMark = createWeatherMark(getWeatherKeyFromRubricItem(item), {
      variant: "item",
      prefix: item.label || "観点"
    });
    if (weatherMark) {
      head.appendChild(weatherMark);
    }

    const reason = document.createElement("p");
    reason.className = "feedback-card-copy";
    const reasonLabel = document.createElement("span");
    reasonLabel.className = "feedback-card-label";
    reasonLabel.textContent = "現状";
    reason.append(reasonLabel, document.createTextNode(item.reason || ""));

    const advice = document.createElement("p");
    advice.className = "feedback-card-copy strong";
    const adviceLabel = document.createElement("span");
    adviceLabel.className = "feedback-card-label";
    adviceLabel.textContent = "改善";
    advice.append(adviceLabel, document.createTextNode(item.advice || ""));

    block.append(head, reason, advice);
    list.appendChild(block);
  }

  elements.basicRubricFeedback.hidden = false;
  elements.basicRubricFeedback.appendChild(list);
}

function renderFeedback() {
  const attempt = state.currentAttempt;
  const evaluation = attempt?.evaluation;

  if (!attempt) {
    elements.resultSection.hidden = true;
    elements.basicRubricFeedback.hidden = true;
    clearOverallWeatherMark();
    return;
  }

  elements.resultSection.hidden = false;
  renderBasicRubricFeedback(null);
  clearOverallWeatherMark();

  if (attempt.evaluationError || !evaluation) {
    elements.scoreSummary.textContent = "評価に失敗したため再実行してください。";
    elements.bestPoint.textContent = "AI出力は表示されています。";
    elements.priorityFix.textContent = "採点だけ再実行してください。";
    elements.revisionHint.textContent =
      attempt.revisionHint || "評価に失敗したため再実行してください。";
    renderBasicRubricFeedback({
      label: "評価に失敗しました",
      reason: "採点コメントを取得できませんでした。",
      advice: "少し時間を置いて、もう一度実行してください。"
    });
    return;
  }

  elements.scoreSummary.textContent = evaluation.summary;
  renderOverallWeatherMark(evaluation);
  elements.bestPoint.textContent =
    evaluation.bestPoint || "目的に沿ってプロンプトを書こうとしている点は良いです。";
  elements.priorityFix.textContent =
    evaluation.priorityFix || "最も低い採点項目を1つ選び、具体的な指定を追記してください。";
  elements.revisionHint.textContent = evaluation.revisionHint || attempt.revisionHint || "";
  renderBasicRubricFeedback(evaluation.items);
}

function renderAssistantOutput() {
  const attempt = state.currentAttempt;
  elements.assistantOutput.innerHTML = attempt ? renderMarkdownOutput(attempt.assistantReply || "") : "";
}

function renderModelOptions() {
  const models = state.config?.models || [];
  state.selectedModel = state.config?.selectedModel || models[0] || "";
}

function renderAll() {
  renderTabs();
  renderBasicNav();
  renderCaseCards();
  renderBasicContent();
  renderCaseContent();
  renderAssistantOutput();
  renderFeedback();
}

function switchTab(type) {
  syncPromptToDraft();
  state.activeExerciseType = type;
  state.currentAttempt = findLatestAttempt();
  loadPromptForActive();
  renderAll();
  scheduleSaveHistory();
}

function switchBasicStep(stepId) {
  syncPromptToDraft();
  const step = state.basicSteps.find((item) => item.id === stepId);
  if (!step) return;

  state.activeExerciseType = "basic";
  state.activeStepId = step.id;
  state.currentAttempt = findLatestAttempt("basic", step.id);
  loadPromptForActive();
  renderAll();
  scheduleSaveHistory();
}

function switchCase(caseId) {
  syncPromptToDraft();
  const caseStudy = state.caseStudies.find((item) => item.id === caseId);
  if (!caseStudy) return;

  state.activeExerciseType = "case";
  state.activeCaseId = caseStudy.id;
  state.currentAttempt = findLatestAttempt("case", caseStudy.id);
  loadPromptForActive();
  renderAll();
  scheduleSaveHistory();
}

function goToRelativeStep(offset) {
  const currentIndex = getCurrentStepIndex();
  const nextStep = state.basicSteps[currentIndex + offset];
  if (nextStep) {
    switchBasicStep(nextStep.id);
  }
}

async function runAttempt(type) {
  state.activeExerciseType = type;
  const prompt = getPromptElement(type).value.trim();
  const payload =
    type === "case"
      ? { exerciseType: "case", caseId: state.activeCaseId, prompt }
      : { exerciseType: "basic", stepId: state.activeStepId, prompt };

  if (!prompt) {
    setStatus("プロンプト欄に入力してください");
    return;
  }

  syncPromptToDraft(type);
  setRunning(true, type);

  try {
    const data = await fetchJson("/api/attempts", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        model: state.selectedModel || undefined
      })
    });

    state.currentAttempt = data;
    state.attempts = [data, ...state.attempts.filter((attempt) => attempt.id !== data.id)].slice(
      0,
      historyLimit
    );
    await saveHistory();
    renderAll();
    setStatus(data.evaluationError ? "評価失敗" : "完了");
  } catch (error) {
    console.error(error);
    elements.resultSection.hidden = false;
    elements.assistantOutput.innerHTML = `<p class="empty-text">${escapeHtml(
      `実行に失敗しました: ${error.message}`
    )}</p>`;
    setStatus("エラー");
  } finally {
    setRunning(false, type);
    renderBasicContent();
    renderCaseContent();
  }
}

async function copyPrompt() {
  const text = getPromptElement().value;
  try {
    await navigator.clipboard.writeText(text);
    setStatus("コピーしました");
  } catch {
    const element = getPromptElement();
    element.focus();
    element.select();
    document.execCommand("copy");
    setStatus("コピーしました");
  }
}

function toCrlf(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n/g, "\r\n");
}

function prepareDownloadContent(content, { bom = false, crlf = false } = {}) {
  const normalized = crlf ? toCrlf(content) : String(content ?? "");
  return bom ? `\ufeff${normalized}` : normalized;
}

function downloadFile({ filename, type, content, bom = false, crlf = false }) {
  const blob = new Blob([prepareDownloadContent(content, { bom, crlf })], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getReportTitle(attempt) {
  if (attempt?.exerciseType === "case") {
    const caseStudy = state.caseStudies.find((item) => item.id === attempt.caseId);
    return caseStudy?.title || "実践演習";
  }

  const step = state.basicSteps.find((item) => item.id === attempt?.stepId);
  return step?.title || "基本演習";
}

function getReportTypeLabel(attempt) {
  return attempt?.exerciseType === "case" ? "実践演習" : "基本演習";
}

function getCurrentReportData() {
  const attempt = state.currentAttempt;
  if (!attempt) return null;

  const evaluation = attempt.evaluation && typeof attempt.evaluation === "object" ? attempt.evaluation : {};
  return {
    exportedAt: new Date().toLocaleString("ja-JP"),
    exerciseType: getReportTypeLabel(attempt),
    title: getReportTitle(attempt),
    prompt: attempt.prompt || "",
    assistantReply: attempt.assistantReply || "",
    bestPoint: evaluation.bestPoint || "",
    priorityFix: evaluation.priorityFix || "",
    summary: evaluation.summary || "",
    revisionHint: evaluation.revisionHint || attempt.revisionHint || "",
    items: Array.isArray(evaluation.items) ? evaluation.items : []
  };
}

function buildTextReport(report) {
  const lines = [
    "プロンプト練習 書き出し",
    `書き出し日時: ${report.exportedAt}`,
    `演習: ${report.exerciseType}`,
    `タイトル: ${report.title}`,
    "",
    "【プロンプト】",
    report.prompt || "（未入力）",
    "",
    "【AIの回答】",
    report.assistantReply || "（回答なし）",
    "",
    "【プロンプト改善コメント】",
    `良かった点: ${report.bestPoint || "（なし）"}`,
    `次に直す1点: ${report.priorityFix || "（なし）"}`,
    `サマリー: ${report.summary || "（なし）"}`,
    `再実行のヒント: ${report.revisionHint || "（なし）"}`,
    "",
    "【5観点フィードバック】"
  ];

  if (report.items.length) {
    report.items.forEach((item, index) => {
      lines.push(
        "",
        `${index + 1}. ${item.label || "観点"}`,
        `現状: ${item.reason || "（なし）"}`,
        `改善: ${item.advice || "（なし）"}`
      );
    });
  } else {
    lines.push("（評価コメントなし）");
  }

  return lines.join("\n");
}

function reportTextBlock(value) {
  return `<div class="print-text-block">${escapeHtml(value || "（なし）")}</div>`;
}

function buildPrintReportHtml(report) {
  const itemMarkup = report.items.length
    ? report.items
        .map(
          (item, index) => `
            <section class="print-card">
              <h3>${index + 1}. ${escapeHtml(item.label || "観点")}</h3>
              <p><strong>現状</strong></p>
              ${reportTextBlock(item.reason)}
              <p><strong>改善</strong></p>
              ${reportTextBlock(item.advice)}
            </section>
          `
        )
        .join("")
    : "<p>評価コメントはありません。</p>";

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(report.title)} - プロンプト練習</title>
    <style>
      body {
        margin: 0;
        color: #1c2430;
        font-family: "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif;
        line-height: 1.7;
      }
      main {
        max-width: 900px;
        margin: 0 auto;
        padding: 28px;
      }
      h1 {
        margin: 0 0 6px;
        font-size: 24px;
      }
      h2 {
        margin: 28px 0 10px;
        padding-bottom: 6px;
        border-bottom: 1px solid #d8dee6;
        font-size: 18px;
      }
      h3 {
        margin: 0 0 8px;
        font-size: 15px;
      }
      .print-meta {
        margin: 0;
        color: #5d6875;
        font-size: 12px;
      }
      .print-text-block,
      .print-card {
        border: 1px solid #d8dee6;
        border-radius: 8px;
        background: #fafbfc;
      }
      .print-text-block {
        padding: 12px;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .print-card {
        break-inside: avoid;
        margin: 10px 0;
        padding: 12px;
      }
      .print-card p {
        margin: 8px 0 4px;
      }
      @media print {
        main {
          padding: 0;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>プロンプト練習 書き出し</h1>
      <p class="print-meta">書き出し日時: ${escapeHtml(report.exportedAt)}</p>
      <p class="print-meta">演習: ${escapeHtml(report.exerciseType)} / ${escapeHtml(report.title)}</p>

      <h2>プロンプト</h2>
      ${reportTextBlock(report.prompt || "（未入力）")}

      <h2>AIの回答</h2>
      ${reportTextBlock(report.assistantReply || "（回答なし）")}

      <h2>プロンプト改善コメント</h2>
      <section class="print-card">
        <p><strong>良かった点</strong></p>
        ${reportTextBlock(report.bestPoint)}
        <p><strong>次に直す1点</strong></p>
        ${reportTextBlock(report.priorityFix)}
        <p><strong>サマリー</strong></p>
        ${reportTextBlock(report.summary)}
        <p><strong>再実行のヒント</strong></p>
        ${reportTextBlock(report.revisionHint)}
      </section>

      <h2>5観点フィードバック</h2>
      ${itemMarkup}
    </main>
  </body>
</html>`;
}

function withoutNumericEvaluation(attempt) {
  if (attempt?.exerciseType !== "basic") {
    return attempt;
  }

  const { score, ...exportAttempt } = attempt;
  if (attempt.evaluation && typeof attempt.evaluation === "object") {
    exportAttempt.evaluation = {
      items: Array.isArray(attempt.evaluation.items)
        ? attempt.evaluation.items.map((item) => ({
            id: item.id,
            label: item.label,
            reason: item.reason,
            advice: item.advice
          }))
        : [],
      summary: attempt.evaluation.summary || "",
      bestPoint: attempt.evaluation.bestPoint || "",
      priorityFix: attempt.evaluation.priorityFix || "",
      revisionHint: attempt.evaluation.revisionHint || "",
      nextStep: attempt.evaluation.nextStep || ""
    };
  }
  return exportAttempt;
}

function exportJson() {
  const payload = {
    exportedAt: new Date().toISOString(),
    activeExerciseType: state.activeExerciseType,
    activeStepId: state.activeStepId,
    activeCaseId: state.activeCaseId,
    currentPrompt: getPromptElement().value,
    attempts: state.attempts.map(withoutNumericEvaluation)
  };
  downloadFile({
    filename: "prompt-practice-results.json",
    type: "application/json",
    content: JSON.stringify(payload, null, 2)
  });
  setStatus("JSONを書き出しました");
}

function getExportTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function getRequiredCurrentReport() {
  const report = getCurrentReportData();
  if (!report) {
    setStatus("書き出す結果がありません");
    return null;
  }
  return report;
}

function exportText() {
  const report = getRequiredCurrentReport();
  if (!report) return;

  downloadFile({
    filename: `prompt-practice-result-${getExportTimestamp()}.txt`,
    type: "text/plain;charset=utf-8",
    content: buildTextReport(report),
    bom: true,
    crlf: true
  });
  setStatus("テキストを書き出しました");
}

function exportPdf() {
  const report = getRequiredCurrentReport();
  if (!report) return;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    setStatus("印刷画面を開けませんでした");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(buildPrintReportHtml(report));
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 250);
  setStatus("印刷画面を開きました");
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportCsv() {
  const rows = [
    [
      "createdAt",
      "exerciseType",
      "stepId",
      "caseId",
      "score",
      "passed",
      "prompt",
      "assistantReply",
      "bestPoint",
      "priorityFix",
      "revisionHint"
    ],
    ...state.attempts.map((attempt) => {
      const isBasicAttempt = attempt.exerciseType === "basic";
      return [
        new Date(attempt.createdAt).toISOString(),
        attempt.exerciseType,
        attempt.stepId || "",
        attempt.caseId || "",
        isBasicAttempt ? "" : attempt.score?.percentage ?? "",
        isBasicAttempt ? "" : attempt.score?.passed ?? false,
        attempt.prompt,
        attempt.assistantReply,
        attempt.evaluation?.bestPoint || "",
        attempt.evaluation?.priorityFix || "",
        attempt.evaluation?.revisionHint || attempt.revisionHint || ""
      ];
    })
  ];
  downloadFile({
    filename: "prompt-practice-results.csv",
    type: "text/csv;charset=utf-8",
    content: rows.map((row) => row.map(csvCell).join(",")).join("\n"),
    bom: true,
    crlf: true
  });
  setStatus("CSVを書き出しました");
}

async function clearHistory() {
  const confirmed = window.confirm("このブラウザの演習履歴をクリアします。よろしいですか？");
  if (!confirmed) return;

  await fetchJson(getHistoryEndpoint(), { method: "DELETE" }).catch((error) => {
    console.error(error);
  });
  state.attempts = [];
  state.chatMessages = [];
  state.promptDrafts = {};
  state.currentAttempt = null;
  loadPromptForActive();
  renderAll();
  setStatus("履歴をクリアしました");
}

function bindEvents() {
  elements.basicTab.addEventListener("click", () => switchTab("basic"));
  elements.caseTab.addEventListener("click", () => switchTab("case"));
  elements.clearHistoryButton.addEventListener("click", () => {
    void clearHistory();
  });
  elements.basicPromptInput.addEventListener("input", () => {
    syncPromptToDraft("basic");
    scheduleSaveHistory();
  });
  elements.casePromptInput.addEventListener("input", () => {
    syncPromptToDraft("case");
    scheduleSaveHistory();
  });
  elements.useBasicStarterButton.addEventListener("click", () => {
    elements.basicPromptInput.value = getStarterPrompt("basic", state.activeStepId);
    syncPromptToDraft("basic");
    setStatus("プロンプト例を入れました");
    scheduleSaveHistory();
  });
  elements.useCaseStarterButton.addEventListener("click", () => {
    elements.casePromptInput.value = getStarterPrompt("case", state.activeCaseId);
    syncPromptToDraft("case");
    setStatus("プロンプト例を入れました");
    scheduleSaveHistory();
  });
  elements.runBasicButton.addEventListener("click", () => {
    void runAttempt("basic");
  });
  elements.runCaseButton.addEventListener("click", () => {
    void runAttempt("case");
  });
  elements.prevBasicButton.addEventListener("click", () => goToRelativeStep(-1));
  elements.nextBasicButton.addEventListener("click", () => goToRelativeStep(1));
  elements.copyPromptButton.addEventListener("click", () => {
    void copyPrompt();
  });
  elements.exportPdfButton.addEventListener("click", exportPdf);
  elements.exportTextButton.addEventListener("click", exportText);
  elements.exportJsonButton.addEventListener("click", exportJson);
  elements.exportCsvButton.addEventListener("click", exportCsv);
}

async function init() {
  bindEvents();

  try {
    state.config = await fetchJson("/api/config");
    state.basicSteps = state.config.basicSteps || state.config.lessons || [];
    state.caseStudies = state.config.caseStudies || [];
    state.rubricItems = state.config.rubricItems || [];
    state.selectedModel = state.config.selectedModel || "";

    await loadHistory();
    if (!getCurrentStep()) {
      state.activeStepId = state.basicSteps[0]?.id || "";
    }
    if (!getCurrentCase()) {
      state.activeCaseId = state.caseStudies[0]?.id || "";
    }

    renderModelOptions();
    state.currentAttempt = findLatestAttempt();
    loadPromptForActive();
    renderAll();
  } catch (error) {
    console.error(error);
    elements.resultSection.hidden = false;
    elements.assistantOutput.innerHTML = `<p class="empty-text">${escapeHtml(
      `初期化に失敗しました: ${error.message}`
    )}</p>`;
    setStatus("エラー");
  }
}

void init();

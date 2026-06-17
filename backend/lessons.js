export const rubricItems = [
  {
    id: "goal",
    label: "目的",
    maxScore: 4,
    description: "モデルに何を達成してほしいかが明確か"
  },
  {
    id: "success",
    label: "成功条件",
    maxScore: 4,
    description: "よい出力と判断できる条件が書かれているか"
  },
  {
    id: "constraints",
    label: "制約",
    maxScore: 4,
    description: "禁止事項、注意点、扱ってよい情報の範囲が明確か"
  },
  {
    id: "context",
    label: "背景（コンテキスト）",
    maxScore: 4,
    description: "対象者、場面、前提情報が十分か"
  },
  {
    id: "output",
    label: "出力形式",
    maxScore: 4,
    description: "形式、長さ、トーン、粒度が指定されているか"
  }
];

export const basicSteps = [
  {
    id: "basic-core",
    step: 1,
    displayLabel: "基本",
    title: "AI活用シーンからプロンプトを書く",
    shortTitle: "5観点で書く",
    estimatedMinutes: 5,
    focus: "",
    principles: ["目的", "成功条件", "制約", "背景（コンテキスト）", "出力形式"],
    evaluationRubricIds: ["goal", "success", "constraints", "context", "output"],
    guide:
      "AI活用シーンを読み、何を作るか、よい回答の条件、避けたいこと、背景、返してほしい形を1つの依頼にまとめます。",
    hint: "「何をしてほしいか」「何を満たせば成功か」「何を避けたいか」「誰に・どこで使うか」「どんな形でほしいか」を短く分けて書きます。",
    badExample: "週末の予定を考えて。",
    improvementPoints: [
      "目的を書く",
      "成功条件を2つ以上書く",
      "制約や避けたいことを書く",
      "背景（コンテキスト）を書く",
      "出力形式を書く"
    ],
    successChecklist: [
      "目的が明確",
      "成功条件が分かる",
      "制約が明確",
      "背景（コンテキスト）が分かる",
      "出力形式が指定されている"
    ],
    promptScenario:
      "あなたは、雨の日でも友人3人で楽しめる週末の過ごし方を提案してもらうためにAIを活用しようとしています。AIにどのように依頼しますか？",
    referenceItems: [
      { label: "日時", value: "土曜の午後" },
      { label: "人数", value: "友人3人" },
      { label: "天気", value: "雨の予報" },
      { label: "予算", value: "1人3000円以内" },
      { label: "移動", value: "家から30分以内" },
      { label: "避けたいこと", value: "長時間歩く、屋外だけに頼る" },
      { label: "背景", value: "初めて行く場所が少し苦手な友人がいる" },
      { label: "共有したい形", value: "3案を表にしてLINEで相談しやすくする" }
    ],
    sourceText:
      "土曜は午後から空いている。友人3人で過ごす。雨の予報。予算は1人3000円以内。家から30分以内で出かけたい。長時間歩くのは避けたい。友人の1人は初めて行く場所が少し苦手なので、移動が分かりやすい案がよい。LINEで相談するため、3案を表にして、各案におすすめ理由・所要時間・予算目安・注意点を付けたい。",
    starterPrompt:
      "Goal: 雨でも楽しめる週末の過ごし方を3案出してください。\n\nSuccess criteria:\n- 友人3人で楽しめる\n- 1人3000円以内に収まる\n- 家から30分以内で行ける\n- LINEで相談しやすい\n\nContext:\n- 土曜午後に友人3人で過ごす予定\n- 友人の1人は初めて行く場所が少し苦手\n- 雨の予報なので屋内中心で考えたい\n\nConstraints:\n- 長時間歩く案は避ける\n- 屋外だけに依存しない\n- 予算は1人3000円以内\n\nOutput:\n- 3案を表で出す\n- 各案におすすめ理由、所要時間、予算目安、注意点を入れる\n- 友人に共有しやすい短い表現にする\n\n材料:\n土曜は午後から空いている。友人3人で過ごす。雨の予報。予算は1人3000円以内。家から30分以内で出かけたい。長時間歩くのは避けたい。"
  }
];

export const caseStudies = [
  {
    id: "case-meeting",
    title: "会議後整理",
    shortTitle: "会議後整理",
    estimatedMinutes: 5,
    focus: "会議メモから、共有文・決定事項・次アクションを作る",
    audience: "営業企画チームのメンバー",
    promptScenario:
      "あなたは、会議メモからチームが次に動ける共有文を作るためにAIを活用しようとしています。AIにどのように依頼しますか？",
    sourceText:
      "6/14会議メモ: 新プランの提案資料は来週火曜までに初版を作る。価格表は山田さんが確認。顧客Aには導入事例を追加して説明。次回は6/21 10:00。顧客B向けの説明資料は情報が足りないので次回確認。",
    checklist: [
      "目的: 次に動ける共有文にする",
      "成功条件: 決定事項、担当者、期限、未確定事項が分かる",
      "背景: 営業企画チーム向け、チャット共有",
      "制約: メモにない担当者や期限を作らない",
      "出力形式: 箇条書きまたは表、250字以内"
    ],
    starterPrompt:
      "Role: あなたは営業企画チームのアシスタントです。\n\nGoal: 会議メモから、チームが次に動ける共有文を作ってください。\n\nSuccess criteria:\n- 決定事項、次アクション、未確定事項が分かれている\n- 担当者と期限が分かる\n- チームのチャットにそのまま貼れる\n\nContext:\n- 読み手は営業企画チームのメンバー\n- 会議後すぐに共有する想定\n\nConstraints:\n- メモにない担当者、期限、決定事項は作らない\n- 不明点は未確定事項に入れる\n\nOutput: 箇条書きで250字以内。\n\n会議メモ:\n6/14会議メモ: 新プランの提案資料は来週火曜までに初版を作る。価格表は山田さんが確認。顧客Aには導入事例を追加して説明。次回は6/21 10:00。顧客B向けの説明資料は情報が足りないので次回確認。"
  },
  {
    id: "case-request",
    title: "依頼文改善",
    shortTitle: "依頼文改善",
    estimatedMinutes: 5,
    focus: "曖昧な依頼メールを、相手が動ける文面に直す",
    audience: "社内のプロジェクト関係者",
    promptScenario:
      "あなたは、曖昧な確認依頼を相手がすぐ動ける社内メールへ直すためにAIを活用しようとしています。AIにどのように依頼しますか？",
    sourceText:
      "元の文: 資料について、できれば早めに確認お願いします。何かあれば教えてください。確認してほしいのは価格表、導入スケジュール、顧客向け説明の3点。明日15時までに返事がほしい。",
    checklist: [
      "目的: 確認依頼メールに直す",
      "成功条件: 依頼事項、期限、確認観点が分かる",
      "背景: 社内プロジェクト関係者向け",
      "制約: 命令口調にしない、元情報にない決定事項を足さない",
      "出力形式: 件名と本文、250字以内"
    ],
    starterPrompt:
      "Role: あなたはプロジェクト進行を支援するビジネス文書アシスタントです。\n\nGoal: 曖昧な確認依頼を、相手がすぐ動ける社内メールに書き直してください。\n\nSuccess criteria:\n- 依頼事項が1文目で分かる\n- 期限と確認観点が明確\n- 丁寧だが遠回しすぎない\n\nContext:\n- 読み手は同じプロジェクトの関係者\n- 今日中にレビュー依頼を送る想定\n\nConstraints:\n- 強い命令口調にしない\n- 元の文にない決定事項は追加しない\n- 不明点は追記候補として分ける\n\nOutput: 件名と本文に分けて、本文は250字以内。\n\n元の文:\n資料について、できれば早めに確認お願いします。何かあれば教えてください。確認してほしいのは価格表、導入スケジュール、顧客向け説明の3点。明日15時までに返事がほしい。"
  },
  {
    id: "case-proposal",
    title: "提案改善",
    shortTitle: "提案改善",
    estimatedMinutes: 5,
    focus: "提案文の断定的な主張と確認が必要な表現を見つけ、安全な表現に直す",
    audience: "提案責任者",
    promptScenario:
      "あなたは、顧客提出前の提案文にある断定的な主張や確認が必要な表現を見直すためにAIを活用しようとしています。AIにどのように依頼しますか？",
    sourceText:
      "提案文: 当社ツールにより問い合わせ対応を大幅に効率化できます。導入は短期間で完了し、現場負荷もほとんどありません。多くの企業で効果が出ています。",
    checklist: [
      "目的: 提案文のリスクをレビューする",
      "成功条件: 断定が強い表現、確認質問、安全な言い換えが出る",
      "背景: 顧客提出前、提案責任者向け",
      "制約: 効果や期間を断定しない、実績を発明しない",
      "出力形式: 表、確認質問、安全な言い換え"
    ],
    starterPrompt:
      "Role: あなたは提案書レビュー担当です。\n\nGoal: 提案文に含まれる、断定的な主張と確認すべき点を洗い出してください。\n\nSuccess criteria:\n- 断定が強い表現が具体的に分かる\n- 次に確認すべき質問が出ている\n- 顧客提出前に使える安全な言い換えがある\n\nContext:\n- 読み手は提案責任者\n- 顧客提出前のレビュー\n\nConstraints:\n- 効果、期間、現場負荷を断定しない\n- 実績や数値を発明しない\n- 不明点は確認質問にする\n\nOutput:\n- 「断定が強い表現」表\n- 「確認質問」3つ\n- 「安全な言い換え」1案\n\n提案文:\n当社ツールにより問い合わせ対応を大幅に効率化できます。導入は短期間で完了し、現場負荷もほとんどありません。多くの企業で効果が出ています。"
  }
];

export const lessons = basicSteps.map((step) => ({
  id: step.id,
  step: step.step,
  displayLabel: step.displayLabel,
  title: step.title,
  shortTitle: step.shortTitle,
  estimatedMinutes: step.estimatedMinutes,
  focus: step.focus,
  principles: step.principles,
  evaluationRubricIds: step.evaluationRubricIds,
  guide: step.guide,
  hint: step.hint,
  badExample: step.badExample,
  improvementPoints: step.improvementPoints,
  successChecklist: step.successChecklist,
  promptScenario: step.promptScenario,
  referenceItems: step.referenceItems,
  nextAction:
    step.step < basicSteps.length
      ? `${basicSteps[step.step]?.displayLabel || `STEP${step.step + 1}`}へ進みます。`
      : "実践演習へ進みます。",
  scenarios: [
    {
      id: `${step.id}-scenario`,
      title: step.title,
      audience: "日常タスク",
      referenceItems: step.referenceItems,
      sourceText: step.sourceText,
      starterPrompt: step.starterPrompt
    }
  ]
}));

export function getBasicStepById(stepId) {
  return basicSteps.find((step) => step.id === stepId) || null;
}

export function getCaseStudyById(caseId) {
  return caseStudies.find((caseStudy) => caseStudy.id === caseId) || null;
}

export function getLessonById(lessonId) {
  return lessons.find((lesson) => lesson.id === lessonId) || null;
}

export function getScenarioById(lesson, scenarioId) {
  if (!lesson) return null;
  return lesson.scenarios.find((scenario) => scenario.id === scenarioId) || null;
}

export function getLessonSummaries() {
  return lessons;
}

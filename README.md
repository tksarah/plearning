# プロンプト練習

ビジネスパーソン向け生成AI研修で使う、15分版のプロンプト練習Webアプリです。ログインなしで開き、基本演習で5観点をまとめて練習したあと、実践ケースを選んでプロンプトを完成させます。

## 特徴

- 15分版: 基本1演習 + 実践ケーススタディ
- OpenAIのプロンプト指針の考え方に沿った、目的・成功条件・背景（コンテキスト）・制約・出力形式の練習
- 基本・実践どちらも5観点の改善コメントを同じ形式で表示
- AIの回答を先に確認し、その下でプロンプト改善コメントを読める1カラム構成
- APIキーはサーバー側の環境変数で管理し、フロントエンドには渡さない
- `USE_MOCK_LLM=true` でAPIキーなしの動作確認が可能
- 履歴保存・履歴クリア、JSON/CSV/PDF/テキスト書き出しを維持
- CSVとテキストはWindowsで文字化けしにくいBOM付きUTF-8で出力
- PDF版はブラウザの印刷画面からPDF保存する方式

## 演習構成

### 基本演習

日常タスクを題材に、目的・成功条件・制約・背景（コンテキスト）・出力形式を1本のプロンプトにまとめます。実行後はAIの回答と5観点の改善コメントを表示します。

1. 基本: AI活用シーンからプロンプトを書く

### 実践演習

受講者はケースを選び、目的・成功条件・制約・背景・出力形式のチェックリストを見ながら1本のプロンプトにまとめます。フィードバックは基本演習と同じ5観点の改善コメントで確認します。

- 会議後整理
- 依頼文改善
- 提案改善

## セットアップ

```bash
npm install
```

既存のOpenAI APIキーを使う場合は、起動環境または `.env.local` に `OPENAI_API_KEY` を設定してください。キーの値はフロントエンドには送られません。

```bash
cp .env.example .env.local
```

ローカル確認だけなら、`.env.example` と同じく `USE_MOCK_LLM=true` のままで動きます。

## 起動

```bash
npm start
```

ブラウザで `http://localhost:3000` を開きます。

開発中は次も使えます。

```bash
npm run dev
```

## テスト

```bash
npm test
```

テストはmockモード相当で実行され、設定API、基本1演習、実践ケース、API validation、履歴保存・削除、旧履歴のフォールバックを確認します。

## API

- `GET /api/health`
- `GET /api/config`
- `POST /api/chat`
- `POST /api/attempts`
- `GET /api/history?clientId=...`
- `PUT /api/history?clientId=...`
- `DELETE /api/history?clientId=...`

`POST /api/attempts` は、基本演習では `exerciseType: "basic"` と `stepId`、実践演習では `exerciseType: "case"` と `caseId` を受け取ります。互換用に `lessons` 由来の軽量配列も `GET /api/config` に残しています。

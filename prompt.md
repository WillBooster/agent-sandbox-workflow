次のようなTypeScriptスクリプトを実装してください。

- ファイル名を`main.ts`とする。
- ランタイムにNode.jsを使用する。
- フォーマッタ、linterにBiomeを採用する。
- 演習用の模擬チケット（GitHubでいうissue）管理サービスagent-sandbox-backlogのAPIからチケットの一覧を取得する。
- チケット1から順に以下の手順を繰り返し、ソフトウェアを実装する。
  - APIを介してチケットの詳細を取得する。
  - `@anthropic-ai/claude-agent-sdk`を使用して実装する。このとき同時にテストコードも実装する。
  - `npm run format`を実行し、問題があれば実装ステップに戻る。
  - `npm run test`を実行し、問題があれば実装ステップに戻る。
  - 実装とは別のコンテキストのエージェントにコードレビューさせる。問題があれば実装ステップに戻る。ただし、コードレビューが妥当かを考えさせてから実装させる。妥当でないレビューに対しては反論のコメントを生成させる。
- 作業の過程を適度にログに出力する。
- 作業ディレクトリは`workspace/`とする。このディレクトリはgitignoreする。
- 1つのチケットが完了するごとに、成果物を`dist/`にコピーする。このディレクトリはgitignoreする。

## agent-sandbox-backlog

ベースURL: `https://willbooster.github.io/agent-sandbox-backlog`

### チケット一覧の取得

```
GET /api/tickets.json
```

レスポンス例:

```json
{
  "tickets": [
    { "id": 1, "title": "家計簿アプリの新規開発" },
    { "id": 2, "title": "CSV形式でのインポート・エクスポート機能" }
  ]
}
```

### チケット詳細の取得

```
GET /api/tickets/{id}.json
```

レスポンス例:

```json
{
  "id": 1,
  "title": "家計簿アプリの新規開発",
  "body": "ブラウザで動作する家計簿アプリを新規に開発する。..."
}
```

# Dashboard Agent API

Base URL comes from `HERMES_DASHBOARD_URL`. Send `Authorization: Bearer $HERMES_SYNC_TOKEN` on every request. The token is a dedicated Worker Secret; it is not a Flomo token or a blog API token.

Use `scripts/dashboard-api.mjs`. Do not put tokens on the command line.

## Start a run

`POST /api/agent/v1/runs`

```json
{
  "source": "flomo",
  "mode": "hourly",
  "windowStart": "2026-07-12",
  "windowEnd": "2026-07-13"
}
```

Response: `{ "runId": "run_..." }`.

## Read state

`GET /api/agent/v1/state?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`

The response contains known source versions, pending source IDs, last successful time, and the most recent blocked run. Use it before reading memo content.

## Complete a run

`POST /api/agent/v1/runs/:runId/complete`

Limits: at most 50 `sourceItems` and 50 `artifacts` per run. The server validates the whole body before one atomic D1 batch.

```json
{
  "discoveredCount": 42,
  "sourceItems": [
    {
      "sourceId": "memo-id",
      "sourceUpdatedAt": "2026-07-13T08:00:00Z",
      "contentHash": "sha256-hex",
      "decision": "candidate",
      "domain": "content",
      "decisionReason": "有明确判断和可验证案例"
    }
  ],
  "artifacts": [
    {
      "artifactKey": "topic:stable-key",
      "type": "topic",
      "domain": "content",
      "stage": "candidate",
      "title": "短标题",
      "summary": "不超过 500 字的脱敏摘要",
      "sourceIds": ["memo-id"],
      "targetPath": "06-内容创作/01-选题池/文件.md",
      "publicUrl": null,
      "status": "active"
    }
  ],
  "snapshot": {
    "periodLabel": "本周",
    "narrative": "本周最值得关注的一项真实进展。",
    "domains": {
      "work": { "label": "工作", "detail": "一条短状态", "status": "active" }
    }
  }
}
```

`discoveredCount` is the number of Flomo memos actually returned during this run, including unchanged versions omitted from `sourceItems`. It must be at least the number of submitted `sourceItems`.

Allowed decisions: `ignored`, `candidate`, `processed`, `blocked`.

Allowed artifact types: `knowledge`, `topic`, `draft`, `published`.

Allowed domains: `work`, `investing`, `knowledge`, `content`.

Forbidden fields include `content`, `body`, `rawMemo`, `attachments`, authorization headers, and signed attachment URLs. `sourceIds` identify provenance but never replace the memo body.

## Fail a run

`POST /api/agent/v1/runs/:runId/fail`

```json
{
  "code": "CHEN_NOTES_PULL_FAILED",
  "message": "远端同步失败",
  "retryable": true,
  "nextAction": "修复 GitHub 凭据后重试"
}
```

Do not submit raw tool errors if they contain secrets or memo content. Summarize the failure and keep the original error only in ephemeral local diagnostics.

## Script examples

```bash
node scripts/dashboard-api.mjs start --payload /tmp/run-start.json
node scripts/dashboard-api.mjs state --start-date 2026-07-12 --end-date 2026-07-13
node scripts/dashboard-api.mjs complete --run-id run_xxx --payload /tmp/run-complete.json
node scripts/dashboard-api.mjs fail --run-id run_xxx --payload /tmp/run-fail.json
```

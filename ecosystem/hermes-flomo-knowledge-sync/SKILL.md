---
name: hermes-flomo-knowledge-sync
description: Scan Flomo through its MCP, strictly select reusable ideas, distill approved knowledge into chen-notes, and report metadata-only progress to the private dashboard. Use for hourly, nightly, or 30-day reconcile knowledge sync runs; also use when diagnosing a blocked Flomo-to-dashboard run.
---

# Hermes Flomo Knowledge Sync

Treat Flomo as the only human input, chen-notes as the durable knowledge source, and the dashboard as a read-only projection. Never copy a Flomo token, complete memo body, attachment URL, cookie, or signed URL into the website payload, Git, logs, or summaries.

## Select a mode

Require exactly one mode: `hourly`, `nightly`, or `reconcile`.

Before calling the dashboard, read [references/dashboard-api.md](references/dashboard-api.md). Before reading or writing chen-notes, read [references/chen-notes-routing.md](references/chen-notes-routing.md).

Use `scripts/dashboard-api.mjs` for every dashboard request. It reads `HERMES_DASHBOARD_URL` and `HERMES_SYNC_TOKEN` from the environment and never prints the token.

Install or refresh the skill with `scripts/install.sh`. OpenClaw rejects skill symlinks that resolve outside its configured root, so the installer creates a managed copy under `~/.openclaw/workspace/skills/` and records its source path.

The installer also validates the Skill and idempotently registers three disabled OpenClaw cron jobs: hourly at minute 17, nightly at 22:40, and Sunday reconcile at 23:10 in `Asia/Shanghai`. Keep them disabled until the Flomo token has been rotated and all three jobs have passed a manual run. Set `HERMES_SKIP_CRON_INSTALL=1` only when installing into an environment without a Gateway.

## Common run protocol

1. Compute the date window in `Asia/Shanghai`.
2. Start a dashboard run and retain the returned `runId`.
3. Read dashboard state for the same window before querying Flomo.
4. Search Flomo only through its MCP. Do not create, update, or delete memos.
5. Count every memo returned by Flomo across the run, including unchanged versions, and send that total as `discoveredCount` when completing the run.
6. For each returned memo, compute a local SHA-256 content hash. Compare `sourceId`, `sourceUpdatedAt`, and `contentHash` with dashboard state.
7. Skip unchanged versions. Evaluate every new or modified version against the selection gate.
8. Finish with exactly one dashboard `complete` or `fail` call. A valid no-op still uses `complete` with empty artifacts and an accurate `discoveredCount`.
9. If dashboard submission fails, report `DASHBOARD_API_REJECTED`; do not claim the run succeeded.

The selection gate is strict. Select an idea only when it satisfies at least two of:

- contains a clear personal judgment;
- can be reused across tasks;
- includes a real case or evidence;
- advances active work or a concrete content output.

Register low-value items as `ignored`. Do not write them to chen-notes. Keep `decisionReason` specific and no longer than 300 characters.

## Hourly mode

1. Search today and yesterday separately so late edits are visible.
2. Compare all returned memo versions with dashboard state.
3. Record new or modified items as `ignored`, `candidate`, or `blocked`.
4. Do not write chen-notes in this mode.
5. If a single-day search returns exactly 50 items, fail with `FLOMO_WINDOW_SATURATED`; completeness cannot be established.

## Nightly mode

1. Reload the full content of pending candidates from Flomo and search related notes by relevant tags or keywords.
2. Run the chen-notes preflight exactly as documented. A dirty worktree or failed fast-forward pull is a hard stop.
3. Re-read the required repository and target-directory rules before every write.
4. Distill only candidates that still clear the gate. Reuse an existing note when possible; otherwise create a correctly named note with required frontmatter.
5. Stage only files changed by this run. Commit with `auto: <short description>` and push normally.
6. Mark items `processed` and report artifacts only after push succeeds. A local commit without a successful push is `CHEN_NOTES_PUSH_FAILED`.
7. Report knowledge entries, topics, drafts, published content, and a short global snapshot. Summaries must stand alone but must not contain the memo body.

Never run `git reset`, `git rebase`, `git clean`, force push, or overwrite another agent's changes.

## Reconcile mode

1. Search each of the most recent 30 Shanghai calendar days independently.
2. If any daily result contains exactly 50 items, stop and fail with `FLOMO_WINDOW_SATURATED`.
3. Re-evaluate only missing or changed versions.
4. If a previously known memo is no longer returned, retain its artifacts and mark the source unavailable in the decision reason. Never delete distilled work automatically.
5. Complete with an accurate snapshot; never claim full coverage after a saturated day.

## Failure mapping

Use only these error codes: `FLOMO_AUTH_FAILED`, `FLOMO_MCP_UNAVAILABLE`, `FLOMO_WINDOW_SATURATED`, `CHEN_NOTES_DIRTY`, `CHEN_NOTES_PULL_FAILED`, `CHEN_NOTES_PUSH_FAILED`, `DASHBOARD_API_REJECTED`.

Keep the failure message sanitized. Put the concrete recovery step in `nextAction`. Do not include shell environment values, HTTP authorization headers, memo text, or attachment links.

import { nanoid } from 'nanoid'
import { AgentRepositoryError } from '@/lib/agent-knowledge/errors'
import type {
  AgentSyncRun,
  AgentRunStartInput,
  AgentSourceItem,
  AgentSourceItemInput,
  CompleteAgentRunInput,
  FailAgentRunInput,
  KnowledgeArtifact,
  WeeklyDashboardMetrics,
} from '@/lib/agent-knowledge/types'

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export async function createAgentRun(db: D1Database, input: AgentRunStartInput): Promise<string> {
  const runId = `run_${nanoid(16)}`
  await db.prepare(`
    INSERT INTO agent_sync_runs (id, source, mode, status, window_start, window_end)
    VALUES (?, ?, ?, 'running', ?, ?)
  `).bind(runId, input.source, input.mode, input.windowStart, input.windowEnd).run()
  return runId
}

export async function getAgentState(db: D1Database, startDate: string, endDate: string) {
  const [itemsResult, lastSuccessful, blocked] = await Promise.all([
    db.prepare(`
      SELECT source_id, source_updated_at, content_hash, decision
      FROM agent_source_items
      WHERE substr(source_updated_at, 1, 10) BETWEEN ? AND ?
      ORDER BY source_updated_at ASC
    `).bind(startDate, endDate).all<{
      source_id: string
      source_updated_at: string
      content_hash: string
      decision: string
    }>(),
    db.prepare(`
      SELECT finished_at FROM agent_sync_runs
      WHERE status = 'succeeded'
      ORDER BY finished_at DESC LIMIT 1
    `).first<{ finished_at: number }>(),
    db.prepare(`
      SELECT id, mode, status, error_code, error_message, snapshot_json, finished_at
      FROM agent_sync_runs
      WHERE status IN ('blocked', 'failed')
      ORDER BY COALESCE(finished_at, started_at) DESC LIMIT 1
    `).first<Record<string, unknown>>(),
  ])

  return {
    lastSuccessfulAt: lastSuccessful?.finished_at ?? null,
    items: itemsResult.results.map((item) => ({
      sourceId: item.source_id,
      sourceUpdatedAt: item.source_updated_at,
      contentHash: item.content_hash,
    })),
    pendingSourceIds: itemsResult.results
      .filter((item) => item.decision === 'candidate' || item.decision === 'blocked')
      .map((item) => item.source_id),
    blocked: blocked ? {
      id: blocked.id,
      mode: blocked.mode,
      status: blocked.status,
      errorCode: blocked.error_code,
      errorMessage: blocked.error_message,
      finishedAt: blocked.finished_at,
      ...parseJson(blocked.snapshot_json, {}),
    } : null,
  }
}

function processedAt(item: AgentSourceItemInput, now: number) {
  return item.decision === 'processed' || item.decision === 'ignored' ? now : null
}

function noNewerSourceVersion(input: CompleteAgentRunInput, runId: string) {
  if (input.sourceItems.length === 0) return { sql: '1 = 1', values: [] as unknown[] }
  const clauses = input.sourceItems.map(() => (
    `(current.source_id = ? AND (
      current.source_updated_at > ?
      OR (current.source_updated_at = ? AND
        COALESCE((SELECT rowid FROM agent_sync_runs WHERE id = current.last_run_id), 0) >
        COALESCE((SELECT rowid FROM agent_sync_runs WHERE id = ?), 0)
      )
    ))`
  ))
  return {
    sql: `NOT EXISTS (
      SELECT 1 FROM agent_source_items current
      WHERE ${clauses.join(' OR ')}
    )`,
    values: input.sourceItems.flatMap((item) => [
      item.sourceId,
      item.sourceUpdatedAt,
      item.sourceUpdatedAt,
      runId,
    ]),
  }
}

function noNewerArtifactVersion(input: CompleteAgentRunInput, runId: string) {
  if (input.artifacts.length === 0) return { sql: '1 = 1', values: [] as unknown[] }
  const clauses = input.artifacts.map(() => (
    `(current.artifact_key = ? AND
      COALESCE((SELECT rowid FROM agent_sync_runs WHERE id = current.last_run_id), 0) >
      COALESCE((SELECT rowid FROM agent_sync_runs WHERE id = ?), 0)
    )`
  ))
  return {
    sql: `NOT EXISTS (
      SELECT 1 FROM knowledge_artifacts current
      WHERE ${clauses.join(' OR ')}
    )`,
    values: input.artifacts.flatMap((artifact) => [artifact.artifactKey, runId]),
  }
}

function noNewerBatchVersion(input: CompleteAgentRunInput, runId: string) {
  const sourceGuard = noNewerSourceVersion(input, runId)
  const artifactGuard = noNewerArtifactVersion(input, runId)
  return {
    sql: `(${sourceGuard.sql}) AND (${artifactGuard.sql})`,
    values: [...sourceGuard.values, ...artifactGuard.values],
  }
}

export async function completeAgentRun(
  db: D1Database,
  runId: string,
  input: CompleteAgentRunInput,
): Promise<{ idempotent: boolean }> {
  const run = await db.prepare('SELECT status FROM agent_sync_runs WHERE id = ? LIMIT 1')
    .bind(runId).first<{ status: string }>()
  if (!run) throw new AgentRepositoryError('运行记录不存在', 404)
  if (run.status === 'succeeded') return { idempotent: true }
  if (run.status !== 'running') throw new AgentRepositoryError('运行记录已结束，不能完成', 409)

  const now = Math.floor(Date.now() / 1000)
  const statements: D1PreparedStatement[] = []
  const versionGuard = noNewerBatchVersion(input, runId)
  for (const item of input.sourceItems) {
    statements.push(db.prepare(`
      INSERT INTO agent_source_items (
        source_id, source_updated_at, content_hash, decision, domain, decision_reason,
        first_seen_at, last_seen_at, processed_at, last_run_id
      ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM agent_sync_runs WHERE id = ? AND status = 'running'
      ) AND ${versionGuard.sql}
      ON CONFLICT(source_id) DO UPDATE SET
        source_updated_at = excluded.source_updated_at,
        content_hash = excluded.content_hash,
        decision = excluded.decision,
        domain = excluded.domain,
        decision_reason = excluded.decision_reason,
        last_seen_at = excluded.last_seen_at,
        processed_at = excluded.processed_at,
        last_run_id = excluded.last_run_id
      WHERE excluded.source_updated_at > agent_source_items.source_updated_at
         OR (excluded.source_updated_at = agent_source_items.source_updated_at
             AND COALESCE((SELECT rowid FROM agent_sync_runs WHERE id = excluded.last_run_id), 0) >
                 COALESCE((SELECT rowid FROM agent_sync_runs WHERE id = agent_source_items.last_run_id), 0))
    `).bind(
      item.sourceId,
      item.sourceUpdatedAt,
      item.contentHash,
      item.decision,
      item.domain,
      item.decisionReason,
      now,
      now,
      processedAt(item, now),
      runId,
      runId,
      ...versionGuard.values,
    ))
  }

  for (const artifact of input.artifacts) {
    statements.push(db.prepare(`
      INSERT INTO knowledge_artifacts (
        artifact_key, type, domain, stage, title, summary, source_ids_json,
        target_path, public_url, status, first_seen_at, updated_at, last_run_id
      ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM agent_sync_runs WHERE id = ? AND status = 'running'
      ) AND ${versionGuard.sql}
      ON CONFLICT(artifact_key) DO UPDATE SET
        type = excluded.type,
        domain = excluded.domain,
        stage = excluded.stage,
        title = excluded.title,
        summary = excluded.summary,
        source_ids_json = excluded.source_ids_json,
        target_path = excluded.target_path,
        public_url = excluded.public_url,
        status = excluded.status,
        updated_at = excluded.updated_at,
        last_run_id = excluded.last_run_id
      WHERE COALESCE((SELECT rowid FROM agent_sync_runs WHERE id = excluded.last_run_id), 0) >
            COALESCE((SELECT rowid FROM agent_sync_runs WHERE id = knowledge_artifacts.last_run_id), 0)
    `).bind(
      artifact.artifactKey,
      artifact.type,
      artifact.domain,
      artifact.stage,
      artifact.title,
      artifact.summary,
      JSON.stringify(artifact.sourceIds),
      artifact.targetPath ?? null,
      artifact.publicUrl ?? null,
      artifact.status ?? 'active',
      now,
      now,
      runId,
      runId,
      ...versionGuard.values,
    ))
  }

  const selectedCount = input.sourceItems.filter((item) => item.decision !== 'ignored').length
  statements.push(db.prepare(`
    UPDATE agent_sync_runs
    SET status = 'succeeded', discovered_count = ?, selected_count = ?, artifact_count = ?,
        snapshot_json = ?, error_code = NULL, error_message = NULL, finished_at = ?
    WHERE id = ? AND status = 'running' AND ${versionGuard.sql}
  `).bind(
    input.discoveredCount,
    selectedCount,
    input.artifacts.length,
    input.snapshot ? JSON.stringify(input.snapshot) : null,
    now,
    runId,
    ...versionGuard.values,
  ))

  const results = await db.batch(statements)
  const completed = results.at(-1)?.meta?.changes
  if (completed === 0) {
    const current = await db.prepare('SELECT status FROM agent_sync_runs WHERE id = ? LIMIT 1')
      .bind(runId).first<{ status: string }>()
    if (current?.status === 'succeeded') return { idempotent: true }
    if (!current) throw new AgentRepositoryError('运行记录不存在', 404)
    throw new AgentRepositoryError('运行记录状态或来源版本已变化', 409)
  }
  return { idempotent: false }
}

export async function failAgentRun(
  db: D1Database,
  runId: string,
  input: FailAgentRunInput,
): Promise<void> {
  const status = input.code.startsWith('CHEN_NOTES_') || input.code === 'FLOMO_WINDOW_SATURATED'
    ? 'blocked'
    : 'failed'
  const result = await db.prepare(`
    UPDATE agent_sync_runs
    SET status = ?, error_code = ?, error_message = ?,
        snapshot_json = ?, finished_at = strftime('%s', 'now')
    WHERE id = ? AND status = 'running'
  `).bind(
    status,
    input.code,
    input.message,
    JSON.stringify({ retryable: input.retryable, nextAction: input.nextAction }),
    runId,
  ).run()
  if ((result.meta.changes ?? 0) === 0) {
    const current = await db.prepare('SELECT status FROM agent_sync_runs WHERE id = ? LIMIT 1')
      .bind(runId).first<{ status: string }>()
    if (!current) throw new AgentRepositoryError('运行记录不存在', 404)
    throw new AgentRepositoryError('运行记录已结束，不能重复标记失败', 409)
  }
}

export async function getKnowledgeDashboardData(db: D1Database): Promise<{
  latestRun: AgentSyncRun | null
  sourceItems: AgentSourceItem[]
  artifacts: KnowledgeArtifact[]
  weeklyMetrics: WeeklyDashboardMetrics
}> {
  const shanghaiOffsetMs = 8 * 60 * 60 * 1000
  const shanghaiWeekStart = new Date(Date.now() + shanghaiOffsetMs)
  const day = shanghaiWeekStart.getUTCDay() || 7
  shanghaiWeekStart.setUTCDate(shanghaiWeekStart.getUTCDate() - day + 1)
  shanghaiWeekStart.setUTCHours(0, 0, 0, 0)
  const weekStartSeconds = Math.floor((shanghaiWeekStart.getTime() - shanghaiOffsetMs) / 1000)

  const [runRow, sourceRows, artifactRows, runMetricRow, artifactMetricRow] = await Promise.all([
    db.prepare(`
      SELECT * FROM agent_sync_runs
      ORDER BY started_at DESC LIMIT 1
    `).first<Record<string, unknown>>(),
    db.prepare(`
      SELECT * FROM agent_source_items
      WHERE last_seen_at >= ?
      ORDER BY last_seen_at DESC LIMIT 200
    `).bind(weekStartSeconds).all<Record<string, unknown>>(),
    db.prepare(`
      SELECT * FROM knowledge_artifacts
      WHERE status <> 'archived'
      ORDER BY updated_at DESC LIMIT 30
    `).all<Record<string, unknown>>(),
    db.prepare(`
      SELECT COALESCE(sum(discovered_count), 0) AS checked_count
      FROM agent_sync_runs
      WHERE status = 'succeeded' AND finished_at >= ?
    `).bind(weekStartSeconds).first<{ checked_count: number }>(),
    db.prepare(`
      SELECT
        sum(CASE WHEN type = 'knowledge' AND status = 'active' THEN 1 ELSE 0 END) AS knowledge_count,
        sum(CASE WHEN type = 'published' AND status = 'active' THEN 1 ELSE 0 END) AS published_count
      FROM knowledge_artifacts
      WHERE updated_at >= ?
    `).bind(weekStartSeconds).first<{ knowledge_count: number | null; published_count: number | null }>(),
  ])

  const snapshotPayload = runRow ? parseJson<Record<string, unknown>>(runRow.snapshot_json, {}) : {}
  const latestRun: AgentSyncRun | null = runRow ? {
    id: String(runRow.id),
    source: 'flomo',
    mode: runRow.mode as AgentSyncRun['mode'],
    status: runRow.status as AgentSyncRun['status'],
    windowStart: String(runRow.window_start),
    windowEnd: String(runRow.window_end),
    discoveredCount: Number(runRow.discovered_count || 0),
    selectedCount: Number(runRow.selected_count || 0),
    artifactCount: Number(runRow.artifact_count || 0),
    errorCode: runRow.error_code ? String(runRow.error_code) : null,
    errorMessage: runRow.error_message ? String(runRow.error_message) : null,
    snapshot: snapshotPayload.domains && snapshotPayload.narrative
      ? snapshotPayload as unknown as AgentSyncRun['snapshot']
      : null,
    failure: typeof snapshotPayload.nextAction === 'string'
      ? {
          retryable: Boolean(snapshotPayload.retryable),
          nextAction: snapshotPayload.nextAction,
        }
      : null,
    startedAt: Number(runRow.started_at),
    finishedAt: runRow.finished_at == null ? null : Number(runRow.finished_at),
  } : null

  const sourceItems: AgentSourceItem[] = sourceRows.results.map((row) => ({
    sourceId: String(row.source_id),
    sourceUpdatedAt: String(row.source_updated_at),
    contentHash: String(row.content_hash),
    decision: row.decision as AgentSourceItem['decision'],
    domain: row.domain as AgentSourceItem['domain'],
    decisionReason: String(row.decision_reason),
    firstSeenAt: Number(row.first_seen_at),
    lastSeenAt: Number(row.last_seen_at),
    processedAt: row.processed_at == null ? null : Number(row.processed_at),
    lastRunId: String(row.last_run_id),
  }))

  const artifacts: KnowledgeArtifact[] = artifactRows.results.map((row) => ({
    artifactKey: String(row.artifact_key),
    type: row.type as KnowledgeArtifact['type'],
    domain: row.domain as KnowledgeArtifact['domain'],
    stage: String(row.stage),
    title: String(row.title),
    summary: String(row.summary),
    sourceIds: parseJson<string[]>(row.source_ids_json, []),
    targetPath: row.target_path ? String(row.target_path) : null,
    publicUrl: row.public_url ? String(row.public_url) : null,
    status: row.status as KnowledgeArtifact['status'],
    firstSeenAt: Number(row.first_seen_at),
    updatedAt: Number(row.updated_at),
  }))

  return {
    latestRun,
    sourceItems,
    artifacts,
    weeklyMetrics: {
      checkedCount: Number(runMetricRow?.checked_count || 0),
      knowledgeCount: Number(artifactMetricRow?.knowledge_count || 0),
      publishedCount: Number(artifactMetricRow?.published_count || 0),
    },
  }
}

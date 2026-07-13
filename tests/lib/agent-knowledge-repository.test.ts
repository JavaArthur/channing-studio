import { describe, expect, it, vi } from 'vitest'
import { AgentRepositoryError } from '@/lib/agent-knowledge/errors'
import { completeAgentRun, failAgentRun } from '@/lib/agent-knowledge/repository'

function createDb(runStatus: string | null, batchChanges = 1, runChanges = 1) {
  const prepared: Array<{ sql: string; values: unknown[] }> = []
  const batch = vi.fn().mockResolvedValue([
    { meta: { changes: 1 } },
    { meta: { changes: 1 } },
    { meta: { changes: batchChanges } },
  ])
  const db = {
    prepare(sql: string) {
      const record = { sql, values: [] as unknown[] }
      prepared.push(record)
      return {
        bind(...values: unknown[]) {
          record.values = values
          return this
        },
        first: vi.fn().mockResolvedValue(runStatus ? { status: runStatus } : null),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ meta: { last_row_id: 0, changes: runChanges } }),
      }
    },
    batch,
  } as unknown as D1Database
  return { db, batch, prepared }
}

const completion = {
  discoveredCount: 8,
  sourceItems: [{
    sourceId: 'memo-1',
    sourceUpdatedAt: '2026-07-13T08:00:00Z',
    contentHash: 'hash-1',
    decision: 'processed' as const,
    domain: 'knowledge' as const,
    decisionReason: '有个人判断和复用价值',
  }],
  artifacts: [{
    artifactKey: 'knowledge:agent-boundary',
    type: 'knowledge' as const,
    domain: 'knowledge' as const,
    stage: 'distilled',
    title: 'Agent 安全边界',
    summary: '只保留可公开的结论与来源标识。',
    sourceIds: ['memo-1'],
  }],
  snapshot: null,
}

describe('agent knowledge repository', () => {
  it('submits source, artifact and run completion as one atomic D1 batch', async () => {
    const { db, batch, prepared } = createDb('running')

    await expect(completeAgentRun(db, 'run-1', completion)).resolves.toEqual({ idempotent: false })

    expect(batch).toHaveBeenCalledTimes(1)
    expect(batch.mock.calls[0][0]).toHaveLength(3)
    const sourceUpsert = prepared.find((statement) => statement.sql.includes('agent_source_items'))
    expect(sourceUpsert?.sql).toContain('excluded.source_updated_at > agent_source_items.source_updated_at')
    expect(sourceUpsert?.sql).toContain('knowledge_artifacts current')
    expect(sourceUpsert?.sql).toContain('current.last_run_id')
    expect(sourceUpsert?.sql).toContain("status = 'running'")
    const artifactUpsert = prepared.find((statement) => statement.sql.includes('INSERT INTO knowledge_artifacts'))
    expect(artifactUpsert?.sql).toContain('NOT EXISTS')
    expect(artifactUpsert?.sql).toContain('last_run_id = excluded.last_run_id')
    expect(artifactUpsert?.sql).toContain('knowledge_artifacts.last_run_id')
    const completionUpdate = prepared.find((statement) => statement.sql.includes("SET status = 'succeeded'"))
    expect(completionUpdate?.values[0]).toBe(8)
  })

  it('makes a repeated completed run a no-op', async () => {
    const { db, batch } = createDb('succeeded')

    await expect(completeAgentRun(db, 'run-1', completion)).resolves.toEqual({ idempotent: true })
    expect(batch).not.toHaveBeenCalled()
  })

  it('treats a concurrent completion that lost the run claim as idempotent', async () => {
    const { db, batch } = createDb('running', 0)
    let firstCall = true
    const originalPrepare = db.prepare.bind(db)
    db.prepare = ((sql: string) => {
      const statement = originalPrepare(sql)
      if (sql.includes('SELECT status FROM agent_sync_runs')) {
        statement.first = vi.fn().mockImplementation(async () => {
          if (firstCall) {
            firstCall = false
            return { status: 'running' }
          }
          return { status: 'succeeded' }
        })
      }
      return statement
    }) as D1Database['prepare']

    await expect(completeAgentRun(db, 'run-1', completion)).resolves.toEqual({ idempotent: true })
    expect(batch).toHaveBeenCalledTimes(1)
  })

  it('does not report a failed run update that changed no row as successful', async () => {
    const payload = {
      code: 'CHEN_NOTES_PULL_FAILED' as const,
      message: '远端同步失败',
      retryable: true,
      nextAction: '修复凭据后重试',
    }
    const missing = createDb(null, 1, 0)
    await expect(failAgentRun(missing.db, 'missing', payload))
      .rejects.toEqual(new AgentRepositoryError('运行记录不存在', 404))

    const completed = createDb('succeeded', 1, 0)
    await expect(failAgentRun(completed.db, 'run-1', payload))
      .rejects.toEqual(new AgentRepositoryError('运行记录已结束，不能重复标记失败', 409))
  })
})

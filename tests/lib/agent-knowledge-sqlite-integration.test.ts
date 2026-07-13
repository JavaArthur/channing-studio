import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { AgentRepositoryError } from '@/lib/agent-knowledge/errors'
import { completeAgentRun } from '@/lib/agent-knowledge/repository'
import type { CompleteAgentRunInput } from '@/lib/agent-knowledge/types'

class LocalStatement {
  constructor(
    private readonly database: DatabaseSync,
    private readonly sql: string,
    private readonly values: unknown[] = [],
  ) {}

  bind(...values: unknown[]) {
    return new LocalStatement(this.database, this.sql, values)
  }

  async first<T>() {
    const statement = this.database.prepare(this.sql)
    return (statement.get(...this.values as Parameters<typeof statement.get>) ?? null) as T | null
  }

  async all<T>() {
    const statement = this.database.prepare(this.sql)
    return { results: statement.all(...this.values as Parameters<typeof statement.all>) as T[] }
  }

  async run() {
    const result = this.execute()
    return { meta: { last_row_id: Number(result.lastInsertRowid), changes: Number(result.changes) } }
  }

  execute() {
    const statement = this.database.prepare(this.sql)
    return statement.run(...this.values as Parameters<typeof statement.run>)
  }
}

class LocalD1 {
  constructor(readonly database: DatabaseSync) {}

  prepare(sql: string) {
    return new LocalStatement(this.database, sql)
  }

  async batch(statements: LocalStatement[]) {
    this.database.exec('BEGIN IMMEDIATE')
    try {
      const results = statements.map((statement) => {
        const result = statement.execute()
        return { meta: { changes: Number(result.changes) } }
      })
      this.database.exec('COMMIT')
      return results
    } catch (error) {
      this.database.exec('ROLLBACK')
      throw error
    }
  }
}

function completion(label: string): CompleteAgentRunInput {
  return {
    discoveredCount: 1,
    sourceItems: [{
      sourceId: 'memo-1',
      sourceUpdatedAt: '2026-07-13T08:00:00Z',
      contentHash: `hash-${label}`,
      decision: label === 'newer' ? 'processed' : 'candidate',
      domain: 'knowledge',
      decisionReason: `${label} run decision`,
    }],
    artifacts: [{
      artifactKey: 'knowledge:agent-boundary',
      type: 'knowledge',
      domain: 'knowledge',
      stage: 'distilled',
      title: `${label} artifact`,
      summary: `${label} summary`,
      sourceIds: ['memo-1'],
    }],
    snapshot: null,
  }
}

describe('agent knowledge SQLite integration', () => {
  const databases: DatabaseSync[] = []

  afterEach(() => {
    databases.splice(0).forEach((database) => database.close())
  })

  it('rejects a delayed old run without changing source, artifact, or run state', async () => {
    const database = new DatabaseSync(':memory:')
    databases.push(database)
    database.exec('PRAGMA foreign_keys = ON')
    for (const migration of [
      'db/migrations/2026-07-13-add-agent-knowledge-loop.sql',
      'db/migrations/2026-07-13-add-artifact-run-version.sql',
      'db/migrations/2026-07-13-enforce-artifact-run-version.sql',
    ]) {
      database.exec(readFileSync(resolve(migration), 'utf8'))
    }
    const d1 = new LocalD1(database) as unknown as D1Database
    const insertRun = database.prepare(`
      INSERT INTO agent_sync_runs (id, source, mode, status, window_start, window_end)
      VALUES (?, 'flomo', 'nightly', 'running', '2026-07-13', '2026-07-13')
    `)
    insertRun.run('run-old')
    insertRun.run('run-newer')

    await expect(completeAgentRun(d1, 'run-newer', completion('newer')))
      .resolves.toEqual({ idempotent: false })
    const before = {
      source: database.prepare('SELECT * FROM agent_source_items').get(),
      artifact: database.prepare('SELECT * FROM knowledge_artifacts').get(),
      run: database.prepare("SELECT * FROM agent_sync_runs WHERE id = 'run-old'").get(),
    }

    await expect(completeAgentRun(d1, 'run-old', completion('old')))
      .rejects.toEqual(new AgentRepositoryError('运行记录状态或来源版本已变化', 409))
    expect({
      source: database.prepare('SELECT * FROM agent_source_items').get(),
      artifact: database.prepare('SELECT * FROM knowledge_artifacts').get(),
      run: database.prepare("SELECT * FROM agent_sync_runs WHERE id = 'run-old'").get(),
    }).toEqual(before)

    insertRun.run('run-latest')
    await expect(completeAgentRun(d1, 'run-latest', completion('latest')))
      .resolves.toEqual({ idempotent: false })
    expect(database.prepare('SELECT last_run_id FROM agent_source_items').get())
      .toEqual({ last_run_id: 'run-latest' })
    expect(database.prepare('SELECT title, last_run_id FROM knowledge_artifacts').get())
      .toEqual({ title: 'latest artifact', last_run_id: 'run-latest' })
  })
})

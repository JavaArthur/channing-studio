import { DatabaseSync } from 'node:sqlite'
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

  batchResult() {
    const statement = this.database.prepare(this.sql)
    if (statement.columns().length) {
      return { results: statement.all(...this.values as Parameters<typeof statement.all>), meta: { changes: 0 } }
    }
    const result = this.execute()
    return { results: [], meta: { changes: Number(result.changes) } }
  }
}

export class LocalD1 {
  constructor(readonly database: DatabaseSync) {}

  prepare(sql: string) {
    return new LocalStatement(this.database, sql)
  }

  async batch(statements: LocalStatement[]) {
    this.database.exec('BEGIN IMMEDIATE')
    try {
      const results = statements.map((statement) => statement.batchResult())
      this.database.exec('COMMIT')
      return results
    } catch (error) {
      this.database.exec('ROLLBACK')
      throw error
    }
  }
}

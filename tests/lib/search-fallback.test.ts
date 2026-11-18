import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalD1 } from '../helpers/local-d1'
import { searchPosts } from '@/lib/repositories/search'
import { getPostBySlug } from '@/lib/repositories/posts'
import { getRelatedPosts } from '@/lib/related-content'
import type { Database } from '@/lib/repositories/schema'

let sqlite: DatabaseSync
let nativeLike: DatabaseSync
let db: Database
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  nativeLike = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync('db/schema.sql', 'utf8'))
  // Node SQLite permits 50,000 bytes; D1 permits only 50. Model the actual database boundary.
  sqlite.function('like', (pattern, value) => {
    if (new TextEncoder().encode(String(pattern)).length > 50) {
      throw new Error('LIKE or GLOB pattern too complex')
    }
    const row = nativeLike.prepare('SELECT ? LIKE ? AS matched').get(value, pattern) as { matched: number }
    return row.matched
  })
  db = new LocalD1(sqlite) as unknown as Database
})
afterEach(() => {
  sqlite.close()
  nativeLike.close()
})

function insertPost(slug: string, title: string, content = '') {
  sqlite.prepare(`INSERT INTO posts (slug,title,content,html,status,category,tags)
    VALUES (?, ?, ?, '', 'published', '工程', '["Agent","工程"]')`)
    .run(slug, title, content)
}

describe('D1 search fallback without FTS', () => {
  it('reproduces the D1 limit for a 59-byte related pattern', () => {
    const pattern = '%让 Agent 在可靠的边界内工作 工程 Agent 工程%'
    expect(new TextEncoder().encode(pattern)).toHaveLength(59)
    expect(() => sqlite.prepare('SELECT ? LIKE ?').get('content', pattern))
      .toThrow('LIKE or GLOB pattern too complex')
  })

  it.each(['边界'.repeat(9), 'x'.repeat(49), '🙂'.repeat(13)])('matches complete long text without truncating: %s', async query => {
    insertPost('title-hit', `Before ${query} after`)
    insertPost('body-hit', 'Other title', `Before ${query} after`)
    insertPost('prefix-only', query.slice(0, -2))
    expect((await searchPosts(db, query)).map(post => post.slug).sort()).toEqual(['body-hit', 'title-hit'])
  })

  it('preserves short LIKE matching and ASCII case-insensitive long matching', async () => {
    insertPost('short', 'Agent engineering')
    const query = 'Long Agent title with enough text to exceed the D1 pattern limit'
    insertPost('long', query.toUpperCase())
    expect((await searchPosts(db, 'agent eng')).map(post => post.slug)).toEqual(['short'])
    expect((await searchPosts(db, query)).map(post => post.slug)).toEqual(['long'])
    insertPost('boundary', 'a'.repeat(48))
    expect((await searchPosts(db, 'a'.repeat(48))).map(post => post.slug)).toEqual(['boundary'])
  })

  it('retains public visibility filters and limits for long matches', async () => {
    const title = '长标题'.repeat(8)
    for (const slug of ['public', 'second', 'draft', 'hidden', 'encrypted', 'deleted']) insertPost(slug, title)
    sqlite.exec("UPDATE posts SET status='draft' WHERE slug='draft'")
    sqlite.exec("UPDATE posts SET is_hidden=1 WHERE slug='hidden'")
    sqlite.exec("UPDATE posts SET password='locked' WHERE slug='encrypted'")
    sqlite.exec("UPDATE posts SET deleted_at=1 WHERE slug='deleted'")
    expect((await searchPosts(db, title)).map(post => post.slug).sort()).toEqual(['public', 'second'])
    expect(await searchPosts(db, title, 1)).toHaveLength(1)
  })

  it('allows related scoring to run when the metadata query exceeds the D1 LIKE limit', async () => {
    insertPost('qa-agent-boundaries', '让 Agent 在可靠的边界内工作', '普通正文')
    insertPost('related', 'Agent 工程实践')
    const post = await getPostBySlug(db, 'qa-agent-boundaries')
    expect(post).not.toBeNull()
    const result = await getRelatedPosts(db, null, post!)
    expect(result.source).toBe('rules')
    expect(result.results.map(item => item.slug)).toEqual(['related'])
  })
})

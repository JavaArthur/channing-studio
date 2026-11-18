import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalD1 } from '../helpers/local-d1'
import type { Database } from '@/lib/repositories/schema'
import { getTools } from '@/lib/repositories/tools'
import { getPrompts, getPromptSummaries } from '@/lib/repositories/prompts'
import { getSiteHeaderData } from '@/lib/site'
import { getFeaturedPosts, getPosts } from '@/lib/repositories/posts'
import { selectFeaturedPosts } from '@/lib/studio-home'

let sqlite: DatabaseSync
let db: Database
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync('db/schema.sql', 'utf8'))
  db = new LocalD1(sqlite) as unknown as Database
})
afterEach(() => sqlite.close())

function seedResources() {
  for (let id = 1; id <= 12; id++) {
    const common = { is_pinned: id === 8 ? 1 : 0, sort_order: 12 - id, tags: ['public'] }
    const tool = { ...common, name: `Public tool ${id}`, description: 'Reviewed tool', url: 'https://example.com', type: 'url', icon: null }
    const prompt = { ...common, title: `Public prompt ${id}`, description: 'Reviewed prompt', prompt: 'Large body '.repeat(1000), category: 'public', source_url: null }
    // Working copies intentionally disagree with published metadata and ordering.
    sqlite.prepare(`INSERT INTO tools (id,name,is_hidden,is_pinned,sort_order,published_payload,created_at)
      VALUES (?, 'Private tool', ?, 0, ?, ?, ?)`)
      .run(id, id === 8 ? 1 : 0, id, id === 12 ? null : JSON.stringify(tool), id)
    sqlite.prepare(`INSERT INTO prompts (id,title,prompt,is_hidden,is_pinned,sort_order,published_payload,updated_at)
      VALUES (?, 'Private prompt', 'Private body', ?, 0, ?, ?, ?)`)
      .run(id, id === 8 ? 1 : 0, id, id === 12 ? null : JSON.stringify(prompt), id)
  }
}

describe('bounded homepage queries', () => {
  it('limits tools in SQL while preserving published visibility, ordering and the full-list default', async () => {
    seedResources()
    const all = await getTools(db)
    const prepare = vi.spyOn(db, 'prepare')
    expect(await getTools(db, { limit: 3 })).toEqual(all.slice(0, 3))
    expect(prepare.mock.calls[0][0]).toMatch(/LIMIT \?/)
    expect(all).toHaveLength(10)
    expect(all.map(tool => tool.id)).toEqual([11, 10, 9, 7, 6, 5, 4, 3, 2, 1])
    expect(all[0].name).toBe('Public tool 11')
    expect(await getTools(db, { limit: 0 })).toEqual([])
    expect(await getTools(db, { includeHidden: true, limit: 1 })).toMatchObject([{ name: 'Private tool' }])
  })

  it('returns only two public prompt card summaries without selecting any prompt body', async () => {
    seedResources()
    const full = await getPrompts(db)
    const prepare = vi.spyOn(db, 'prepare')
    const summaries = await getPromptSummaries(db, 2)
    expect(summaries).toEqual(full.slice(0, 2).map(({ id, title, description }) => ({ id, title, description })))
    expect(summaries).toEqual([
      { id: 11, title: 'Public prompt 11', description: 'Reviewed prompt' },
      { id: 10, title: 'Public prompt 10', description: 'Reviewed prompt' },
    ])
    const sql = prepare.mock.calls[0][0]
    expect(sql).toMatch(/LIMIT \?/)
    expect(sql).not.toContain("'$.prompt'")
    expect(sql).not.toContain('SELECT *')
    expect(await getPromptSummaries(db, 0)).toEqual([])
  })

  it('uses published pin priority for prompt cards and tools', async () => {
    seedResources()
    sqlite.exec('UPDATE tools SET is_hidden=0 WHERE id=8; UPDATE prompts SET is_hidden=0 WHERE id=8')
    expect((await getTools(db, { limit: 1 }))[0].id).toBe(8)
    expect((await getPromptSummaries(db, 1))[0].id).toBe(8)
  })

  it('preserves featured fallback, including configured slugs beyond the featured-query cap', async () => {
    for (let id = 1; id <= 30; id++) {
      sqlite.prepare(`INSERT INTO posts (slug,title,content,html,status,is_hidden,published_at)
        VALUES (?, ?, '', '', 'published', ?, ?)`)
        .run(`post-${id}`, `Post ${id}`, id === 29 ? 1 : 0, id)
    }
    sqlite.exec("UPDATE posts SET password='protected' WHERE slug='post-28'")
    sqlite.exec("UPDATE posts SET status='draft' WHERE slug='post-27'")
    sqlite.exec("UPDATE posts SET deleted_at=1 WHERE slug='post-26'")
    const recent = await getPosts(db, 3, 0, false, false, false, false, 'post')
    const previousRecent = await getPosts(db, 25, 0, false, false, false, false, 'post')
    expect(recent.map(post => post.slug)).toEqual(['post-30', 'post-25', 'post-24'])
    for (const slugs of [[], ['post-1'], ['post-30', 'post-1'], ['post-2', 'post-1', 'post-30'], ['missing', 'post-29', 'post-28', 'post-27', 'post-26', 'post-1']]) {
      const featured = await getFeaturedPosts(db, slugs)
      const selected = selectFeaturedPosts([...featured, ...recent], slugs)
      expect(selected).toEqual(selectFeaturedPosts([...featured, ...previousRecent], slugs))
      expect(selected).toHaveLength(3)
      expect(new Set(selected.map(post => post.slug)).size).toBe(3)
    }
    // The featured repository caps slug lookups at ten; retain 25 recent rows for this fallback.
    const extendedSlugs = [...Array.from({ length: 10 }, (_, index) => `missing-${index}`), 'post-20']
    const featured = await getFeaturedPosts(db, extendedSlugs)
    expect(selectFeaturedPosts([...featured, ...previousRecent], extendedSlugs).map(post => post.slug))
      .toEqual(['post-20', 'post-30', 'post-25'])
    expect(selectFeaturedPosts([...featured, ...recent], extendedSlugs).map(post => post.slug))
      .toEqual(['post-30', 'post-25', 'post-24'])
  })

  it('skips the category join only when the caller does not need it', async () => {
    sqlite.prepare('INSERT OR REPLACE INTO site_settings (key,value) VALUES (?,?)')
      .run('nav_links', JSON.stringify([{ label: 'Work', url: '/work', openInNewTab: false }]))
    const prepare = vi.spyOn(db, 'prepare')
    const header = await getSiteHeaderData(db, { includeCategories: false })
    expect(header).toMatchObject({ navLinks: [{ label: 'Work', url: '/work' }], categories: [] })
    expect(prepare).toHaveBeenCalledTimes(1)
    prepare.mockClear()
    await getSiteHeaderData(db)
    expect(prepare).toHaveBeenCalledTimes(2)
    expect(prepare.mock.calls.some(([sql]) => sql.includes('JOIN posts'))).toBe(true)
  })
})

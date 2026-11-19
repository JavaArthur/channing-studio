import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalD1 } from '../helpers/local-d1'
import type { Database } from '@/lib/repositories/schema'
import { incrementViewCount, updatePost } from '@/lib/repositories/posts'
import { getStudioSettingsWithNav } from '@/lib/studio-settings'
import { cachedPublicData, PUBLIC_CACHE_TAGS, revalidatePublicTags } from '@/lib/public-cache'

describe('2026-11-19 perf migration, trigger narrowing, and public cache helpers', () => {
  let sqlite: DatabaseSync
  let db: Database

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:')
    sqlite.exec(readFileSync('db/schema.sql', 'utf8'))
    db = new LocalD1(sqlite) as unknown as Database
  })

  afterEach(() => {
    sqlite.close()
  })

  function seedPost(slug = 'perf-post') {
    const info = sqlite
      .prepare(
        `INSERT INTO posts (slug, title, content, html, status)
         VALUES (?, 'Initial Title', 'Initial body', '<p>Initial body</p>', 'published')`,
      )
      .run(slug)
    return Number(info.lastInsertRowid)
  }

  function getPostLibraryRevision(slug: string): number {
    const row = sqlite
      .prepare("SELECT revision FROM library_metadata WHERE kind = 'post' AND item_id = ?")
      .get(slug) as { revision: number } | undefined
    return row?.revision ?? -1
  }

  it('does not bump library_metadata.revision on incrementViewCount, but bumps it on title/content updates (schema.sql)', async () => {
    const postId = seedPost('view-test')
    expect(getPostLibraryRevision('view-test')).toBe(1)

    await incrementViewCount(db, 'view-test')
    await incrementViewCount(db, 'view-test')

    const postRow = sqlite
      .prepare('SELECT view_count FROM posts WHERE slug = ?')
      .get('view-test') as { view_count: number }
    expect(postRow.view_count).toBe(2)
    expect(getPostLibraryRevision('view-test')).toBe(1)

    await updatePost(db, postId, { title: 'Updated Title' })
    expect(getPostLibraryRevision('view-test')).toBe(2)

    await updatePost(db, postId, { content: 'Updated body', html: '<p>Updated body</p>' })
    expect(getPostLibraryRevision('view-test')).toBe(3)
  })

  it('upgrades an existing broad trigger when applying the 2026-11-19 migration SQL', async () => {
    // Simulate pre-migration broad trigger
    sqlite.exec(`
      DROP TRIGGER IF EXISTS library_post_update;
      CREATE TRIGGER library_post_update AFTER UPDATE ON posts BEGIN
        INSERT INTO library_metadata(kind,item_id) VALUES ('post',CAST(NEW.slug AS TEXT))
        ON CONFLICT(kind,item_id) DO UPDATE SET revision=revision+1;
      END;
      DROP INDEX IF EXISTS idx_posts_public_feed;
      DROP INDEX IF EXISTS idx_library_meta_filter;
    `)
    seedPost('migrated-post')
    expect(getPostLibraryRevision('migrated-post')).toBe(1)

    // Pre-migration bug: view_count bumps revision
    await incrementViewCount(db, 'migrated-post')
    expect(getPostLibraryRevision('migrated-post')).toBe(2)

    // Apply migration
    sqlite.exec(readFileSync('db/migrations/2026-11-19-perf-indexes-and-trigger.sql', 'utf8'))

    // Post-migration: view_count no longer bumps revision
    await incrementViewCount(db, 'migrated-post')
    expect(getPostLibraryRevision('migrated-post')).toBe(2)

    const indexes = sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('idx_posts_public_feed', 'idx_library_meta_filter')",
      )
      .all() as Array<{ name: string }>
    expect(indexes.map((row) => row.name).sort()).toEqual([
      'idx_library_meta_filter',
      'idx_posts_public_feed',
    ])
  })

  it('fetches studio settings and nav_links in a single D1 query', async () => {
    sqlite
      .prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)')
      .run('nav_links', JSON.stringify([{ label: '文章', url: '/writing', openInNewTab: false }]))
    const prepare = vi.spyOn(db, 'prepare')

    const result = await getStudioSettingsWithNav(db)
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(result.navLinks).toEqual([{ label: '文章', url: '/writing', openInNewTab: false }])
    expect(result.defaultTheme).toBe('light')
  })

  it('falls back to direct fetcher execution in cachedPublicData outside Next runtime and keeps errors intact', async () => {
    const fetcher = vi.fn(async () => ({ ok: true }))
    const value = await cachedPublicData(['test-key'], [PUBLIC_CACHE_TAGS.posts], fetcher)
    expect(value).toEqual({ ok: true })
    expect(fetcher).toHaveBeenCalledTimes(1)

    await expect(
      cachedPublicData(['error-key'], [PUBLIC_CACHE_TAGS.posts], async () => {
        throw new Error('real db failure')
      }),
    ).rejects.toThrow('real db failure')

    expect(() => revalidatePublicTags(PUBLIC_CACHE_TAGS.posts, PUBLIC_CACHE_TAGS.nav)).not.toThrow()
  })
})

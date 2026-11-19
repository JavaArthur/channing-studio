import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalD1 } from '../../helpers/local-d1'

const mocks = vi.hoisted(() => ({
  getAppCloudflareEnv: vi.fn(),
}))

vi.mock('@/lib/cloudflare', () => ({
  getAppCloudflareEnv: mocks.getAppCloudflareEnv,
}))

import { GET as getFeed } from '@/app/feed.xml/route'
import sitemap from '@/app/sitemap'
import { GET as getRelated } from '@/app/api/posts/[slug]/related/route'

describe('public SEO, RSS feed, sitemap, and related posts caching', () => {
  let sqlite: DatabaseSync
  let db: LocalD1

  beforeEach(() => {
    vi.clearAllMocks()
    sqlite = new DatabaseSync(':memory:')
    sqlite.exec(readFileSync('db/schema.sql', 'utf8'))
    db = new LocalD1(sqlite)
    mocks.getAppCloudflareEnv.mockResolvedValue({ DB: db })
  })

  afterEach(() => {
    sqlite.close()
  })

  it('escapes ]]> in RSS CDATA, excludes clippings, updates brand copy, and sets cache headers', async () => {
    sqlite
      .prepare(
        `INSERT INTO posts (slug, title, content, html, description, category, status, kind, published_at)
         VALUES
           ('post-cdata', 'Code Post', 'body', '<pre><code>const x = a[b[0]]]>1;</code></pre>', 'desc', 'AI', 'published', 'post', 1700000100),
           ('legacy-post', 'Legacy Post', 'body', '<p>ok</p>', 'desc', 'AI', 'published', NULL, 1700000050),
           ('clipping-item', 'Clipping Item', 'body', '<p>clip</p>', 'desc', 'AI', 'published', 'clipping', 1700000200)`,
      )
      .run()

    const response = await getFeed()
    const xml = await response.text()

    expect(response.headers.get('Cache-Control')).toBe('public, s-maxage=300, stale-while-revalidate=600')
    expect(xml).toContain('<title>晨启AI</title>')
    expect(xml).toContain('从 Java 后端到 AI Agent，记录企业级 AI 落地、架构取舍与实战复盘的个人技术博客。')
    expect(xml).toContain('post-cdata')
    expect(xml).toContain('legacy-post')
    expect(xml).not.toContain('clipping-item')
    expect(xml).toContain('const x = a[b[0]]]]]><![CDATA[>1;')
  })

  it('includes all core public pages alongside posts and categories in sitemap', async () => {
    sqlite
      .prepare(
        `INSERT INTO posts (slug, title, content, html, category, status, kind, published_at)
         VALUES ('hello-ai', 'Hello AI', 'body', '<p>body</p>', 'AI', 'published', 'post', 1700000000)`,
      )
      .run()

    const entries = await sitemap()
    const urls = entries.map((entry) => entry.url)

    for (const suffix of ['', '/writing', '/work', '/tools', '/prompts', '/about', '/labs', '/hello-ai', '/category/ai']) {
      expect(urls.some((url) => url.endsWith(suffix) && (suffix !== '' || !url.endsWith('/writing')))).toBe(true)
    }
  })

  it('sets Cache-Control on related posts API responses and hides password-protected posts', async () => {
    sqlite
      .prepare(
        `INSERT INTO posts (slug, title, content, html, category, tags, status, password, published_at)
         VALUES
           ('agent-1', 'Agent 架构设计', '正文内容', '<p>正文</p>', 'AI', '["Agent"]', 'published', NULL, 1700000100),
           ('agent-2', 'Agent 工程实战', '正文内容', '<p>正文</p>', 'AI', '["Agent"]', 'published', NULL, 1700000050),
           ('secret-1', 'Encrypted', 'secret', '<p>secret</p>', 'AI', '["Agent"]', 'published', 'hash', 1700000200)`,
      )
      .run()

    const okRes = await getRelated(new NextRequest('http://localhost/api/posts/agent-1/related?limit=3'), {
      params: Promise.resolve({ slug: 'agent-1' }),
    })
    expect(okRes.status).toBe(200)
    expect(okRes.headers.get('Cache-Control')).toBe('public, s-maxage=300, stale-while-revalidate=600')
    const okBody = (await okRes.json()) as { related: { results: Array<{ slug: string }> } }
    expect(okBody.related.results.map((item) => item.slug)).toEqual(['agent-2'])

    const secretRes = await getRelated(new NextRequest('http://localhost/api/posts/secret-1/related'), {
      params: Promise.resolve({ slug: 'secret-1' }),
    })
    expect(secretRes.status).toBe(404)
  })
})

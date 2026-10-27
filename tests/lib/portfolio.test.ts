import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalD1 } from '../helpers/local-d1'
import type { Database } from '@/lib/repositories/schema'
import { portfolioInputSchema } from '@/lib/portfolio'
import {
  createPortfolioProject,
  getPublicPortfolio,
  listPortfolioProjects,
  setPortfolioPublished,
  updatePortfolioProject,
} from '@/lib/repositories/portfolio'

let sqlite: DatabaseSync
let db: Database
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync('db/schema.sql', 'utf8'))
  db = new LocalD1(sqlite) as unknown as Database
})
afterEach(() => sqlite.close())

const input = (overrides: Record<string, unknown> = {}) =>
  portfolioInputSchema.parse({
    slug: 'trade-review',
    title: 'Trade review',
    summary: 'Public summary',
    site_url: 'https://example.com',
    repo_url: 'https://github.com/example/private-repo',
    links: [{ label: 'Staging', url: 'https://staging.example.com' }],
    local_path: '~/ai/30-projects/private-checkout',
    tags: ['Workers'],
    ...overrides,
  })

describe('portfolio projects', () => {
  it('keeps private links, local paths and private repositories out of the public snapshot', async () => {
    const id = await createPortfolioProject(db, input())
    expect(await getPublicPortfolio(db)).toEqual([])
    await setPortfolioPublished(db, id, true)
    const [published] = await getPublicPortfolio(db)
    expect(published).toEqual({
      slug: 'trade-review',
      title: 'Trade review',
      summary: 'Public summary',
      status: 'active',
      tags: ['Workers'],
      site_url: 'https://example.com',
      repo_url: null,
    })
    expect(JSON.stringify(await getPublicPortfolio(db))).not.toMatch(/private|staging/)
  })

  it('shows a public repository only when it is marked public', async () => {
    const id = await createPortfolioProject(db, input({ repo_public: true }))
    await setPortfolioPublished(db, id, true)
    expect((await getPublicPortfolio(db))[0].repo_url).toBe('https://github.com/example/private-repo')
  })

  it('does not leak later private edits until the project is republished', async () => {
    const id = await createPortfolioProject(db, input())
    await setPortfolioPublished(db, id, true)
    sqlite.prepare('UPDATE portfolio_projects SET published_at = published_at - 10 WHERE id = ?').run(id)
    await updatePortfolioProject(db, id, input({ summary: 'Unreviewed draft' }))
    expect((await getPublicPortfolio(db))[0].summary).toBe('Public summary')
    expect((await listPortfolioProjects(db))[0]).toMatchObject({ publish_stale: true })
    await setPortfolioPublished(db, id, true)
    expect((await getPublicPortfolio(db))[0].summary).toBe('Unreviewed draft')
    await setPortfolioPublished(db, id, false)
    expect(await getPublicPortfolio(db)).toEqual([])
  })

  it('hides archived projects and skips unreadable snapshots instead of failing the page', async () => {
    const id = await createPortfolioProject(db, input())
    await setPortfolioPublished(db, id, true)
    await createPortfolioProject(db, input({ slug: 'broken' }))
    sqlite.prepare("UPDATE portfolio_projects SET published_payload = '{not json' WHERE slug = 'broken'").run()
    expect((await getPublicPortfolio(db)).map((project) => project.slug)).toEqual(['trade-review'])
    await updatePortfolioProject(db, id, input({ status: 'archived' }))
    expect(await getPublicPortfolio(db)).toEqual([])
  })

  it('orders pinned projects first, then by sort order', async () => {
    for (const [slug, extra] of [
      ['late', { sort_order: 2 }],
      ['early', { sort_order: 1 }],
      ['pinned', { sort_order: 9, is_pinned: true }],
    ] as const) {
      const id = await createPortfolioProject(db, input({ slug, ...extra }))
      await setPortfolioPublished(db, id, true)
    }
    expect((await getPublicPortfolio(db)).map((project) => project.slug)).toEqual(['pinned', 'early', 'late'])
  })

  it('rejects duplicate slugs, unsafe links and publishing without a summary', async () => {
    await createPortfolioProject(db, input())
    await expect(createPortfolioProject(db, input())).rejects.toMatchObject({ status: 409 })
    for (const bad of [
      { site_url: 'javascript:alert(1)' },
      { site_url: '//evil.example' },
      { repo_url: 'https://user:pass@example.com' },
      { links: [{ label: 'x', url: 'file:///etc/passwd' }] },
      { local_path: 'relative/path' },
      { slug: 'Has Spaces' },
    ])
      expect(portfolioInputSchema.safeParse({ slug: 'ok', title: 'x', ...bad }).success).toBe(false)
    const id = await createPortfolioProject(db, input({ slug: 'no-summary', summary: '' }))
    await expect(setPortfolioPublished(db, id, true)).rejects.toMatchObject({ status: 400 })
  })
})

it('migration carries over the projects /work showed before', () => {
  sqlite.close()
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync('db/schema.sql', 'utf8').replace(/-- Portfolio projects[\s\S]*$/, ''))
  sqlite
    .prepare("INSERT INTO site_settings(key,value) VALUES('studio_projects',?)")
    .run(
      JSON.stringify([
        { id: 'blog', title: 'Blog', description: 'Shown', href: '/labs', tags: ['Next.js'], visible: true },
        { id: 'hidden', title: 'Hidden', description: 'Not shown', href: 'https://x.dev', tags: [], visible: false },
      ]),
    )
  sqlite
    .prepare("INSERT INTO projects(id,title,published_payload) VALUES('12345678-legacy','Collection',?)")
    .run(JSON.stringify({ title: 'Legacy', description: 'Old public project', href: 'https://legacy.dev' }))
  sqlite.exec(readFileSync('db/migrations/2026-10-27-portfolio-projects.sql', 'utf8'))
  const rows = sqlite
    .prepare('SELECT slug, published_payload IS NOT NULL AS published FROM portfolio_projects ORDER BY slug')
    .all()
  expect(rows).toEqual([
    { slug: 'blog', published: 1 },
    { slug: 'hidden', published: 0 },
    { slug: 'legacy-12345678', published: 1 },
  ])
})

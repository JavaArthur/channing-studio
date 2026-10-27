import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { beforeEach, afterEach, it, expect } from 'vitest'
import { LocalD1 } from '../helpers/local-d1'
import type { Database } from '@/lib/repositories/schema'
import {
  captureLibraryItem,
  getLibraryItem,
  getLibraryPublication,
  publishLibraryResource,
  searchLibrary,
  updateLibraryItem,
  listCollections,
  linkLibraryCollection,
} from '@/lib/repositories/library'
import {
  recordLibraryRead,
  recordLibrarySearch,
  getLibraryUsage,
  clearLibraryHistory,
  setCollectionPreference,
  pinCollectionItem,
} from '@/lib/repositories/library-usage'
import { saveBrainItem } from '@/lib/repositories/brain'
import { ensureAiImageConfigInfrastructure } from '@/lib/ai-image-config'
import { createTextOperation, createImageOperation } from '@/lib/repositories/content-operations'
import { buildHandoff } from '@/lib/library/types'
let sqlite: DatabaseSync, db: Database
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync('db/schema.sql', 'utf8'))
  db = new LocalD1(sqlite) as unknown as Database
})
afterEach(() => sqlite.close())
const note = (title: string, content = '', extra = {}) =>
  captureLibraryItem(db, {
    request_key: crypto.randomUUID(),
    type: 'note',
    title,
    content,
    ...extra,
  })
it('matches multiple Chinese/English terms across fields and surfaces deep, escaped text with stable ranked pagination', async () => {
  const first = await note(
    'Playwright',
    '开头\n'.repeat(400) + '浏览器自动化 <script>example</script>',
    { summary: '回归测试', topics: ['工程'], saved_reason: '产品演示' },
  )
  await note('Playwright 工具', '浏览器自动化')
  await note('Other', 'Playwright 浏览器自动化')
  const result = await searchLibrary(db, { q: 'PLAYWRIGHT 浏览器 自动化', sort: 'relevance' })
  expect(result.total).toBe(3)
  expect(result.items.find((i) => i.id === first.item.id)?.match?.text).toContain('浏览器自动化')
  expect(result.items.find((i) => i.id === first.item.id)?.content.length).toBeLessThanOrEqual(240)
  expect(
    (await searchLibrary(db, { q: 'Playwright', sort: 'relevance', limit: 1 })).items[0].title,
  ).toBe('Playwright')
  expect(
    (await searchLibrary(db, { q: 'Playwright', sort: 'relevance', limit: 1, page: 2 })).items[0]
      .title,
  ).toBe('Playwright 工具')
  expect((await searchLibrary(db, { q: '演示', topic: '工程' })).total).toBe(1)
  expect((await searchLibrary(db, { q: "% _ ' OR 1=1" })).total).toBe(0)
})
it('loads curated snapshots, preserves extra public fields, retains withdrawal and rejects stale publications', async () => {
  const { item } = await captureLibraryItem(db, {
    request_key: crypto.randomUUID(),
    type: 'prompt',
    title: 'Private',
    content: '  private\n\n',
    source_url: 'https://example.com/private',
  })
  const published = await publishLibraryResource(db, 'prompt', item.id, item.revision, {
    title: 'Public',
    description: 'Reviewed',
    content: '  exact public\n\n',
    url: null,
  })
  const payload = JSON.parse(
    sqlite.prepare('SELECT published_payload FROM prompts').get()!.published_payload as string,
  )
  sqlite
    .prepare('UPDATE prompts SET published_payload=?')
    .run(
      JSON.stringify({
        ...payload,
        category: 'curated',
        tags: ['share'],
        sort_order: 8,
        is_pinned: 1,
      }),
    )
  const current = await getLibraryItem(db, 'prompt', item.id)
  await updateLibraryItem(db, 'prompt', item.id, current.revision, { title: 'New private' })
  const loaded = await getLibraryPublication(db, 'prompt', item.id)
  expect(loaded.fields).toMatchObject({ title: 'Public', content: '  exact public\n\n', url: null })
  expect(loaded.privateFields.title).toBe('New private')
  await expect(
    publishLibraryResource(db, 'prompt', item.id, published.revision, loaded.fields),
  ).rejects.toMatchObject({ status: 412 })
  const saved = await publishLibraryResource(db, 'prompt', item.id, loaded.revision, {
    ...loaded.fields,
    description: 'Adjusted',
  })
  const withdrawn = await publishLibraryResource(
    db,
    'prompt',
    item.id,
    saved.revision,
    loaded.fields,
    false,
  )
  const row = sqlite.prepare('SELECT published_payload,is_hidden FROM prompts').get()!
  expect(row.is_hidden).toBe(1)
  expect(JSON.parse(row.published_payload as string)).toMatchObject({
    title: 'Public',
    description: 'Adjusted',
    tags: ['share'],
    category: 'curated',
    is_pinned: 1,
    sort_order: 8,
    prompt: '  exact public\n\n',
  })
  expect((await getLibraryPublication(db, 'prompt', withdrawn.id)).published).toBe(false)
})
it('syncs bounded usage without changing content revisions or inspiration state, filters archived records and clears independently', async () => {
  const { item } = await captureLibraryItem(db, {
    request_key: crypto.randomUUID(),
    type: 'inspiration',
    title: 'Idea',
    content: '  exact\n\n',
  })
  sqlite.prepare("UPDATE x_drafts SET status='posted' WHERE id=?").run(item.id)
  const before = await getLibraryItem(db, item.kind, item.id)
  await recordLibraryRead(db, item.kind, item.id)
  expect((await searchLibrary(db, { recent: true })).items).toEqual([])
  expect((await getLibraryItem(db, item.kind, item.id)).revision).toBe(before.revision)
  expect(sqlite.prepare('SELECT status FROM x_drafts').get()!.status).toBe('posted')
  expect(buildHandoff([before], 'Continue', 'https://studio.example')).toContain(
    'https://studio.example/admin/operations?item=',
  )
  for (let i = 0; i < 24; i++) await recordLibrarySearch(db, { q: `Query ${i}`, kind: 'note' })
  await recordLibrarySearch(db, { q: 'query 23', kind: 'note' })
  expect((await getLibraryUsage(db)).searches).toHaveLength(20)
  await clearLibraryHistory(db, 'searches')
  expect((await getLibraryUsage(db)).searches).toHaveLength(0)
  expect((await searchLibrary(db, { recent: true })).total).toBe(0)
  await updateLibraryItem(db, item.kind, item.id, before.revision, { archived: true })
  expect((await searchLibrary(db, { recent: true })).total).toBe(0)
  for (let i = 0; i < 103; i++) {
    const { item: n } = await note(`read ${i}`)
    await recordLibraryRead(db, n.kind, n.id)
  }
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM admin_recent_items').get()!.n).toBe(100)
  await clearLibraryHistory(db, 'reads')
  expect((await searchLibrary(db, { recent: true })).total).toBe(0)
})
it('pins collections and members independently of content/collection revisions and excludes archived collections', async () => {
  const a = await saveBrainItem(db, 'projects', { title: 'A' }),
    b = await saveBrainItem(db, 'projects', { title: 'B' })
  const { item } = await note('Important')
  const first = (await listCollections(db)).find((c) => c.id === a)!
  await linkLibraryCollection(db, a, item.kind, item.id, first.revision)
  const revision = (await listCollections(db)).find((c) => c.id === a)!.revision
  await setCollectionPreference(db, a, true)
  await setCollectionPreference(db, b, true)
  await setCollectionPreference(db, b, true, 'up')
  expect((await getLibraryUsage(db)).collections[0].id).toBe(b)
  await pinCollectionItem(db, a, item.kind, item.id, true)
  expect((await searchLibrary(db, { collection: a })).items[0].collection_pinned).toBe(1)
  expect((await getLibraryItem(db, item.kind, item.id)).revision).toBe(item.revision)
  expect((await listCollections(db)).find((c) => c.id === a)!.revision).toBe(revision)
  await expect(pinCollectionItem(db, b, item.kind, item.id, true)).rejects.toMatchObject({
    status: 404,
  })
  sqlite.prepare("UPDATE projects SET status='archived' WHERE id=?").run(a)
  expect((await getLibraryUsage(db)).collections.some((c) => c.id === a)).toBe(false)
})
it('migrates usage state empty without changing original records', () => {
  const old = new DatabaseSync(':memory:')
  try {
    old.exec(
      readFileSync('db/schema.sql', 'utf8').split('-- Private, single-admin usage state.')[0],
    )
    old.exec("INSERT INTO notes(id,title,content) VALUES ('n','Title','Body')")
    old.exec(readFileSync('db/migrations/2026-10-25-library-usage.sql', 'utf8'))
    expect(old.prepare('SELECT COUNT(*) AS n FROM admin_recent_items').get()!.n).toBe(0)
    expect(old.prepare('SELECT title,content,revision FROM notes').get()).toEqual({
      title: 'Title',
      content: 'Body',
      revision: 1,
    })
  } finally {
    old.close()
  }
})
it('keeps 5,000 mixed source records paginated during keyword search', async () => {
  const insert = sqlite.prepare('INSERT INTO notes(id,title,content) VALUES (?,?,?)'),
    tool = sqlite.prepare('INSERT INTO tools(name,url,description) VALUES (?,?,?)'),
    prompt = sqlite.prepare('INSERT INTO prompts(title,prompt) VALUES (?,?)'),
    idea = sqlite.prepare('INSERT INTO x_drafts(id,content) VALUES (?,?)')
  sqlite.exec('BEGIN')
  for (let i = 0; i < 5000; i++) {
    const text = `浏览器自动化与产品演示 ${i} ` + 'context '.repeat(100)
    switch (i % 4) {
      case 0:
        insert.run(`perf-${i}`, `Notes ${i}`, text)
        break
      case 1:
        tool.run(`Tool ${i}`, `https://example.com/${i}`, text)
        break
      case 2:
        prompt.run(`Prompt ${i}`, text)
        break
      default:
        idea.run(`perf-${i}`, text)
    }
  }
  sqlite.exec('COMMIT')
  const start = performance.now()
  const result = await searchLibrary(db, { q: '浏览器 自动化', sort: 'relevance', limit: 30 })
  const elapsed = performance.now() - start
  expect(result.total).toBe(3750)
  expect(result.items).toHaveLength(30)
  expect(result.has_more).toBe(true)
  console.info(
    `5000-record SQLite retrieval: ${elapsed.toFixed(1)} ms; ${result.items.length} previews; live D1 rows_read measured separately`,
  )
})

it('persists disabled state when new text and image operations are created', async () => {
  const input = {
    action_key: 'new-custom',
    label: 'Custom',
    description: 'Use',
    prompt: 'Keep exact  spaces',
    profile_id: null,
    is_enabled: 0,
  }
  await createTextOperation(db, { ...input, temperature: 0.6 })
  await ensureAiImageConfigInfrastructure(db)
  await createImageOperation(db, {
    ...input,
    aspect_ratio: '16:9',
    resolution: '2k',
    size: '1536x1024',
    quality: 'high',
  })
  for (const table of ['ai_actions', 'ai_image_actions'])
    expect(
      sqlite
        .prepare(`SELECT is_enabled,prompt FROM ${table} WHERE action_key=?`)
        .get(input.action_key),
    ).toEqual({ is_enabled: 0, prompt: input.prompt })
})

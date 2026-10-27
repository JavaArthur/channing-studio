import { listXDrafts } from '@/lib/repositories/x-drafts'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { beforeEach, afterEach, describe, it, expect } from 'vitest'
import { LocalD1 } from '../helpers/local-d1'
import type { Database } from '@/lib/repositories/schema'
import { updateLibraryCollection, captureLibraryItem, getLibraryItem, searchLibrary, updateLibraryItem, listCollections, linkLibraryCollection } from '@/lib/repositories/library'
import { saveBrainItem } from '@/lib/repositories/brain'
import { buildHandoff } from '@/lib/library/types'
let sqlite: DatabaseSync; let db: Database
beforeEach(() => { sqlite = new DatabaseSync(':memory:'); sqlite.exec(readFileSync('db/schema.sql', 'utf8')); db = new LocalD1(sqlite) as unknown as Database })
afterEach(() => sqlite.close())
const toolInput = () => ({ request_key: crypto.randomUUID(), type: 'tool' as const, title: 'Useful tool', source_url: 'https://example.com/tool?utm_source=x', content: 'Useful for video', topics: ['视频'] })
describe('Studio library', () => {
  it('captures into the actual resource table privately, returns a stable deep link and replays without overwriting edits', async () => {
    const input = toolInput(); const saved = await captureLibraryItem(db, input)
    expect(saved.item).toMatchObject({ kind: 'tool', submitted_by: 'agent', topics: ['视频'] })
    expect(saved.href).toBe(`/admin/library/tool/${saved.item.id}`)
    expect(sqlite.prepare('SELECT is_hidden,published_payload FROM tools').get()).toMatchObject({ is_hidden: 1, published_payload: null })
    const edited = await updateLibraryItem(db, 'tool', saved.item.id, saved.item.revision, { content: 'human edit' })
    expect(edited.revision).toBeGreaterThan(saved.item.revision)
    expect((await captureLibraryItem(db, input)).item.content).toBe('human edit')
    await expect(captureLibraryItem(db, { ...input, title: 'different' })).rejects.toMatchObject({ status: 409 })
    expect((await searchLibrary(db, { topic: '视频' })).total).toBe(1)
  })
  it('reuses tool/article sources across agents and retries, but allows multiple inspirations from one source', async () => {
    const first = await captureLibraryItem(db, toolInput())
    const second = await captureLibraryItem(db, { ...toolInput(), source_url: 'https://example.com/tool', content: 'do not overwrite' })
    expect(second).toMatchObject({ reused_source: true, item: { id: first.item.id, content: 'Useful for video' } })
    for (const content of ['First idea', 'Second idea']) await captureLibraryItem(db, { request_key: crypto.randomUUID(), type: 'inspiration', title: content, content, source_url: 'https://example.com/tool' })
    expect((await searchLibrary(db, { kind: 'inspiration' })).total).toBe(0)
    expect((await listXDrafts(db, {})).total).toBe(2)
  })
  it('keeps article metadata, unavailable sources and explicit decisions distinct from normal captures', async () => {
    const { item } = await captureLibraryItem(db, { request_key: crypto.randomUUID(), type: 'article', title: 'Unreadable', source_url: 'https://example.com/article', source_status: 'unavailable' })
    expect(item).toMatchObject({ content_type: 'article', source_status: 'unavailable', content: '', decision_question: '' })
    expect((await searchLibrary(db, { decisions: true })).total).toBe(0)
    await updateLibraryItem(db, item.kind, item.id, item.revision, { decision_question: 'Which approach?' })
    expect((await searchLibrary(db, { decisions: true })).total).toBe(1)
    expect((await searchLibrary(db, { kind: 'article' })).total).toBe(1)
  })
  it('associates mixed content with collections without copying and preserves existing project links', async () => {
    const collection = await saveBrainItem(db, 'projects', { title: 'Video' })
    const tool = await captureLibraryItem(db, { ...toolInput(), collection_ids: [collection] })
    const inspiration = await captureLibraryItem(db, { request_key: crypto.randomUUID(), type: 'inspiration', title: 'Idea', content: 'idea' })
    const before = (await listCollections(db))[0]
    await linkLibraryCollection(db, collection, inspiration.item.kind, inspiration.item.id, before.revision)
    expect((await listCollections(db))[0].revision).toBeGreaterThan(before.revision)
    expect((await searchLibrary(db, { collection })).total).toBe(1)
    expect((await listCollections(db))[0].item_count).toBe(1)
    expect((await getLibraryItem(db, 'inspiration', inspiration.item.id)).collections).toEqual([{ id: collection, title: 'Video' }])
    expect(tool.item.collections).toEqual([{ id: collection, title: 'Video' }])
  })
  it('rejects stale edits, including old admin writes and a concurrent update between read and transaction', async () => {
    const { item } = await captureLibraryItem(db, toolInput())
    sqlite.prepare('UPDATE tools SET description=? WHERE id=?').run('old admin', item.id)
    await expect(updateLibraryItem(db, item.kind, item.id, item.revision, { content: 'stale' })).rejects.toMatchObject({ status: 412 })
    const now = await getLibraryItem(db, item.kind, item.id)
    const batch = db.batch.bind(db)
    db.batch = async statements => { sqlite.prepare('UPDATE tools SET description=? WHERE id=?').run('concurrent', item.id); return batch(statements) }
    await expect(updateLibraryItem(db, item.kind, item.id, now.revision, { content: 'overwrite' })).rejects.toMatchObject({ status: 412 })
    expect((await getLibraryItem(db, item.kind, item.id)).content).toBe('concurrent')
  })
  it('rolls back source records and receipts if metadata fails', async () => {
    sqlite.exec("CREATE TRIGGER fail_metadata BEFORE UPDATE ON library_metadata BEGIN SELECT RAISE(ABORT,'failure'); END")
    await expect(captureLibraryItem(db, toolInput())).rejects.toThrow()
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM tools').get()).toMatchObject({ n: 0 })
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM library_captures').get()).toMatchObject({ n: 0 })
  })
  it('reads old records without guessing their submitter and never changes X status during reading or handoff', async () => {
    sqlite.prepare("INSERT INTO x_drafts(id,content,status) VALUES ('old','inspiration','posted')").run()
    const item = await getLibraryItem(db, 'inspiration', 'old')
    expect(item.submitted_by).toBe('unknown')
    expect((await searchLibrary(db, { kind: 'inspiration' })).total).toBe(0)
    expect((await listXDrafts(db, { status: 'posted' })).total).toBe(1)
    expect(buildHandoff([item], '研究这个方向')).toContain('Studio 条目：inspiration/old')
    expect(sqlite.prepare('SELECT status FROM x_drafts').get()).toMatchObject({ status: 'posted' })
  })
  it('rejects unsafe URLs and migrates existing content without reclassifying or enqueuing it', async () => {
    await expect(captureLibraryItem(db, { ...toolInput(), source_url: 'javascript:alert(1)' })).rejects.toMatchObject({ status: 400 })
    const old = new DatabaseSync(':memory:')
    try {
      old.exec(readFileSync('db/schema.sql', 'utf8').split('-- Studio library (2026-10-24)')[0])
      old.exec("INSERT INTO notes(id,title,content) VALUES ('old','Old note','Keep'); INSERT INTO x_drafts(id,content,status) VALUES ('old','Idea','posted')")
      old.exec(readFileSync('db/migrations/2026-10-24-studio-library.sql', 'utf8'))
      expect(old.prepare('SELECT content FROM notes').get()).toMatchObject({ content: 'Keep' })
      expect(old.prepare("SELECT submitted_by,decision_question FROM library_metadata WHERE kind='note'").get()).toMatchObject({ submitted_by: 'unknown', decision_question: '' })
      expect(old.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally { old.close() }
  })
})

it('renders safe readable Markdown without executing HTML or loading remote images', async () => {
  const { renderLibraryMarkdown } = await import('@/lib/library/markdown')
  const html = renderLibraryMarkdown('# Heading\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n![tracking](https://example.com/pixel)\n\n- one\n- two')
  expect(html).toContain('<h1>Heading</h1>')
  expect(html).toContain('<ul>')
  expect(html).not.toContain('<script>')
  expect(html).not.toContain('<img')
  expect(html).not.toContain('href="javascript:')
})

it('keeps reviewed public snapshots stable and creates external article drafts as clippings', async () => {
  const { publishLibraryResource, draftFromLibrary } = await import('@/lib/repositories/library')
  const { item } = await captureLibraryItem(db, toolInput())
  const published = await publishLibraryResource(db, 'tool', item.id, item.revision, { title: 'Public title', description: 'Public summary', url: 'https://example.com/tool' })
  await updateLibraryItem(db, 'tool', item.id, published.revision, { content: 'private new information', title: 'Private title' })
  const row = sqlite.prepare('SELECT published_payload FROM tools').get()
  expect(JSON.parse(row?.published_payload as string)).toMatchObject({ name: 'Public title', description: 'Public summary' })
  const note = (await captureLibraryItem(db, { request_key: crypto.randomUUID(), type: 'article', title: 'External article', source_url: 'https://example.com/article', summary: 'Key finding', content: '- My notes' })).item
  const draft = await draftFromLibrary(db, note.kind, note.id, note.revision)
  expect(draft.href).toContain('/editor?edit=')
  expect(sqlite.prepare('SELECT kind,status,source_url FROM posts').get()).toMatchObject({ kind: 'clipping', status: 'draft', source_url: 'https://example.com/article' })
  await draftFromLibrary(db, note.kind, note.id, note.revision)
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM posts').get()).toMatchObject({ n: 1 })
})

it('preserves legacy inspiration metadata outside library search and hides unsafe links', async () => {
  const {item}=await captureLibraryItem(db,{request_key:crypto.randomUUID(),type:'inspiration',title:'A short title',content:'A much longer body'})
  expect(item.title).toBe('A short title')
  const edited=await updateLibraryItem(db,item.kind,item.id,item.revision,{title:'New searchable title'})
  expect(edited.title).toBe('New searchable title')
  expect((await searchLibrary(db,{q:'New searchable'})).total).toBe(0)
  expect(edited.href).toBe(`/admin/operations?item=${encodeURIComponent(item.id)}`)
  sqlite.prepare("UPDATE x_drafts SET source_url='javascript:alert(1)' WHERE id=?").run(item.id)
  expect((await getLibraryItem(db,item.kind,item.id)).source_url).toBe(null)
})

it('reuses historical tracked sources and keeps the note filter distinct from article excerpts', async () => {
  sqlite.exec("INSERT INTO tools(name,url) VALUES ('Legacy','https://example.com/tool?utm_source=old#fragment')")
  const result=await captureLibraryItem(db,toolInput())
  expect(result.reused_source).toBe(true)
  expect(result.item.title).toBe('Legacy')
  expect((await searchLibrary(db,{q:'example.com'})).total).toBe(1)
  await captureLibraryItem(db,{request_key:crypto.randomUUID(),type:'article',title:'Article',source_url:'https://example.com/article'})
  expect((await searchLibrary(db,{kind:'note'})).total).toBe(0)
})

it('publishes only reviewed prompt fields, without private topics or an unreviewed source', async () => {
  const {publishLibraryResource}=await import('@/lib/repositories/library')
  const {item}=await captureLibraryItem(db,{request_key:crypto.randomUUID(),type:'prompt',title:'Private prompt',content:'Private body',topics:['Private project'],source_url:'https://example.com/private-source'})
  await publishLibraryResource(db,'prompt',item.id,item.revision,{title:'Reviewed title',description:'Reviewed summary',content:'Reviewed prompt'})
  const payload=JSON.parse(sqlite.prepare('SELECT published_payload FROM prompts WHERE id=?').get(item.id)?.published_payload as string)
  expect(payload).toMatchObject({title:'Reviewed title',prompt:'Reviewed prompt',tags:[],source_url:null})
})

it('sorts paginated content and edits/restores collections with revision checks', async () => {
  const first = await captureLibraryItem(db, { request_key: crypto.randomUUID(), type: 'note', title: 'Zulu', content: 'one' })
  await captureLibraryItem(db, { request_key: crypto.randomUUID(), type: 'note', title: 'Alpha', content: 'two' })
  expect((await searchLibrary(db, { sort: 'title', limit: 1 })).items[0].title).toBe('Alpha')
  expect((await searchLibrary(db, { sort: 'title', limit: 1, page: 2 })).items[0].id).toBe(first.item.id)
  const id = await saveBrainItem(db, 'projects', { title: 'Before' })
  const before = (await listCollections(db))[0]
  await updateLibraryCollection(db, id, before.revision, { title: 'After', description: 'Details', archived: true })
  expect(await listCollections(db)).toHaveLength(0)
  const archived = (await listCollections(db, true))[0]
  expect(archived).toMatchObject({ title: 'After', description: 'Details' })
  await expect(updateLibraryCollection(db, id, before.revision, { title: 'Stale', description: '', archived: false })).rejects.toMatchObject({ status: 412 })
  await updateLibraryCollection(db, id, archived.revision, { title: 'Restored', description: 'Details', archived: false })
  expect((await listCollections(db))[0].title).toBe('Restored')
})
it('detects legacy media before DOM parsing without rejecting HTML inside code fences', async () => {
  const { requiresSourceEditor } = await import('@/lib/library/markdown')
  expect(requiresSourceEditor('![private](https://example.com/pixel.png)')).toBe(true)
  expect(requiresSourceEditor('<img src="https://example.com/pixel.png">')).toBe(true)
  expect(requiresSourceEditor('```html\n<div>code example</div>\n```')).toBe(false)
  expect(requiresSourceEditor('## Normal\n\n**text** and [source](https://example.com)')).toBe(false)
})

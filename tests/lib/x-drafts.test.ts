import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalD1 } from '../helpers/local-d1'
import type { Database } from '@/lib/repositories/schema'
import { countXChars, isOverLimit, X_CHAR_LIMIT } from '@/lib/x-drafts/text'
import { createXDraft, getXDraft, listXDrafts, updateXDraft } from '@/lib/repositories/x-drafts'

let sqlite: DatabaseSync; let db: Database
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync('db/schema.sql', 'utf8'))
  db = new LocalD1(sqlite) as unknown as Database
})
afterEach(() => sqlite.close())
const create = (content = '第一行\n\nsecond line', source_type = 'other') => createXDraft(db, crypto.randomUUID(), { content, source_type })
describe('X weighted text', () => {
  it.each([['abc', 3], ['https://例子.测试/路径', 22], ['example.com', 23], ['👨‍👩‍👧‍👦', 2], ['…', 2], ['中文Ａ！', 8], ['a\nb', 3], ['😀🚀', 4], ['hello https://example.com/a?b=c', 29], ['https://a.co\nhttps://b.co', 47], ['see https://a.co.', 28]])('counts %s', (text, count) => expect(countXChars(text)).toBe(count))
  it('warns only above the limit', () => {
    expect(X_CHAR_LIMIT).toBe(280)
    expect(isOverLimit('中'.repeat(140))).toBe(false)
    expect(isOverLimit('中'.repeat(141))).toBe(true)
  })
})
describe('X drafts repository', () => {
  it('creates and replays one receipt without storing content, rejects changed requests', async () => {
    const key = crypto.randomUUID(); const fields = { content: '  中文\n\nASCII  ', source_url: 'https://example.com', source_type: 'custom_source' }
    const first = await createXDraft(db, key, fields)
    expect(first).toMatchObject({ replayed: false, draft: { content: fields.content, revision: 1, status: 'pending', source_type: 'custom_source' } })
    expect(first.draft.id).toMatch(/^xd-[a-f0-9]+$/)
    expect(await createXDraft(db, key, fields)).toEqual({ ...first, replayed: true })
    await expect(createXDraft(db, key, { ...fields, content: 'different' })).rejects.toMatchObject({ status: 409 })
    expect(sqlite.prepare('SELECT count(*) AS n FROM x_drafts').get()).toMatchObject({ n: 1 })
    const receipt = sqlite.prepare('SELECT * FROM x_draft_creates').get()!
    expect(receipt.key_hash).not.toBe(key)
    expect(Object.keys(receipt)).toEqual(['key_hash', 'request_hash', 'draft_id', 'created_at'])
  })
  it('filters and paginates by status, source, literal text and inclusive creation time', async () => {
    const a = (await create('match 100%', 'aihot')).draft
    const b = (await create('match other', 'hot_post')).draft
    const c = (await create('third', 'aihot')).draft
    for (const [item, time] of [[a, 100], [b, 200], [c, 300]] as const) sqlite.prepare('UPDATE x_drafts SET created_at=? WHERE id=?').run(time, item.id)
    await updateXDraft(db, b.id, 2, { status: 'posted' })
    expect((await listXDrafts(db, { status: 'all', page: 1, limit: 2 }))).toMatchObject({ total: 3, has_more: true, items: [{ id: c.id }, { id: a.id }] })
    expect((await listXDrafts(db, { status: 'all', page: 2, limit: 2 })).items.map(d => d.id)).toEqual([b.id])
    expect((await listXDrafts(db, { status: 'posted' })).items.map(d => d.id)).toEqual([b.id])
    expect((await listXDrafts(db, { source_type: 'aihot', since: 100, until: 200 })).items.map(d => d.id)).toEqual([a.id])
    expect((await listXDrafts(db, { q: '100%' })).total).toBe(1)
    expect((await listXDrafts(db, { status: 'discarded' })).total).toBe(0)
  })
  it('updates revisions, preserves human changes on replay, and permits restoring pending', async () => {
    const key = crypto.randomUUID(); const fields = { content: 'original' }
    const { draft } = await createXDraft(db, key, fields)
    const posted = await updateXDraft(db, draft.id, 1, { status: 'posted', posted_url: 'https://example.com/post', content: '中'.repeat(141) })
    expect(posted).toMatchObject({ revision: 2, status: 'posted', over_limit: true, char_count: 282 })
    await expect(updateXDraft(db, draft.id, 1, { status: 'discarded' })).rejects.toMatchObject({ status: 412 })
    expect((await createXDraft(db, key, fields)).draft).toEqual(posted)
    expect(await updateXDraft(db, draft.id, 2, { status: 'pending' })).toMatchObject({ revision: 3, posted_url: null, status: 'pending' })
    expect(await getXDraft(db, draft.id)).toMatchObject({ revision: 3 })
  })
  it.each(['pending', 'discarded'] as const)('clears posted URLs when the resulting status is %s, including URL-only changes', async status => {
    const { draft } = await create()
    const posted = await updateXDraft(db, draft.id, draft.revision, { status: 'posted', posted_url: 'https://x.com/example/status/123' })
    const cleared = await updateXDraft(db, draft.id, posted.revision, { status })
    expect(cleared).toMatchObject({ status, posted_url: null })
    const ignored = await updateXDraft(db, draft.id, cleared.revision, { status, posted_url: 'https://x.com/example/status/456' })
    expect(ignored).toMatchObject({ status, posted_url: null })
    expect(await updateXDraft(db, draft.id, ignored.revision, { posted_url: posted.posted_url })).toMatchObject({ status, posted_url: null })
    // Undo restores both fields, using the revision returned by the previous operation.
    const current = await getXDraft(db, draft.id)
    expect(await updateXDraft(db, draft.id, current.revision, { status: posted.status, posted_url: posted.posted_url })).toMatchObject({ status: 'posted', posted_url: posted.posted_url })
  })
  it('orders all drafts by pending first, creation time descending and id for ties', async () => {
    sqlite.exec(`INSERT INTO x_drafts(id,content,status,created_at) VALUES
      ('pending-b','draft','pending',100), ('posted-new','draft','posted',300),
      ('pending-a','draft','pending',100), ('discarded','draft','discarded',200),
      ('pending-new','draft','pending',150)`)
    expect((await listXDrafts(db, { status: 'all' })).items.map(d => d.id)).toEqual([
      'pending-new', 'pending-a', 'pending-b', 'posted-new', 'discarded',
    ])
  })
  it('validates content, source types, links and patch fields before writing', async () => {
    for (const fields of [{ content: '' }, { content: '  \n' }, { content: 'x'.repeat(10001) }, { content: 'x', source_type: 'Bad Type' }, { content: 'x', source_url: 'javascript:alert(1)' }])
      await expect(createXDraft(db, crypto.randomUUID(), fields)).rejects.toMatchObject({ status: 400 })
    const { draft } = await create()
    for (const posted_url of ['javascript:alert(1)', 'ftp://example.com', '//x.com/test', 'https://user:pass@x.com'])
      await expect(updateXDraft(db, draft.id, 1, { status: 'posted', posted_url })).rejects.toMatchObject({ status: 400 })
    await expect(updateXDraft(db, draft.id, 1, {})).rejects.toMatchObject({ status: 400 })
    expect(await getXDraft(db, draft.id)).toMatchObject({ revision: 1, status: 'pending' })
  })
  it('rolls back a failed receipt and permits retrying the creation', async () => {
    sqlite.exec("CREATE TRIGGER fail_receipt BEFORE INSERT ON x_draft_creates BEGIN SELECT RAISE(ABORT,'fail'); END")
    const key = crypto.randomUUID()
    await expect(createXDraft(db, key, { content: 'atomic' })).rejects.toThrow()
    expect(sqlite.prepare('SELECT count(*) AS n FROM x_drafts').get()).toMatchObject({ n: 0 })
    sqlite.exec('DROP TRIGGER fail_receipt')
    expect(await createXDraft(db, key, { content: 'atomic' })).toMatchObject({ replayed: false })
  })
  it('applies migration twice to the previous schema without changing existing data', () => {
    const old = new DatabaseSync(':memory:')
    try {
      old.exec(readFileSync('db/schema.sql', 'utf8').split('-- X post drafts and content-free creation receipts.')[0])
      old.exec("INSERT INTO notes(id,title,content) VALUES ('preserve','keep','private')")
      const before = old.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name").all()
      const migration = readFileSync('db/migrations/2026-10-18-x-drafts.sql', 'utf8')
      old.exec(migration); old.exec(migration)
      expect(old.prepare('SELECT title,content,revision FROM notes').get()).toMatchObject({ title: 'keep', content: 'private', revision: 1 })
      expect(old.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '%x_draft%' ORDER BY name").all()).toEqual(before)
      old.exec("INSERT INTO x_drafts(id,content) VALUES ('draft','one'); UPDATE x_drafts SET content='two' WHERE id='draft'")
      expect(old.prepare('SELECT revision FROM x_drafts').get()).toMatchObject({ revision: 2 })
      expect(old.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally { old.close() }
  })
})

describe('X operations', () => {
  it('isolates accounts by default, searches working copy and preserves the Agent original', async () => {
    const a = (await create('Agent 原稿')).draft
    const b = (await createXDraft(db, crypto.randomUUID(), { content: '娱乐文案', account_id: 'bg' })).draft
    expect((await listXDrafts(db, {})).items.map(d => d.id)).toEqual([a.id])
    expect((await listXDrafts(db, { account_id: 'bg' })).items.map(d => d.id)).toEqual([b.id])
    expect((await listXDrafts(db, { account_id: 'all' })).total).toBe(2)
    const edited = await updateXDraft(db, a.id, a.revision, { edited_content: '自己的长文案'.repeat(100) })
    expect(edited).toMatchObject({ content: 'Agent 原稿', edited_content: '自己的长文案'.repeat(100), revision: 2 })
    expect((await listXDrafts(db, { q: '自己的' })).items[0].id).toBe(a.id)
    await expect(updateXDraft(db, a.id, a.revision, { edited_content: 'stale' })).rejects.toMatchObject({ status: 412 })
    const moved = await updateXDraft(db, a.id, edited.revision, { account_id: 'bg', edited_content: null })
    expect(moved).toMatchObject({ account_id: 'bg', content: 'Agent 原稿', edited_content: null })
    expect((await listXDrafts(db, {})).total).toBe(0)
  })
  it('replays default and bg accounts but rejects switching account under the same key', async () => {
    const key = crypto.randomUUID(), fields = { content: 'draft' }
    const first = await createXDraft(db, key, fields)
    expect(await createXDraft(db, key, { ...fields, account_id: 'ai' })).toMatchObject({ replayed: true, draft: { id: first.draft.id } })
    await expect(createXDraft(db, key, { ...fields, account_id: 'bg' })).rejects.toMatchObject({ status: 409 })
    const bgKey = crypto.randomUUID()
    await createXDraft(db, bgKey, { ...fields, account_id: 'bg' })
    expect(await createXDraft(db, bgKey, { ...fields, account_id: 'bg' })).toMatchObject({ replayed: true })
    await expect(createXDraft(db, bgKey, fields)).rejects.toMatchObject({ status: 409 })
  })
  it('migrates historical drafts and receipts without changing IDs, revisions or content', async () => {
    const old = new DatabaseSync(':memory:')
    try {
      old.exec(readFileSync('tests/fixtures/pre-brain-schema.sql', 'utf8'))
      old.exec(readFileSync('db/migrations/2026-10-18-x-drafts.sql', 'utf8'))
      const digest = async (s: string) => Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))).toString('hex')
      const key = crypto.randomUUID(), keyHash = await digest(key)
      const bodyHash = await digest(JSON.stringify(['Original', 'https://x.com/example/status/123', 'other']))
      old.prepare("INSERT INTO x_drafts(id,content,source_url,status,posted_url,revision) VALUES (?,?,?,'posted',?,7)")
        .run(`xd-${keyHash}`, 'Original', 'https://x.com/example/status/123', 'https://x.com/example/status/456')
      old.prepare('INSERT INTO x_draft_creates(key_hash,request_hash,draft_id) VALUES (?,?,?)').run(keyHash, bodyHash, `xd-${keyHash}`)
      const before = old.prepare('SELECT * FROM x_drafts').get()
      old.exec(readFileSync('db/migrations/2026-10-25-x-operations.sql', 'utf8'))
      expect(old.prepare('SELECT * FROM x_drafts').get()).toEqual({ ...before, account_id: 'ai', edited_content: null })
      const legacyDb = new LocalD1(old) as unknown as Database
      expect(await createXDraft(legacyDb, key, { content: 'Original', source_url: 'https://x.com/example/status/123' })).toMatchObject({ replayed: true, draft: { revision: 7, status: 'posted' } })
      expect(old.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally { old.close() }
  })
})

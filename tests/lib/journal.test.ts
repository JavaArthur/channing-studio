import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { beforeEach, afterEach, it, expect } from 'vitest'
import { LocalD1 } from '../helpers/local-d1'
import type { Database } from '@/lib/repositories/schema'
import { captureLibraryItem, searchLibrary, updateLibraryItem } from '@/lib/repositories/library'
import { saveBrainItem } from '@/lib/repositories/brain'
import { journalDate, journalKind } from '@/lib/library/journal'
let sqlite: DatabaseSync, db: Database
beforeEach(() => { sqlite = new DatabaseSync(':memory:'); sqlite.exec(readFileSync('db/schema.sql', 'utf8')); db = new LocalD1(sqlite) as unknown as Database })
afterEach(() => sqlite.close())
const capture = (title: string, topics: string[], extra = {}) => captureLibraryItem(db, { request_key: crypto.randomUUID(), type: 'note', title, content: '实践与回顾', topics, ...extra })
it('includes existing tagged notes, excludes other content kinds, and counts filtered pagination from actual records', async () => {
  sqlite.prepare('INSERT INTO notes(id,title,content) VALUES (?,?,?)').run('legacy', '原有学习', '原文')
  sqlite.prepare('UPDATE library_metadata SET topics_json=? WHERE kind=? AND item_id=?').run(JSON.stringify(['学习记录', '已有主题']), 'note', 'legacy')
  await capture('日复盘', ['日复盘'])
  await capture('普通笔记', ['工程'])
  await capture('已归档', ['学习记录'], { })
  const archived = (await searchLibrary(db, { q: '已归档' })).items[0]
  await updateLibraryItem(db, 'note', archived.id, archived.revision, { archived: true })
  await capture('带同名标签的工具', ['学习记录'], { type: 'tool', source_url: 'https://example.com' })
  await capture('文章', ['日复盘'], { type: 'article', source_url: 'https://example.com/article' })
  const result = await searchLibrary(db, { journal: 'all', limit: 1 })
  expect(result.total).toBe(2)
  expect(result.items).toHaveLength(1)
  expect(result.has_more).toBe(true)
  expect((await searchLibrary(db, { journal: 'all', limit: 1, page: 2 })).items).toHaveLength(1)
  expect((await searchLibrary(db, { journal: 'learning', q: '原有' })).items[0].id).toBe('legacy')
  expect((await searchLibrary(db, { journal: 'reflection' })).total).toBe(1)
  expect((await searchLibrary(db, { journal: 'all', q: "' OR 1=1" })).total).toBe(0)
})
it('keeps same-day reflections separate, retries exact requests idempotently, and reuses project collections', async () => {
  const project = await saveBrainItem(db, 'projects', { title: '学习实验项目' })
  const input = { request_key: crypto.randomUUID(), type: 'note' as const, title: '2026-11-08 · 日复盘', content: '第一次', topics: ['日复盘'], collection_ids: [project] }
  const one = await captureLibraryItem(db, input)
  const retry = await captureLibraryItem(db, input)
  const two = await captureLibraryItem(db, { ...input, request_key: crypto.randomUUID(), content: '第二次' })
  expect(one.item.id).toBe(retry.item.id)
  expect(one.item.id).not.toBe(two.item.id)
  expect((await searchLibrary(db, { journal: 'reflection', collection: project })).total).toBe(2)
  expect(sqlite.prepare('SELECT count(*) AS n FROM posts').get()!.n).toBe(0)
  expect(sqlite.prepare('SELECT count(*) AS n FROM notes').get()!.n).toBe(2)
})
it('uses Asia/Shanghai boundaries consistently and recognizes only deliberate journal tags', () => {
  expect(journalDate(new Date('2026-11-07T16:00:00Z'))).toBe('2026-11-08')
  expect(journalDate(new Date('2026-11-07T15:59:59Z'))).toBe('2026-11-07')
  expect(journalKind(['日复盘'])).toBe('reflection')
  expect(journalKind(['学习记录'])).toBe('learning')
  expect(journalKind(['学习记录器'])).toBeNull()
})

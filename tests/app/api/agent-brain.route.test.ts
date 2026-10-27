import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalD1 } from '../../helpers/local-d1'
import * as routes from '@/lib/agent-brain/routes'
import { saveBrainItem } from '@/lib/repositories/brain'
import { setProjectLink } from '@/lib/repositories/project-links'
import type { Database } from '@/lib/repositories/schema'

const state = vi.hoisted(() => ({ env: {} as Partial<CloudflareEnv> }))
vi.mock('@/lib/cloudflare', () => ({ getAppCloudflareEnv: async () => state.env }))
let sqlite: DatabaseSync; let db: Database
const token = 'local-hermes-agent-test-credential'
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync('db/schema.sql', 'utf8'))
  db = new LocalD1(sqlite) as unknown as Database
  state.env = { DB: db, HERMES_SYNC_TOKEN: token }
})
afterEach(() => sqlite.close())
function call(handler: keyof typeof routes, method: string, kind: string, body?: unknown, id?: string, extra: Record<string, string> = {}, query = '', noteId?: string) {
  return routes[handler](new NextRequest(`http://localhost/api/agent/v1/brain/${kind}${query}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }), { params: Promise.resolve({ kind, id, noteId }) })
}
async function create(kind = 'notes', title = 'test note', key = crypto.randomUUID()) {
  const response = await call('collectionPOST', 'POST', kind, { title }, undefined, { 'Idempotency-Key': key })
  expect(response.status).toBe(201)
  return (await response.json()).item
}

describe('general Agent workspace HTTP API', () => {
  it('requires the Hermes bearer, rejects cookies and qm_ tokens, and keeps even errors private', async () => {
    for (const Authorization of ['', 'Bearer qm_test', 'Bearer wrong']) {
      const response = await call('collectionGET','GET','notes',undefined,undefined,{ Authorization, Cookie: 'qmblog_admin=not-an-agent-token' })
      expect(response.status).toBe(401)
      expect(response.headers.get('cache-control')).toContain('no-store')
      expect(response.headers.get('vary')).toBe('Authorization')
    }
    state.env.HERMES_SYNC_TOKEN = undefined
    expect((await call('collectionGET','GET','notes')).status).toBe(401)
  })
  it('replays durable creation receipts, rejects key collisions, and returns the current item after edits', async () => {
    const key = 'request-key-for-retry-001'
    const first = await create('notes','first',key)
    await saveBrainItem(db,'notes',{ title:'human edit', content:'keep this' },first.id)
    const replay = await call('collectionPOST','POST','notes',{ title:'first', content:'', source_url:null },undefined,{'Idempotency-Key':key})
    expect(replay.status).toBe(200)
    expect(await replay.json()).toMatchObject({ replayed:true,item:{ title:'human edit',revision:2 } })
    expect((await call('collectionPOST','POST','notes',{title:'changed'},undefined,{'Idempotency-Key':key})).status).toBe(409)
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM notes').get()).toMatchObject({n:1})
    // Per-resource namespaces; the same key can create a project without colliding with a note.
    await create('projects','first',key)
  })
  it('uses partial updates, strong versions, and same-second admin edits invalidate stale requests', async () => {
    const item = await create()
    expect((await call('itemPATCH','PATCH','notes',{title:'bad'},item.id)).status).toBe(428)
    expect((await call('itemPATCH','PATCH','notes',{title:'bad'},item.id,{'If-Match':'*'})).status).toBe(400)
    await saveBrainItem(db,'notes',{title:'human',content:'human content',source_url:'https://example.com'},item.id)
    const stale = await call('itemPATCH','PATCH','notes',{title:'stale'},item.id,{'If-Match':'"1"'})
    expect(stale.status).toBe(412)
    const update = await call('itemPATCH','PATCH','notes',{title:'bot'},item.id,{'If-Match':'"2"'})
    expect(update.status).toBe(200)
    expect(update.headers.get('etag')).toBe('"3"')
    expect((await update.json()).item).toMatchObject({title:'bot',content:'human content',source_url:'https://example.com',revision:3})
    const pair = await Promise.all([
      call('itemPATCH','PATCH','notes',{title:'first'},item.id,{'If-Match':'"3"'}),
      call('itemPATCH','PATCH','notes',{title:'second'},item.id,{'If-Match':'"3"'}),
    ])
    expect(pair.map(r=>r.status).sort()).toEqual([200,412])
  })
  it('paginates and searches literal text across content, excluding archived items by default', async () => {
    for (let n=0;n<32;n++) await saveBrainItem(db,'notes',{title:`row ${n}`,content:n===0?'needle 100%_value':'ordinary'})
    const page = await call('collectionGET','GET','notes',undefined,undefined,{},'?page=2&limit=30')
    expect(await page.json()).toMatchObject({total:32,page:2,has_more:false,items:expect.any(Array)})
    const search = await call('collectionGET','GET','notes',undefined,undefined,{},'?q=100%25_value')
    const found = await search.json(); expect(found.items).toHaveLength(1)
    expect(found.items[0]).not.toHaveProperty('content')
    await call('itemPATCH','PATCH','notes',{archived:true},found.items[0].id,{'If-Match':'"1"'})
    expect((await (await call('collectionGET','GET','notes')).json()).total).toBe(31)
    expect((await (await call('collectionGET','GET','notes',undefined,undefined,{},'?archived=only')).json()).total).toBe(1)
    expect((await call('collectionGET','GET','notes',undefined,undefined,{},'?limit=51')).status).toBe(400)
    expect((await call('collectionGET','GET','notes',undefined,undefined,{},'?page=1&page=2')).status).toBe(400)
  })
  it('converts inbox atomically into a private note and restores organized state without duplicating notes', async () => {
    const source = await create('inbox','collect this')
    const converted = await call('convertPOST','POST','inbox',{target:'note'},source.id,{'If-Match':'"1"'})
    expect(converted.status).toBe(200)
    const result = await converted.json()
    expect(result.item).toMatchObject({status:'organized',revision:2,target_id:result.note.id})
    expect(result.note).toMatchObject({title:'collect this',archived:0,revision:1})
    expect((await call('convertPOST','POST','inbox',{target:'note'},source.id,{'If-Match':'"1"'})).status).toBe(412)
    expect((await (await call('convertPOST','POST','inbox',{target:'note'},source.id,{'If-Match':'"2"'})).json()).created).toBe(false)
    await call('itemPATCH','PATCH','inbox',{archived:true},source.id,{'If-Match':'"2"'})
    const restored = await call('itemPATCH','PATCH','inbox',{archived:false},source.id,{'If-Match':'"3"'})
    expect((await restored.json()).item.status).toBe('organized')
    expect(sqlite.prepare('SELECT count(*) AS n FROM notes').get()).toMatchObject({n:1})
    expect(sqlite.prepare('SELECT count(*) AS n FROM posts').get()).toMatchObject({n:0})
  })
  it('rolls back a failed conversion rather than leaving an orphan destination', async () => {
    const source = await create('inbox')
    sqlite.exec("CREATE TRIGGER fail_convert BEFORE UPDATE ON inbox_items WHEN NEW.status='organized' BEGIN SELECT RAISE(ABORT,'test failure'); END")
    expect((await call('convertPOST','POST','inbox',{target:'note'},source.id,{'If-Match':'"1"'})).status).toBe(500)
    expect(sqlite.prepare('SELECT count(*) AS n FROM notes').get()).toMatchObject({n:0})
    expect(sqlite.prepare('SELECT status,revision FROM inbox_items').get()).toMatchObject({status:'inbox',revision:1})
  })
  it('links/unlinks notes with project revision checks and never publishes private project fields', async () => {
    const project = await create('projects','private title'); const note = await create()
    const linked = await call('notePUT','PUT','projects',undefined,project.id,{'If-Match':'"1"'},'',note.id)
    expect(linked.status).toBe(200); expect(linked.headers.get('etag')).toBe('"2"')
    expect((await call('noteDELETE','DELETE','projects',undefined,project.id,{'If-Match':'"1"'},'',note.id)).status).toBe(412)
    const links = await (await call('notesGET','GET','projects',undefined,project.id)).json()
    expect(links.items).toHaveLength(1);expect(links.items[0].id).toBe(note.id)
    expect((await call('noteDELETE','DELETE','projects',undefined,project.id,{'If-Match':'"2"'},'',note.id)).headers.get('etag')).toBe('"3"')
    await setProjectLink(db,project.id,'note',note.id)
    expect((await (await call('itemGET','GET','projects',undefined,project.id)).json()).item.revision).toBe(4)
    const current = (await (await call('itemGET','GET','projects',undefined,project.id)).json()).item
    expect(current).not.toHaveProperty('published_payload')
    expect((await call('itemPATCH','PATCH','projects',{published_payload:'leak'},project.id,{'If-Match':`"${current.revision}"`})).status).toBe(400)
  })
  it('rejects unsupported fields, URLs, malformed bodies, invalid targets, and missing records', async () => {
    for(const body of [{title:'x',source_url:'javascript:alert(1)'},{title:'x',source_url:'https://user:password@example.com'},{title:'x',source:'flomo'},{title:'x',id:'overwrite'},{title:'x',content:'x'.repeat(50001)}])
      expect((await call('collectionPOST','POST','notes',body,undefined,{'Idempotency-Key':'request-invalid-body'})).status).toBe(400)
    expect((await call('collectionPOST','POST','notes',{title:'x'})).status).toBe(400)
    expect((await call('collectionGET','GET','posts')).status).toBe(404)
    expect((await call('itemGET','GET','notes',undefined,'missing')).status).toBe(404)
    expect((await call('collectionPOST','POST','notes',{title:'x'},undefined,{'Idempotency-Key':'request-contenttype','Content-Type':'text/plain'})).status).toBe(415)
    expect((await call('collectionPOST','POST','notes',{title:'x',content:'界'.repeat(100000)},undefined,{'Idempotency-Key':'request-large-body'})).status).toBe(413)
    const p = await create('projects'); const n = await create()
    await call('itemPATCH','PATCH','notes',{archived:true},n.id,{'If-Match':'"1"'})
    expect((await call('notePUT','PUT','projects',undefined,p.id,{'If-Match':'"1"'},'',n.id)).status).toBe(409)
  })
  it('upgrades the previous schema without changing data and versions admin operations', () => {
    const old = new DatabaseSync(':memory:')
    try {
      old.exec(readFileSync('tests/fixtures/pre-brain-schema.sql','utf8'))
      old.exec(readFileSync('db/migrations/2026-10-16-personal-brain.sql','utf8'))
      old.exec("INSERT INTO notes(id,title,content) VALUES ('old','before','private'); INSERT INTO projects(id,title) VALUES ('p','project')")
      old.exec(readFileSync('db/migrations/2026-10-17-agent-brain-api.sql','utf8'))
      old.exec("UPDATE notes SET title='after' WHERE id='old'; INSERT INTO project_links VALUES ('p','note','old')")
      expect(old.prepare('SELECT content,revision FROM notes').get()).toMatchObject({content:'private',revision:2})
      expect(old.prepare('SELECT revision FROM projects').get()).toMatchObject({revision:2})
      expect(old.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally { old.close() }
  })
})

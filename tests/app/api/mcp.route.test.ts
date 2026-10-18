import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { handleMcpRequest } from '@/lib/mcp/route'
import { createAgentBrainItem, convertAgentInbox, getAgentBrainItem } from '@/lib/repositories/agent-brain'
import { organizeInboxIntoProject } from '@/lib/repositories/mcp-workflows'
import { parseFields } from '@/lib/agent-brain/validation'
import type { Database } from '@/lib/repositories/schema'
import { LocalD1 } from '../../helpers/local-d1'

const state = vi.hoisted(() => ({ env: {} as Partial<CloudflareEnv> }))
vi.mock('@/lib/cloudflare', () => ({ getAppCloudflareEnv: async () => state.env }))
const writeToken = 'synthetic-mcp-write-test-credential'
const readToken = 'synthetic-mcp-read-test-credential'
let sqlite: DatabaseSync; let db: Database
const clients: Client[] = []
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync('db/schema.sql', 'utf8'))
  db = new LocalD1(sqlite) as unknown as Database
  state.env = { DB: db, MCP_READ_TOKEN: readToken, MCP_WRITE_TOKEN: writeToken, HERMES_SYNC_TOKEN: 'synthetic-hermes-test' }
})
afterEach(async () => { await Promise.all(clients.splice(0).map(c => c.close())); sqlite.close() })
async function client(token = writeToken) {
  const c = new Client({ name: 'integration-test', version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(new URL('http://localhost/mcp'), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
    fetch: async (url, init) => handleMcpRequest(new Request(url, init)),
  })
  await c.connect(transport); clients.push(c)
  return c
}
async function tool(c: Client, name: string, args: Record<string, unknown> = {}) {
  const response = await c.callTool({ name, arguments: args })
  expect(response.isError, JSON.stringify(response)).not.toBe(true)
  return response.structuredContent as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
}
async function fixture() {
  const inbox = (await createAgentBrainItem(db, 'inbox', crypto.randomUUID(), parseFields('inbox', { title: 'capture', content: 'private content', source_url: 'https://example.com' }, true))).item
  const project = (await createAgentBrainItem(db, 'projects', crypto.randomUUID(), parseFields('projects', { title: 'project' }, true))).item
  return { request_key: crypto.randomUUID(), inbox_id: inbox.id, project_id: project.id, inbox_revision: inbox.revision, project_revision: project.revision }
}
function raw(body: unknown, extra: Record<string,string> = {}, method = 'POST') {
  return handleMcpRequest(new Request('http://localhost/mcp', { method,
    headers: { Authorization: `Bearer ${writeToken}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25', ...extra },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  }))
}
const rpc = { jsonrpc:'2.0', id:1, method:'tools/list', params:{} }

describe('MCP Streamable HTTP', () => {
  it('reports the package version and tools.listChanged on initialize for both credentials', async () => {
    const expected = JSON.parse(readFileSync('package.json', 'utf8')).version
    expect(expected).toBe('0.2.0')
    for (const token of [writeToken, readToken]) {
      const c = await client(token)
      expect(c.getServerVersion()).toEqual({ name: 'channing-studio', version: expected })
      expect(c.getServerCapabilities()?.tools?.listChanged).toBe(true)
    }
  })
  it('negotiates with the official SDK, discovers schemas, and verifies a connection without reading private contents', async () => {
    const c = await client()
    expect(c.getServerVersion()?.name).toBe('channing-studio')
    const { tools } = await c.listTools()
    expect(tools).toHaveLength(14)
    expect(tools.find(t => t.name === 'organize_inbox')?.inputSchema.required).toContain('project_revision')
    expect(tools.find(t => t.name === 'organize_inbox')?.inputSchema.additionalProperties).toBe(false)
    expect(await tool(c, 'workspace_status')).toMatchObject({ connected: true, access:'write' })
    const response = await raw(rpc)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(response.headers.has('mcp-session-id')).toBe(false)
  })
  it('requires dedicated credentials, enforces origin validation and read-only capabilities on every request', async () => {
    for (const token of ['', 'qm_invalid', 'synthetic-hermes-test']) {
      const response = await raw(rpc, { Authorization: token ? `Bearer ${token}` : '', Cookie:'qmblog_admin=invalid' })
      expect(response.status).toBe(401); expect(response.headers.get('cache-control')).toContain('no-store')
    }
    expect((await raw(rpc, {Origin:'https://evil.example'})).status).toBe(403)
    expect((await raw(rpc, {Origin:'http://localhost'})).status).toBe(200)
    const c = await client(readToken)
    expect((await c.listTools()).tools.map(t=>t.name)).toEqual(['workspace_status','search_workspace','get_item','get_project_context','list_x_drafts','get_x_draft'])
    expect(await tool(c,'workspace_status')).toMatchObject({access:'read'})
    const denied = await c.callTool({name:'capture_inbox',arguments:{request_key:crypto.randomUUID(),title:'denied'}})
    expect(denied.isError).toBe(true)
    expect(sqlite.prepare('SELECT count(*) AS n FROM inbox_items').get()).toMatchObject({n:0})
    state.env.MCP_READ_TOKEN = undefined
    expect((await raw(rpc,{Authorization:`Bearer ${readToken}`})).status).toBe(401)
  })
  it('completes capture → note → project atomically through the SDK, then replays original arguments and archives fixtures', async () => {
    const c = await client()
    const inbox = (await tool(c,'capture_inbox',{request_key:crypto.randomUUID(),title:'collected',content:'private text',source_url:'https://example.com'})).item
    const project = (await tool(c,'create_project',{request_key:crypto.randomUUID(),title:'private project'})).item
    const args = {request_key:crypto.randomUUID(),inbox_id:inbox.id,project_id:project.id,inbox_revision:inbox.revision,project_revision:project.revision}
    const organized = await tool(c,'organize_inbox',args)
    expect(organized).toMatchObject({replayed:false,created_note:true,added_link:true,currently_linked:true,inbox:{status:'organized'},note:{title:'collected',content:'private text',archived:0},project:{revision:2}})
    expect(await tool(c,'organize_inbox',args)).toMatchObject({replayed:true,currently_linked:true,note:{id:organized.note.id}})
    expect((await tool(c,'get_project_context',{project_id:project.id})).notes.items).toHaveLength(1)
    expect((await tool(c,'search_workspace',{kind:'notes',q:'private text'})).total).toBe(1)
    const collision = await c.callTool({name:'organize_inbox',arguments:{...args,project_revision:2}})
    expect(collision).toMatchObject({isError:true,structuredContent:{error:{status:409}}})
    expect(sqlite.prepare('SELECT count(*) AS n FROM notes').get()).toMatchObject({n:1})
    expect(sqlite.prepare('SELECT count(*) AS n FROM posts').get()).toMatchObject({n:0})
    expect(sqlite.prepare('SELECT published_payload FROM projects').get()).toMatchObject({published_payload:null})
    for (const [kind,item,changes] of [['inbox',organized.inbox,{archived:true}],['notes',organized.note,{archived:true}],['projects',organized.project,{status:'archived'}]] as const)
      await tool(c,'update_item',{kind,id:item.id,expected_revision:item.revision,changes})
    expect((await tool(c,'get_project_context',{project_id:project.id})).notes.total).toBe(0)
    expect((await tool(c,'get_project_context',{project_id:project.id,archived:'all'})).notes.total).toBe(1)
  })
  it('reuses converted notes, preserves later edits/unlinks on replay and rejects archived or post targets', async () => {
    const input = await fixture()
    const converted = await convertAgentInbox(db,input.inbox_id,1)
    const args = {...input,inbox_revision:converted.item.revision}
    const first = await organizeInboxIntoProject(db,args)
    expect(first.created_note).toBe(false)
    sqlite.prepare('UPDATE notes SET content=? WHERE id=?').run('human edit',first.note.id)
    sqlite.prepare("DELETE FROM project_links WHERE project_id=? AND kind='note' AND target_id=?").run(input.project_id,first.note.id)
    const replay = await organizeInboxIntoProject(db,args)
    expect(replay).toMatchObject({replayed:true,currently_linked:false,note:{content:'human edit'}})
    sqlite.prepare("UPDATE projects SET status='archived' WHERE id=?").run(input.project_id)
    const project = await getAgentBrainItem(db,'projects',input.project_id)
    await expect(organizeInboxIntoProject(db,{...args,request_key:crypto.randomUUID(),project_revision:project.revision})).rejects.toMatchObject({status:409})
    const other = await fixture()
    sqlite.prepare("UPDATE inbox_items SET status='organized',target_type='post',target_id='post' WHERE id=?").run(other.inbox_id)
    await expect(organizeInboxIntoProject(db,{...other,inbox_revision:2})).rejects.toMatchObject({status:409})
  })
  it('rolls back note, source, link and receipt when any transactional write fails; retry succeeds', async () => {
    const input = await fixture()
    sqlite.exec("CREATE TRIGGER fail_link BEFORE INSERT ON project_links BEGIN SELECT RAISE(ABORT,'sensitive DB failure'); END")
    const c = await client()
    const failed = await c.callTool({name:'organize_inbox',arguments:input})
    expect(failed).toMatchObject({isError:true,structuredContent:{error:{status:500,message:'Workspace operation failed'}}})
    expect(JSON.stringify(failed)).not.toContain('sensitive')
    expect(sqlite.prepare('SELECT count(*) AS n FROM notes').get()).toMatchObject({n:0})
    expect(sqlite.prepare('SELECT count(*) AS n FROM agent_brain_workflows').get()).toMatchObject({n:0})
    expect(await getAgentBrainItem(db,'inbox',input.inbox_id)).toMatchObject({status:'inbox',revision:1})
    expect(await getAgentBrainItem(db,'projects',input.project_id)).toMatchObject({revision:1})
    sqlite.exec('DROP TRIGGER fail_link')
    expect(await tool(c,'organize_inbox',input)).toMatchObject({replayed:false,currently_linked:true})
  })
  it('rejects stale and between-read-and-write changes without orphan data', async () => {
    const input = await fixture()
    await expect(organizeInboxIntoProject(db,{...input,inbox_revision:2})).rejects.toMatchObject({status:412})
    await expect(organizeInboxIntoProject(db,{...input,project_revision:2})).rejects.toMatchObject({status:412})
    const batch = db.batch.bind(db)
    db.batch = async statements => {
      sqlite.prepare('UPDATE projects SET title=? WHERE id=?').run('human concurrent edit',input.project_id)
      return batch(statements)
    }
    await expect(organizeInboxIntoProject(db,input)).rejects.toMatchObject({status:412})
    expect(sqlite.prepare('SELECT count(*) AS n FROM notes').get()).toMatchObject({n:0})
    expect(sqlite.prepare('SELECT count(*) AS n FROM agent_brain_workflows').get()).toMatchObject({n:0})
    expect(await getAgentBrainItem(db,'inbox',input.inbox_id)).toMatchObject({status:'inbox',revision:1})
  })
  it('handles competing workflow calls without duplicate notes or links', async () => {
    const input = await fixture()
    const outcomes = await Promise.allSettled([organizeInboxIntoProject(db,input),organizeInboxIntoProject(db,input)])
    expect(outcomes.some(r=>r.status==='fulfilled')).toBe(true)
    expect(await organizeInboxIntoProject(db,input)).toMatchObject({replayed:true})
    expect(sqlite.prepare('SELECT count(*) AS n FROM notes').get()).toMatchObject({n:1})
    expect(sqlite.prepare('SELECT count(*) AS n FROM project_links').get()).toMatchObject({n:1})
    expect(sqlite.prepare('SELECT count(*) AS n FROM agent_brain_workflows').get()).toMatchObject({n:1})
  })
  it('validates transport, bounds and strict tool fields without authorizing arbitrary actions', async () => {
    expect((await raw(rpc,{},'GET')).status).toBe(405)
    expect((await raw(rpc,{},'DELETE')).status).toBe(405)
    expect((await raw(rpc,{'Content-Type':'text/plain'})).status).toBe(415)
    expect((await raw(rpc,{Accept:'text/html'})).status).toBe(406)
    expect((await raw(rpc,{'MCP-Protocol-Version':'2099-01-01'})).status).toBe(400)
    expect((await raw({data:'x'.repeat(270000)})).status).toBe(413)
    expect((await raw([rpc,rpc])).status).toBe(400)
    const c = await client()
    for (const args of [{request_key:crypto.randomUUID(),title:'x',source_url:'javascript:alert(1)'},{request_key:crypto.randomUUID(),title:'x',published:true}])
      expect((await c.callTool({name:'capture_inbox',arguments:args})).isError).toBe(true)
    expect((await c.callTool({name:'get_item',arguments:{kind:'posts',id:'x'}})).isError).toBe(true)
    const input = await fixture()
    expect((await c.callTool({name:'organize_inbox',arguments:{...input,project_revision:0}})).isError).toBe(true)
  })
  it('adds only the workflow table when migrating the previous schema', () => {
    const old = new DatabaseSync(':memory:')
    try {
      old.exec(readFileSync('db/schema.sql','utf8').split('-- Apply once after a production backup and recovery rehearsal.')[0])
      old.exec("INSERT INTO notes(id,title,content) VALUES ('preserve','keep','private')")
      old.exec(readFileSync('db/migrations/2026-10-18-mcp-workflows.sql','utf8'))
      expect(old.prepare('SELECT title,content,revision FROM notes').get()).toMatchObject({title:'keep',content:'private',revision:1})
      expect(old.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    } finally { old.close() }
  })
})

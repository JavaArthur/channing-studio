import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { handleMcpRequest } from '@/lib/mcp/route'
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
  state.env = { DB: db, MCP_READ_TOKEN: readToken, MCP_WRITE_TOKEN: writeToken }
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
function raw(body: unknown, extra: Record<string,string> = {}, method = 'POST') {
  return handleMcpRequest(new Request('http://localhost/mcp', { method,
    headers: { Authorization: `Bearer ${writeToken}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-11-25', ...extra },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  }))
}
const rpc = { jsonrpc:'2.0', id:1, method:'tools/list', params:{} }

describe('MCP X drafts', () => {
  it('requires authentication and limits read tools on discovery and invocation', async () => {
    expect((await raw(rpc, { Authorization: '' })).status).toBe(401)
    const c = await client(readToken)
    const names = (await c.listTools()).tools.map(t => t.name)
    expect(names).toContain('list_x_drafts'); expect(names).toContain('get_x_draft')
    expect(names).not.toContain('create_x_draft'); expect(names).not.toContain('update_x_draft')
    expect((await c.callTool({ name: 'create_x_draft', arguments: { request_key: crypto.randomUUID(), content: 'denied' } })).isError).toBe(true)
    expect(sqlite.prepare('SELECT count(*) AS n FROM x_drafts').get()).toMatchObject({ n: 0 })
    expect(await tool(c, 'list_x_drafts')).toMatchObject({ total: 0, items: [] })
  })
  it('creates, replays, reads, lists and updates without duplicating drafts', async () => {
    const c = await client()
    const args = { request_key: crypto.randomUUID(), content: '中文\nsecond line', source_type: 'aihot', source_url: 'https://example.com' }
    const first = await tool(c, 'create_x_draft', args)
    expect(first).toMatchObject({ replayed: false, draft: { char_count: 16, over_limit: false, revision: 1 } })
    expect(await tool(c, 'create_x_draft', args)).toMatchObject({ replayed: true, draft: { id: first.draft.id } })
    expect(sqlite.prepare('SELECT count(*) AS n FROM x_drafts').get()).toMatchObject({ n: 1 })
    expect(await c.callTool({ name: 'create_x_draft', arguments: { ...args, content: 'different' } })).toMatchObject({ isError: true, structuredContent: { error: { status: 409 } } })
    const reader = await client(readToken)
    expect(await tool(reader, 'get_x_draft', { id: first.draft.id })).toMatchObject({ draft: first.draft })
    expect(await tool(reader, 'list_x_drafts', { source_type: 'aihot', q: 'second' })).toMatchObject({ total: 1, items: [first.draft] })
    expect(await tool(c, 'update_x_draft', { id: first.draft.id, expected_revision: 1, changes: { status: 'posted', posted_url: 'https://x.com/example/status/123' } })).toMatchObject({ draft: { status: 'posted', revision: 2, posted_url: 'https://x.com/example/status/123', char_count: 16 } })
    expect(await c.callTool({ name: 'update_x_draft', arguments: { id: first.draft.id, expected_revision: 1, changes: { status: 'discarded' } } })).toMatchObject({ isError: true, structuredContent: { error: { status: 412 } } })
  })
  it.each(['pending', 'discarded'])('clears posted URLs when MCP changes status to %s', async status => {
    const c = await client()
    const { draft } = await tool(c, 'create_x_draft', { request_key: crypto.randomUUID(), content: 'status transition' })
    const { draft: posted } = await tool(c, 'update_x_draft', { id: draft.id, expected_revision: draft.revision, changes: { status: 'posted', posted_url: 'https://x.com/example/status/123' } })
    const { draft: cleared } = await tool(c, 'update_x_draft', { id: draft.id, expected_revision: posted.revision, changes: { status } })
    expect(cleared).toMatchObject({ status, posted_url: null, revision: posted.revision + 1 })
    expect(await tool(c, 'get_x_draft', { id: draft.id })).toMatchObject({ draft: { status, posted_url: null } })
    expect(await tool(c, 'update_x_draft', { id: draft.id, expected_revision: cleared.revision, changes: { status, posted_url: posted.posted_url } })).toMatchObject({ draft: { status, posted_url: null } })
  })
  it('lists all drafts with pending first, then creation time and id', async () => {
    sqlite.exec(`INSERT INTO x_drafts(id,content,status,created_at) VALUES
      ('pending-b','draft','pending',100), ('posted-new','draft','posted',300),
      ('pending-a','draft','pending',100), ('discarded','draft','discarded',200),
      ('pending-new','draft','pending',150)`)
    const c = await client(readToken)
    const listed = await tool(c, 'list_x_drafts', { status: 'all' })
    expect(listed.items.map((draft: { id: string }) => draft.id)).toEqual([
      'pending-new', 'pending-a', 'pending-b', 'posted-new', 'discarded',
    ])
  })
  it('rejects invalid links and strict extra fields at both nesting levels', async () => {
    const c = await client()
    const base = { request_key: crypto.randomUUID(), content: 'draft' }
    for (const extra of [{ source_url: 'javascript:alert(1)' }, { published: true }, { source_type: 'invalid space' }])
      expect((await c.callTool({ name: 'create_x_draft', arguments: { ...base, ...extra } })).isError).toBe(true)
    const { draft } = await tool(c, 'create_x_draft', base)
    for (const changes of [{ posted_url: 'data:text/html,test' }, { status: 'posted', surprise: true }])
      expect((await c.callTool({ name: 'update_x_draft', arguments: { id: draft.id, expected_revision: 1, changes } })).isError).toBe(true)
    expect((await c.callTool({ name: 'update_x_draft', arguments: { id: draft.id, expected_revision: 1, changes: { status: 'posted' }, extra: 1 } })).isError).toBe(true)
    expect((await c.callTool({ name: 'list_x_drafts', arguments: { extra: 1 } })).isError).toBe(true)
    expect((await c.callTool({ name: 'get_x_draft', arguments: { id: draft.id, extra: 1 } })).isError).toBe(true)
  })
})

it('routes MCP content by account and preserves working copy on retries', async () => {
  const c = await client()
  const args = { request_key: crypto.randomUUID(), content: 'Agent bg copy', account_id: 'bg' }
  const { draft } = await tool(c, 'create_x_draft', args)
  expect(await tool(c, 'list_x_drafts')).toMatchObject({ total: 0 })
  expect(await tool(c, 'list_x_drafts', { account_id: 'bg' })).toMatchObject({ total: 1 })
  await tool(c, 'update_x_draft', { id: draft.id, expected_revision: draft.revision, changes: { edited_content: 'Human working copy' } })
  expect(await tool(c, 'create_x_draft', args)).toMatchObject({ replayed: true, draft: { content: args.content, edited_content: 'Human working copy' } })
  expect(await c.callTool({ name: 'create_x_draft', arguments: { ...args, account_id: 'ai' } })).toMatchObject({ isError: true, structuredContent: { error: { status: 409 } } })
  for (const account_id of ['unknown', 'all'])
    expect((await c.callTool({ name: 'create_x_draft', arguments: { ...args, account_id } })).isError).toBe(true)
  const reader = await client(readToken)
  expect((await reader.callTool({ name: 'update_x_draft', arguments: { id: draft.id, expected_revision: 2, changes: { edited_content: 'denied' } } })).isError).toBe(true)
})

it('returns concise ai/bg parameter examples on status, listing and creation', async () => {
  const c = await client()
  const expected = {
    accounts: { ai: 'AI Agent 开发', bg: '娱乐八卦闲聊' },
    default_account_id: 'ai',
    create_example: { tool: 'create_x_draft', arguments: { account_id: 'bg', content: '已整理好的文案' } },
    list_example: { tool: 'list_x_drafts', arguments: { account_id: 'bg' } },
  }
  expect(await tool(c, 'workspace_status')).toMatchObject({ x_account_help: expected })
  expect(await tool(c, 'list_x_drafts')).toMatchObject({ x_account_help: expected })
  expect(await tool(c, 'create_x_draft', { request_key: crypto.randomUUID(), content: 'Default AI copy' }))
    .toMatchObject({ draft: { account_id: 'ai' }, x_account_help: expected })
  const listed = (await c.listTools()).tools.find(t => t.name === 'create_x_draft')!
  expect(listed.inputSchema.properties?.account_id).toMatchObject({ enum: ['ai', 'bg'] })
})

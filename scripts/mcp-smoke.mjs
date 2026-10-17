import { randomUUID } from 'node:crypto'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const endpoint = new URL(process.env.STUDIO_MCP_URL || 'http://127.0.0.1:8787/mcp')
if (!['https:', 'http:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search)
  throw new Error('Use an HTTP(S) MCP URL without credentials or query parameters')
if (endpoint.protocol !== 'https:' && !['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname))
  throw new Error('Remote MCP connections require HTTPS')
const credential = process.env.MCP_TOKEN
if (!credential) throw new Error('Set MCP_TOKEN through your credential store/environment; do not place it in arguments')
const client = new Client({ name: 'channing-studio-smoke', version: '1.0.0' })
const checks = []; const fixtures = []
let failure = false
function assert(condition, name) { if (!condition) throw new Error(name); checks.push(name) }
async function call(name, args = {}) {
  const result = await client.callTool({ name, arguments: args })
  if (result.isError) throw new Error(`Tool failed: ${name} (status ${result.structuredContent?.error?.status ?? 'unknown'})`)
  return result.structuredContent
}
try {
  await client.connect(new StreamableHTTPClientTransport(endpoint, {
    requestInit: { headers: { Authorization: `Bearer ${credential}` } },
  }))
  assert(client.getServerVersion()?.name === 'channing-studio', 'initialize')
  const tools = (await client.listTools()).tools
  assert(tools.some(t => t.name === 'workspace_status'), 'tools/list')
  const health = await call('workspace_status')
  assert(health.connected, 'workspace_status')
  if (process.argv.includes('--write')) {
    assert(health.access === 'write', 'write access')
    const marker = `MCP 验收 ${randomUUID()}`
    const captureArgs = {request_key:randomUUID(),title:marker,content:'Synthetic MCP workflow verification; safe to archive.'}
    const inbox = (await call('capture_inbox',captureArgs)).item
    fixtures.push({kind:'inbox',id:inbox.id})
    assert((await call('capture_inbox',captureArgs)).replayed === true, 'capture replay')
    const project = (await call('create_project',{request_key:randomUUID(),title:marker})).item
    fixtures.push({kind:'projects',id:project.id})
    const args = {request_key:randomUUID(),inbox_id:inbox.id,project_id:project.id,inbox_revision:inbox.revision,project_revision:project.revision}
    const result = await call('organize_inbox',args)
    fixtures.push({kind:'notes',id:result.note.id})
    assert(result.created_note && result.added_link && result.currently_linked, 'atomic organization')
    assert(result.inbox.status === 'organized' && result.note.content === captureArgs.content, 'source and note preserved')
    const replay = await call('organize_inbox',args)
    assert(replay.replayed && replay.note.id === result.note.id, 'workflow replay')
    const context = await call('get_project_context',{project_id:project.id})
    assert(context.notes.items.some(n => n.id === result.note.id), 'project association')
    const stale = await client.callTool({name:'update_item',arguments:{kind:'inbox',id:inbox.id,expected_revision:inbox.revision,changes:{title:'must not overwrite'}}})
    assert(stale.isError && stale.structuredContent?.error?.status === 412, 'stale revision rejected')
  }
} catch (error) {
  failure = true
  // Never print SDK transport objects, headers, tool contents or credentials.
  console.error('MCP verification failed:', error instanceof Error && !String(error.message).includes(credential)
    ? String(error.message).slice(0,300) : 'See server status and credential configuration')
} finally {
  // Only archive records created by this run. Never clean up arbitrary existing user records.
  for (const fixture of fixtures) {
    try {
      const {item} = await call('get_item',fixture)
      await call('update_item',{...fixture,expected_revision:item.revision,changes:fixture.kind==='projects'?{status:'archived'}:{archived:true}})
      checks.push(`archived ${fixture.kind}`)
    } catch {
      failure = true
      console.error('Archive incomplete; inspect this test record:', fixture.kind, fixture.id)
    }
  }
  if (fixtures.length === 3 && !failure) {
    try {
      const project = fixtures.find(f=>f.kind==='projects')
      const context = await call('get_project_context',{project_id:project.id,archived:'all'})
      assert(context.notes.items.some(n=>n.id===fixtures.find(f=>f.kind==='notes').id), 'archived association preserved')
    } catch { failure = true; console.error('Archived association verification failed') }
  }
  await client.close()
}
console.log(JSON.stringify({ok:!failure,endpoint:endpoint.href,checks,fixtures},null,2))
if (failure) process.exitCode = 1

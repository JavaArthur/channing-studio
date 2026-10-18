import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalD1 } from '../../helpers/local-d1'
import type { Database } from '@/lib/repositories/schema'

const mocks = vi.hoisted(() => ({ isAdminAuthenticated: vi.fn(), getRouteEnvWithDb: vi.fn() }))
vi.mock('@/lib/admin-auth', () => ({ COOKIE_NAME: 'qmblog_admin', isAdminAuthenticated: mocks.isAdminAuthenticated }))
vi.mock('@/lib/server/route-helpers', () => ({
  getRouteEnvWithDb: mocks.getRouteEnvWithDb,
  jsonError: (error: string, status = 500) => Response.json({ error }, { status }),
  jsonOk: (data: unknown, status = 200) => Response.json(data, { status }),
}))
import { GET, POST } from '@/app/api/admin/x-drafts/route'
import { PATCH } from '@/app/api/admin/x-drafts/[id]/route'
let sqlite: DatabaseSync
beforeEach(() => {
  vi.clearAllMocks()
  sqlite = new DatabaseSync(':memory:'); sqlite.exec(readFileSync('db/schema.sql', 'utf8'))
  mocks.getRouteEnvWithDb.mockResolvedValue({ ok: true, db: new LocalD1(sqlite) as unknown as Database })
  mocks.isAdminAuthenticated.mockResolvedValue(true)
})
afterEach(() => sqlite.close())
function request(method: string, body?: unknown, query = '') {
  return new NextRequest(`http://localhost/api/admin/x-drafts${query}`, { method,
    headers: { 'Content-Type': 'application/json', Cookie: 'qmblog_admin=synthetic-session' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}
describe('admin X drafts', () => {
  it('rejects unauthorized GET, POST and PATCH before accessing the database', async () => {
    mocks.isAdminAuthenticated.mockResolvedValue(false)
    for (const response of [await GET(request('GET')), await POST(request('POST', {})), await PATCH(request('PATCH', {}), { params: Promise.resolve({ id: 'draft' }) })])
      expect(response.status).toBe(401)
    expect(mocks.isAdminAuthenticated).toHaveBeenCalledWith('synthetic-session')
    expect(mocks.getRouteEnvWithDb).not.toHaveBeenCalled()
  })
  it('creates multiline content, lists filters and maps stale updates to 412', async () => {
    const content = 'first\n\nsecond'
    const created = await POST(request('POST', { content, source_type: 'blog_repurpose' }))
    expect(created.status).toBe(200)
    const { draft } = await created.json()
    expect(draft.content).toBe(content)
    const listed = await GET(request('GET', undefined, '?status=pending&q=second&source_type=blog_repurpose&page=1'))
    expect(await listed.json()).toMatchObject({ total: 1, items: [{ id: draft.id }] })
    const params = { params: Promise.resolve({ id: draft.id }) }
    expect((await PATCH(request('PATCH', { expected_revision: 1, changes: { status: 'posted', posted_url: 'https://twitter.com/example/status/123' } }), params)).status).toBe(200)
    expect((await PATCH(request('PATCH', { expected_revision: 1, changes: { status: 'discarded' } }), params)).status).toBe(412)
    expect((await PATCH(request('PATCH', { expected_revision: 2, changes: { posted_url: 'javascript:alert(1)' } }), params)).status).toBe(400)
  })
  it('rejects malformed or extra fields and invalid pagination', async () => {
    expect((await POST(request('POST', { content: 'x', status: 'posted' }))).status).toBe(400)
    expect((await POST(request('POST', null))).status).toBe(400)
    for (const query of ['?page=0', '?since=no', '?status=unknown', '?page=1&page=2', '?until=1&since=2'])
      expect((await GET(request('GET', undefined, query))).status).toBe(400)
  })
})

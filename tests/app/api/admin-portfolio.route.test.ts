import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LocalD1 } from '../../helpers/local-d1'
const mocks = vi.hoisted(() => ({
  isAdminAuthenticated: vi.fn(),
  getRouteEnvWithDb: vi.fn(),
  invalidatePublicContentCache: vi.fn(),
}))
vi.mock('@/lib/cache', () => ({ invalidatePublicContentCache: mocks.invalidatePublicContentCache }))
vi.mock('@/lib/admin-auth', () => ({
  COOKIE_NAME: 'qmblog_admin',
  isAdminAuthenticated: mocks.isAdminAuthenticated,
}))
vi.mock('@/lib/server/route-helpers', () => ({
  getRouteEnvWithDb: mocks.getRouteEnvWithDb,
  jsonError: (error: string, status = 500) => Response.json({ error }, { status }),
  jsonOk: (data: unknown) => Response.json(data),
}))
import { GET, POST } from '@/app/api/admin/portfolio/route'

let sqlite: DatabaseSync
beforeEach(() => {
  vi.clearAllMocks()
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync('db/schema.sql', 'utf8'))
  mocks.getRouteEnvWithDb.mockResolvedValue({ ok: true, db: new LocalD1(sqlite), env: {} })
  mocks.isAdminAuthenticated.mockResolvedValue(true)
})
afterEach(() => sqlite.close())

const request = (body?: unknown) =>
  new NextRequest('http://localhost/api/admin/portfolio', {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', cookie: 'qmblog_admin=synthetic' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
const project = { slug: 'c-foods', title: '今晚吃什么', summary: '家常菜', local_path: '~/ai/c-foods' }

it('requires an admin session before reading or changing projects', async () => {
  mocks.isAdminAuthenticated.mockResolvedValue(false)
  expect((await GET(request())).status).toBe(401)
  expect((await POST(request({ action: 'create', project }))).status).toBe(401)
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM portfolio_projects').get()).toEqual({ n: 0 })
})

it('creates, publishes and lists projects, invalidating the public cache on publish', async () => {
  const created = await POST(request({ action: 'create', project }))
  expect(created.status).toBe(200)
  const { id } = (await created.json()) as { id: number }
  expect(mocks.invalidatePublicContentCache).not.toHaveBeenCalled()
  expect((await POST(request({ action: 'publish', id, publish: true }))).status).toBe(200)
  expect(mocks.invalidatePublicContentCache).toHaveBeenCalledTimes(1)
  const { projects } = (await (await GET(request())).json()) as { projects: { local_path: string; published: unknown }[] }
  expect(projects[0]).toMatchObject({ local_path: '~/ai/c-foods', published: { slug: 'c-foods' } })
})

it('returns validation and conflict errors with their status instead of a generic failure', async () => {
  const unsafe = await POST(request({ action: 'create', project: { ...project, site_url: 'javascript:alert(1)' } }))
  expect(unsafe.status).toBe(400)
  expect((await unsafe.json()).error).toContain('网站地址')
  expect((await POST(request({ action: 'create', project, extra: true }))).status).toBe(400)
  await POST(request({ action: 'create', project }))
  expect((await POST(request({ action: 'create', project }))).status).toBe(409)
  expect((await POST(request({ action: 'delete', id: 999 }))).status).toBe(404)
})

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
import { POST } from '@/app/api/admin/library/route'
let sqlite: DatabaseSync
beforeEach(() => {
  vi.clearAllMocks()
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync('db/schema.sql', 'utf8'))
  mocks.getRouteEnvWithDb.mockResolvedValue({ ok: true, db: new LocalD1(sqlite) })
  mocks.isAdminAuthenticated.mockResolvedValue(true)
})
afterEach(() => sqlite.close())
const request = (body: unknown) =>
  new NextRequest('http://localhost/api/admin/library', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: 'qmblog_admin=synthetic' },
    body: JSON.stringify(body),
  })
it('rejects every library action before touching private data without an admin session', async () => {
  mocks.isAdminAuthenticated.mockResolvedValue(false)
  for (const action of [
    'get',
    'search',
    'publication_get',
    'capture',
    'update',
    'handoff',
    'link',
    'collection',
    'collection_update',
    'draft',
    'publish',
  ])
    expect((await POST(request({ action }))).status).toBe(401)
  expect(mocks.getRouteEnvWithDb).not.toHaveBeenCalled()
})
it('preserves provenance through manual capture, handoff and optimistic updates', async () => {
  const response = await POST(
    request({
      action: 'capture',
      input: {
        request_key: crypto.randomUUID(),
        type: 'article',
        title: 'Source',
        content: '## Body',
        source_url: 'https://example.com/source',
      },
    }),
  )
  expect(response.status).toBe(200)
  const { item } = await response.json()
  expect(item.submitted_by).toBe('manual')
  const ref = { kind: item.kind, id: item.id }
  const handoff = await POST(request({ action: 'handoff', items: [ref], instruction: 'Compare' }))
  expect((await handoff.json()).text).toContain('https://example.com/source')
  expect(
    (
      await POST(
        request({
          action: 'update',
          ...ref,
          expected_revision: item.revision,
          changes: { content: 'human edit' },
        }),
      )
    ).status,
  ).toBe(200)
  expect(
    (
      await POST(
        request({
          action: 'update',
          ...ref,
          expected_revision: item.revision,
          changes: { content: 'stale' },
        }),
      )
    ).status,
  ).toBe(412)
  expect(
    (
      await POST(
        request({
          action: 'capture',
          input: {
            request_key: crypto.randomUUID(),
            type: 'tool',
            title: 'bad',
            source_url: 'javascript:alert(1)',
          },
        }),
      )
    ).status,
  ).toBe(400)
  expect((await POST(request({ action: 'handoff', items: [], instruction: '' }))).status).toBe(400)
})

import { GET as usageGet, POST as usagePost } from '@/app/api/admin/library/usage/route'
it('requires admin session for all history access and does not record server/MCP reads', async () => {
  mocks.isAdminAuthenticated.mockResolvedValue(false)
  expect((await usageGet(request({}))).status).toBe(401)
  for (const action of ['read', 'search', 'clear', 'collection', 'pin'])
    expect((await usagePost(request({ action }))).status).toBe(401)
  expect(mocks.getRouteEnvWithDb).not.toHaveBeenCalled()
  mocks.isAdminAuthenticated.mockResolvedValue(true)
  const result = await (
    await POST(
      request({
        action: 'capture',
        input: { request_key: crypto.randomUUID(), type: 'note', title: 'Read' },
      }),
    )
  ).json()
  await POST(request({ action: 'get', kind: result.item.kind, id: result.item.id }))
  await POST(request({ action: 'search', query: { q: 'Read' } }))
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM admin_recent_items').get()!.n).toBe(0)
  expect(
    (await usagePost(request({ action: 'read', kind: result.item.kind, id: result.item.id })))
      .status,
  ).toBe(200)
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM admin_recent_items').get()!.n).toBe(1)
})

it('invalidates public cache after publishing and withdrawing a library snapshot', async () => {
  const { item } = await (
    await POST(
      request({
        action: 'capture',
        input: {
          request_key: crypto.randomUUID(),
          type: 'prompt',
          title: 'Private',
          content: 'Text',
        },
      }),
    )
  ).json()
  const published = await POST(
    request({
      action: 'publish',
      kind: item.kind,
      id: item.id,
      expected_revision: item.revision,
      publish: true,
      fields: { title: 'Public', description: 'Reviewed', content: 'Public text' },
    }),
  )
  expect(published.status).toBe(200)
  expect(mocks.invalidatePublicContentCache).toHaveBeenCalledTimes(1)
  const updated = (await published.json()).item
  expect(
    (
      await POST(
        request({
          action: 'publish',
          kind: item.kind,
          id: item.id,
          expected_revision: updated.revision,
          publish: false,
          fields: { title: 'Public', description: 'Reviewed' },
        }),
      )
    ).status,
  ).toBe(200)
  expect(mocks.invalidatePublicContentCache).toHaveBeenCalledTimes(2)
})

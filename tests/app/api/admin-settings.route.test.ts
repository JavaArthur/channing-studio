import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  isAdminAuthenticated: vi.fn(),
  getRouteEnvWithDb: vi.fn(),
  parseJsonBody: vi.fn(),
  cookies: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  getSetting: mocks.getSetting,
  setSetting: mocks.setSetting,
}))

vi.mock('@/lib/admin-auth', () => ({
  COOKIE_NAME: 'qmblog_admin',
  isAdminAuthenticated: mocks.isAdminAuthenticated,
}))

vi.mock('@/lib/server/route-helpers', () => ({
  getRouteEnvWithDb: mocks.getRouteEnvWithDb,
  jsonError: (message: string, status = 500) => Response.json({ error: message }, { status }),
  jsonOk: (data: unknown, status = 200) => Response.json(data, { status }),
  parseJsonBody: mocks.parseJsonBody,
}))

vi.mock('next/headers', () => ({
  cookies: mocks.cookies,
}))

import { GET, POST } from '@/app/api/admin/settings/route'

describe('/api/admin/settings route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.cookies.mockResolvedValue({
      get: vi.fn(() => ({ value: 'admin-token' })),
    })
    mocks.isAdminAuthenticated.mockResolvedValue(true)
    mocks.getRouteEnvWithDb.mockResolvedValue({
      ok: true,
      db: { kind: 'db' },
      env: {},
    })
  })

  it('returns a setting value for an authorized GET request', async () => {
    mocks.getSetting.mockResolvedValue('[]')

    const response = await GET({
      nextUrl: new URL('http://test.local/api/admin/settings?key=nav_links'),
    } as never)
    const body = await response.json()

    expect(mocks.getSetting).toHaveBeenCalledWith({ kind: 'db' }, 'nav_links')
    expect(body).toEqual({ key: 'nav_links', value: '[]' })
  })

  it('rejects unauthorized requests before reading from the database', async () => {
    mocks.isAdminAuthenticated.mockResolvedValue(false)

    const response = await GET({
      nextUrl: new URL('http://test.local/api/admin/settings?key=nav_links'),
    } as never)

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(mocks.getSetting).not.toHaveBeenCalled()
  })

  it('stores non-string setting values as serialized JSON on POST', async () => {
    mocks.parseJsonBody.mockResolvedValue({
      key: 'nav_links',
      value: [{ label:'作品', url:'/work', openInNewTab:false }],
    })

    const response = await POST({} as never)
    const body = await response.json()

    expect(mocks.setSetting).toHaveBeenCalledWith(
      { kind: 'db' },
      'nav_links',
      JSON.stringify([{ label:'作品', url:'/work', openInNewTab:false }]),
    )
    expect(body).toEqual({ success: true })
  })
})

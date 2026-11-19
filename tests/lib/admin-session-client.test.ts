import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasAdminSessionHint, refreshAdminSession } from '@/lib/admin-session-client'
import { POST as logoutPOST } from '@/app/api/admin/logout/route'

describe('admin-session-client hint & logout', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns false on public routes when studio_admin_hint cookie is absent', () => {
    vi.stubGlobal('window', { location: { pathname: '/hello-world' } })
    vi.stubGlobal('document', { cookie: 'theme=dark; foo=bar' })

    expect(hasAdminSessionHint()).toBe(false)
  })

  it('returns true on public routes when studio_admin_hint=1 cookie is present', () => {
    vi.stubGlobal('window', { location: { pathname: '/hello-world' } })
    vi.stubGlobal('document', { cookie: 'theme=dark; studio_admin_hint=1; other=2' })

    expect(hasAdminSessionHint()).toBe(true)
  })

  it('does not match partial cookie names or non-1 values', () => {
    vi.stubGlobal('window', { location: { pathname: '/hello-world' } })
    vi.stubGlobal('document', { cookie: 'fake_studio_admin_hint=1; studio_admin_hint=0' })

    expect(hasAdminSessionHint()).toBe(false)
  })

  it('returns true on /admin routes even without the hint cookie', () => {
    vi.stubGlobal('window', { location: { pathname: '/admin/library' } })
    vi.stubGlobal('document', { cookie: '' })

    expect(hasAdminSessionHint()).toBe(true)
  })

  it('refreshAdminSession always fetches /api/admin/session even without hint cookie', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ authenticated: true }),
    })
    vi.stubGlobal('window', { location: { pathname: '/hello-world' } })
    vi.stubGlobal('document', { cookie: '' })
    vi.stubGlobal('fetch', fetchMock)

    await refreshAdminSession()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/session', {
      cache: 'no-store',
      credentials: 'include',
    })
  })

  it('POST /api/admin/logout clears both qmblog_admin and studio_admin_hint cookies', async () => {
    const response = await logoutPOST()
    expect(response.status).toBe(200)
    expect(response.cookies.get('qmblog_admin')?.value).toBe('')
    expect(response.cookies.get('studio_admin_hint')?.value).toBe('')
  })
})

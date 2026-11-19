import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAppCloudflareEnv: vi.fn(),
  authenticateRequest: vi.fn(),
  getRouteEnvWithDb: vi.fn(),
  ensureAuthenticatedRequest: vi.fn(),
}))

vi.mock('@/lib/cloudflare', () => ({
  getAppCloudflareEnv: mocks.getAppCloudflareEnv,
}))

vi.mock('@/lib/admin-auth', () => ({
  authenticateRequest: mocks.authenticateRequest,
}))

vi.mock('@/lib/server/route-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/server/route-helpers')>('@/lib/server/route-helpers')
  return {
    ...actual,
    getRouteEnvWithDb: mocks.getRouteEnvWithDb,
    ensureAuthenticatedRequest: mocks.ensureAuthenticatedRequest,
  }
})

import { POST as fetchMetaPost } from '@/app/api/tools/fetch-meta/route'
import { POST as fromUrlPost } from '@/app/api/uploads/from-url/route'

function createJsonRequest(body: unknown) {
  return {
    json: vi.fn(async () => body),
  } as never
}

describe('remote fetch route security (/api/tools/fetch-meta & /api/uploads/from-url)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getRouteEnvWithDb.mockResolvedValue({ ok: true, db: { kind: 'db' }, env: {} })
    mocks.ensureAuthenticatedRequest.mockResolvedValue(null)
    mocks.authenticateRequest.mockResolvedValue(true)
    mocks.getAppCloudflareEnv.mockResolvedValue({
      DB: { kind: 'db' },
      IMAGES: {
        get: vi.fn(async () => null),
        put: vi.fn(async () => undefined),
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('/api/tools/fetch-meta rejects SSRF targets before calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const resLocal = await fetchMetaPost(createJsonRequest({ url: 'http://127.0.0.1:8080/secret' }))
    expect(resLocal.status).toBe(403)

    const resCgnat = await fetchMetaPost(createJsonRequest({ url: 'http://100.64.0.1/status' }))
    expect(resCgnat.status).toBe(403)

    const resFile = await fetchMetaPost(createJsonRequest({ url: 'file:///etc/passwd' }))
    expect(resFile.status).toBe(400)

    const resCreds = await fetchMetaPost(createJsonRequest({ url: 'https://admin:secret@example.com' }))
    expect(resCreds.status).toBe(400)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('/api/tools/fetch-meta rejects redirects pointing to private networks', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, {
      status: 302,
      headers: { location: 'http://169.254.169.254/latest/meta-data/' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await fetchMetaPost(createJsonRequest({ url: 'https://public.example.com/jump' }))
    expect(res.status).toBe(403)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('/api/tools/fetch-meta uses MorningAIBlogBot UA and caps streamed HTML reads to 64KB', async () => {
    let cancelled = false
    const headChunk = new TextEncoder().encode(
      '<html><head><title>Morning Tool</title><meta name="description" content="Fast tool"></head><body>',
    )
    const padChunk = new TextEncoder().encode('x'.repeat(32_768))
    let count = 0

    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        count += 1
        controller.enqueue(count === 1 ? headChunk : padChunk)
      },
      cancel() {
        cancelled = true
      },
    })

    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await fetchMetaPost(createJsonRequest({ url: 'https://github.com/example/tool' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.meta.name).toBe('Morning Tool')
    expect(data.meta.description).toBe('Fast tool')
    expect(data.meta.type).toBe('repo')
    expect(cancelled).toBe(true)
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      redirect: 'manual',
      headers: expect.objectContaining({
        'User-Agent': 'Mozilla/5.0 (compatible; MorningAIBlogBot/1.0)',
      }),
    })
  })

  it('/api/uploads/from-url rejects CGNAT, credentials, and SSRF redirects', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, {
      status: 302,
      headers: { location: 'http://127.0.0.1/internal.png' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const resCgnat = await fromUrlPost(createJsonRequest({ url: 'http://100.64.10.5/pic.png' }))
    expect(resCgnat.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()

    const resRedirect = await fromUrlPost(createJsonRequest({ url: 'https://cdn.example.com/pic.png' }))
    expect(resRedirect.status).toBe(403)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

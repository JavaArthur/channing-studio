import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getRouteEnvWithDb: vi.fn(),
  ensureAuthenticatedRequest: vi.fn(),
  getPrompts: vi.fn(),
  createPrompt: vi.fn(),
}))

vi.mock('@/lib/server/route-helpers', () => ({
  getRouteEnvWithDb: mocks.getRouteEnvWithDb,
  ensureAuthenticatedRequest: mocks.ensureAuthenticatedRequest,
  jsonError: (error: string, status = 500) => Response.json({ error }, { status }),
  jsonOk: (payload: unknown, status = 200) => Response.json(payload, { status }),
  parseJsonBody: async <T>(req: Request) => await req.json() as T,
}))

vi.mock('@/lib/repositories/prompts', () => ({
  getPrompts: mocks.getPrompts,
  createPrompt: mocks.createPrompt,
  normalizePromptTags: (value: unknown) => Array.isArray(value) ? value : [],
  normalizePromptUrl: (value: unknown) => typeof value === 'string' && value.startsWith('https://') ? value : null,
}))

import { GET, POST } from '@/app/api/admin/prompts/route'

describe('/api/admin/prompts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getRouteEnvWithDb.mockResolvedValue({ ok: true, env: {}, db: { kind: 'db' } })
    mocks.getPrompts.mockResolvedValue([])
    mocks.createPrompt.mockResolvedValue(1)
  })

  it('rejects an unauthenticated list request', async () => {
    mocks.ensureAuthenticatedRequest.mockResolvedValue(Response.json({ error: 'Unauthorized' }, { status: 401 }))

    const response = await GET(new Request('http://localhost/api/admin/prompts'))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Unauthorized' })
    expect(mocks.getPrompts).not.toHaveBeenCalled()
  })

  it('rejects a prompt without title or body', async () => {
    mocks.ensureAuthenticatedRequest.mockResolvedValue(null)

    const response = await POST(new Request('http://localhost/api/admin/prompts', {
      method: 'POST',
      body: JSON.stringify({ title: '只有标题' }),
      headers: { 'content-type': 'application/json' },
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: '标题和提示词正文不能为空' })
    expect(mocks.createPrompt).not.toHaveBeenCalled()
  })
})

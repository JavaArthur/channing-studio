import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentRepositoryError } from '@/lib/agent-knowledge/errors'

const mocks = vi.hoisted(() => ({
  ensureHermesAgentRequest: vi.fn(),
  getRouteEnvWithDb: vi.fn(),
  parseJsonBody: vi.fn(),
  createAgentRun: vi.fn(),
  getAgentState: vi.fn(),
  completeAgentRun: vi.fn(),
  failAgentRun: vi.fn(),
  parseRunStartPayload: vi.fn((value) => value),
  parseCompleteRunPayload: vi.fn((value) => value),
  parseFailRunPayload: vi.fn((value) => value),
}))

vi.mock('@/lib/agent-knowledge/auth', () => ({
  ensureHermesAgentRequest: mocks.ensureHermesAgentRequest,
}))

vi.mock('@/lib/agent-knowledge/repository', () => ({
  createAgentRun: mocks.createAgentRun,
  getAgentState: mocks.getAgentState,
  completeAgentRun: mocks.completeAgentRun,
  failAgentRun: mocks.failAgentRun,
}))

vi.mock('@/lib/agent-knowledge/validation', () => ({
  parseRunStartPayload: mocks.parseRunStartPayload,
  parseCompleteRunPayload: mocks.parseCompleteRunPayload,
  parseFailRunPayload: mocks.parseFailRunPayload,
}))

vi.mock('@/lib/server/route-helpers', () => ({
  getRouteEnvWithDb: mocks.getRouteEnvWithDb,
  jsonError: (message: string, status = 500) => Response.json({ error: message }, { status }),
  jsonOk: (data: unknown, status = 200) => Response.json(data, { status }),
  parseJsonBody: mocks.parseJsonBody,
}))

import { POST as startRun } from '@/app/api/agent/v1/runs/route'
import { GET as getState } from '@/app/api/agent/v1/state/route'
import { POST as completeRun } from '@/app/api/agent/v1/runs/[id]/complete/route'
import { POST as failRun } from '@/app/api/agent/v1/runs/[id]/fail/route'

describe('Hermes agent API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getRouteEnvWithDb.mockResolvedValue({
      ok: true,
      db: { kind: 'db' },
      env: { HERMES_SYNC_TOKEN: 'configured' },
    })
    mocks.ensureHermesAgentRequest.mockResolvedValue(null)
  })

  it('rejects an unauthorized run before parsing its body', async () => {
    mocks.ensureHermesAgentRequest.mockResolvedValue(
      Response.json({ error: 'Unauthorized' }, { status: 401 }),
    )

    const response = await startRun({} as never)

    expect(response.status).toBe(401)
    expect(mocks.parseJsonBody).not.toHaveBeenCalled()
    expect(mocks.createAgentRun).not.toHaveBeenCalled()
  })

  it('starts a validated run and returns its id', async () => {
    const payload = {
      source: 'flomo',
      mode: 'hourly',
      windowStart: '2026-07-12',
      windowEnd: '2026-07-13',
    }
    mocks.parseJsonBody.mockResolvedValue(payload)
    mocks.createAgentRun.mockResolvedValue('run-1')

    const response = await startRun({} as never)

    expect(response.status).toBe(201)
    expect(mocks.createAgentRun).toHaveBeenCalledWith({ kind: 'db' }, payload)
    await expect(response.json()).resolves.toEqual({ runId: 'run-1' })
  })

  it('returns known source versions and pending candidates for a date window', async () => {
    mocks.getAgentState.mockResolvedValue({
      lastSuccessfulAt: 123,
      items: [{ sourceId: 'memo-1', sourceUpdatedAt: '2026-07-13T08:00:00Z', contentHash: 'hash' }],
      pendingSourceIds: ['memo-1'],
      blocked: null,
    })
    const request = {
      nextUrl: new URL('https://test.local/api/agent/v1/state?start_date=2026-07-12&end_date=2026-07-13'),
    } as never

    const response = await getState(request)

    expect(mocks.getAgentState).toHaveBeenCalledWith(
      { kind: 'db' },
      '2026-07-12',
      '2026-07-13',
    )
    expect(response.status).toBe(200)
  })

  it('completes a run with the validated atomic batch', async () => {
    const payload = { discoveredCount: 0, sourceItems: [], artifacts: [], snapshot: null }
    mocks.parseJsonBody.mockResolvedValue(payload)
    mocks.completeAgentRun.mockResolvedValue({ idempotent: false })

    const response = await completeRun({} as never, {
      params: Promise.resolve({ id: 'run-1' }),
    })

    expect(mocks.completeAgentRun).toHaveBeenCalledWith({ kind: 'db' }, 'run-1', payload)
    await expect(response.json()).resolves.toEqual({ success: true, idempotent: false })
  })

  it('records a sanitized run failure', async () => {
    const payload = {
      code: 'CHEN_NOTES_PULL_FAILED',
      message: '远端同步失败',
      retryable: true,
      nextAction: '修复 GitHub 凭据后重试',
    }
    mocks.parseJsonBody.mockResolvedValue(payload)

    const response = await failRun({} as never, {
      params: Promise.resolve({ id: 'run-1' }),
    })

    expect(mocks.failAgentRun).toHaveBeenCalledWith({ kind: 'db' }, 'run-1', payload)
    expect(response.status).toBe(200)
  })

  it('maps missing and conflicting runs without hiding repository failures', async () => {
    mocks.parseJsonBody.mockResolvedValue({ discoveredCount: 0, sourceItems: [], artifacts: [], snapshot: null })
    mocks.completeAgentRun.mockRejectedValueOnce(new AgentRepositoryError('运行记录不存在', 404))
    const missing = await completeRun({} as never, { params: Promise.resolve({ id: 'missing' }) })
    expect(missing.status).toBe(404)

    mocks.failAgentRun.mockRejectedValueOnce(new AgentRepositoryError('运行记录已结束', 409))
    const conflict = await failRun({} as never, { params: Promise.resolve({ id: 'run-1' }) })
    expect(conflict.status).toBe(409)

    mocks.createAgentRun.mockRejectedValueOnce(new Error('D1 unavailable'))
    mocks.parseJsonBody.mockResolvedValue({
      source: 'flomo', mode: 'hourly', windowStart: '2026-07-12', windowEnd: '2026-07-13',
    })
    const failure = await startRun({} as never)
    expect(failure.status).toBe(500)
  })
})

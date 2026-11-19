import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/cloudflare', () => ({
  getAppCloudflareEnv: vi.fn(async () => ({})),
}))

import {
  constantTimeEqual,
  getSessionToken,
  isAdminAuthenticated,
  verifyPassword,
} from '@/lib/admin-auth'

describe('admin-auth constant-time verification and HMAC session token', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_PASSWORD', 'test-admin-password-!@#')
    vi.stubEnv('ADMIN_TOKEN_SALT', 'test-admin-salt-987654')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('compares equal and unequal strings in constant time', async () => {
    await expect(constantTimeEqual('same-secret', 'same-secret')).resolves.toBe(true)
    await expect(constantTimeEqual('same-secret', 'same-secrex')).resolves.toBe(false)
    await expect(constantTimeEqual('short', 'much-longer-secret')).resolves.toBe(false)
    await expect(constantTimeEqual('', '')).resolves.toBe(true)
    await expect(constantTimeEqual('', 'non-empty')).resolves.toBe(false)
  })

  it('uses crypto.subtle.timingSafeEqual when runtime exposes it', async () => {
    const subtle = crypto.subtle as SubtleCrypto & {
      timingSafeEqual?: (a: BufferSource, b: BufferSource) => boolean
    }
    const original = subtle.timingSafeEqual
    const spy = vi.fn(() => true)
    subtle.timingSafeEqual = spy

    try {
      await expect(constantTimeEqual('alpha', 'alpha')).resolves.toBe(true)
      expect(spy).toHaveBeenCalledTimes(1)
      const [argA, argB] = spy.mock.calls[0] as unknown as [Uint8Array, Uint8Array]
      expect(argA).toBeInstanceOf(Uint8Array)
      expect(argB).toBeInstanceOf(Uint8Array)
      expect(argA.byteLength).toBe(32)
      expect(argB.byteLength).toBe(32)
    } finally {
      if (original) {
        subtle.timingSafeEqual = original
      } else {
        delete subtle.timingSafeEqual
      }
    }
  })

  it('derives deterministic 64-hex HMAC session tokens and validates cookies', async () => {
    const token1 = await getSessionToken()
    const token2 = await getSessionToken()

    expect(token1).toMatch(/^[0-9a-f]{64}$/)
    expect(token1).toBe(token2)

    await expect(isAdminAuthenticated(token1)).resolves.toBe(true)
    await expect(isAdminAuthenticated(`${token1.slice(0, -1)}${token1.endsWith('0') ? '1' : '0'}`)).resolves.toBe(false)
    await expect(isAdminAuthenticated(undefined)).resolves.toBe(false)
    await expect(isAdminAuthenticated('')).resolves.toBe(false)
  })

  it('changes session token when salt changes and returns empty string when unconfigured', async () => {
    const tokenA = await getSessionToken()
    vi.stubEnv('ADMIN_TOKEN_SALT', 'different-salt-value')
    const tokenB = await getSessionToken()
    expect(tokenB).not.toBe(tokenA)

    vi.stubEnv('ADMIN_PASSWORD', '')
    await expect(getSessionToken()).resolves.toBe('')
    await expect(isAdminAuthenticated(tokenA)).resolves.toBe(false)
  })

  it('verifies passwords in constant time and fails closed when unconfigured', async () => {
    await expect(verifyPassword('test-admin-password-!@#')).resolves.toBe(true)
    await expect(verifyPassword('wrong-password')).resolves.toBe(false)
    await expect(verifyPassword('')).resolves.toBe(false)

    vi.stubEnv('ADMIN_PASSWORD', '')
    await expect(verifyPassword('test-admin-password-!@#')).resolves.toBe(false)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveAiConfigSecret } from '@/lib/ai-provider-profiles'
describe('provider encryption configuration', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('fails closed without a deployment secret instead of using a known constant', () => {
    vi.stubEnv('AI_CONFIG_ENCRYPTION_SECRET', '')
    vi.stubEnv('ADMIN_TOKEN_SALT', '')
    expect(() => resolveAiConfigSecret({})).toThrow('未配置')
  })
  it('keeps existing deployment salt compatibility and prioritizes a dedicated key', () => {
    vi.stubEnv('AI_CONFIG_ENCRYPTION_SECRET', '')
    vi.stubEnv('ADMIN_TOKEN_SALT', '')
    expect(resolveAiConfigSecret({ ADMIN_TOKEN_SALT: 'test-salt' })).toBe('test-salt')
    expect(
      resolveAiConfigSecret({
        ADMIN_TOKEN_SALT: 'test-salt',
        AI_CONFIG_ENCRYPTION_SECRET: 'test-key',
      }),
    ).toBe('test-key')
  })
})

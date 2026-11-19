import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  decryptApiKey,
  encryptApiKey,
  resolveAiConfigSecret,
} from '@/lib/ai-provider-profiles'

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

  it('rejects encryptApiKey and decryptApiKey when secret is empty or whitespace', async () => {
    const expectedMessage = '缺少加密密钥 AI_CONFIG_ENCRYPTION_SECRET，已拒绝加解密 AI 供应商凭据'

    await expect(encryptApiKey('sk-secret-value', '')).rejects.toThrow(expectedMessage)
    await expect(encryptApiKey('sk-secret-value', '   ')).rejects.toThrow(expectedMessage)

    const encrypted = await encryptApiKey('sk-secret-value', 'valid-test-secret')
    expect(encrypted.startsWith('enc:v1:')).toBe(true)

    await expect(decryptApiKey(encrypted, '')).rejects.toThrow(expectedMessage)
    await expect(decryptApiKey(encrypted, '  \t ')).rejects.toThrow(expectedMessage)
  })

  it('encrypts and decrypts api keys with a valid secret and rejects wrong secrets', async () => {
    const encrypted = await encryptApiKey('sk-live-123456', 'secret-alpha')
    expect(encrypted).not.toContain('sk-live-123456')

    await expect(decryptApiKey(encrypted, 'secret-alpha')).resolves.toBe('sk-live-123456')
    await expect(decryptApiKey(encrypted, 'secret-beta')).resolves.toBe('')
  })
})

import { describe, expect, it } from 'vitest'
import { verifyHermesBearerToken } from '@/lib/agent-knowledge/auth'

describe('Hermes bearer authentication', () => {
  it('only accepts an exact configured bearer token', async () => {
    expect(await verifyHermesBearerToken(null, 'configured-secret')).toBe(false)
    expect(await verifyHermesBearerToken('Bearer wrong-secret', 'configured-secret')).toBe(false)
    expect(await verifyHermesBearerToken('Basic configured-secret', 'configured-secret')).toBe(false)
    expect(await verifyHermesBearerToken('Bearer configured-secret', 'configured-secret')).toBe(true)
  })

  it('fails closed when the worker secret is missing', async () => {
    expect(await verifyHermesBearerToken('Bearer anything', '')).toBe(false)
  })
})

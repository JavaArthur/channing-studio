import type { NextRequest } from 'next/server'
import { jsonError } from '@/lib/server/route-helpers'

async function digest(value: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(value)
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
}

export async function verifyHermesBearerToken(
  authorization: string | null,
  expectedToken: string | undefined,
): Promise<boolean> {
  if (!expectedToken || !authorization?.startsWith('Bearer ')) return false
  const suppliedToken = authorization.slice('Bearer '.length)
  if (!suppliedToken) return false

  const [suppliedDigest, expectedDigest] = await Promise.all([
    digest(suppliedToken),
    digest(expectedToken),
  ])
  let difference = suppliedDigest.length ^ expectedDigest.length
  const length = Math.max(suppliedDigest.length, expectedDigest.length)
  for (let index = 0; index < length; index += 1) {
    difference |= (suppliedDigest[index] ?? 0) ^ (expectedDigest[index] ?? 0)
  }
  return difference === 0
}

export async function ensureHermesAgentRequest(
  req: NextRequest,
  env: Partial<CloudflareEnv>,
) {
  const authorized = await verifyHermesBearerToken(
    req.headers.get('authorization'),
    env.HERMES_SYNC_TOKEN,
  )
  return authorized ? null : jsonError('Unauthorized', 401)
}

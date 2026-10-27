import { NextRequest } from 'next/server'
import { COOKIE_NAME, isAdminAuthenticated } from '@/lib/admin-auth'
import { getRouteEnvWithDb, jsonError, jsonOk } from '@/lib/server/route-helpers'
import { resolveAiConfigSecret, resolveAiProfileConfig } from '@/lib/ai-provider-profiles'
import { resolveAiImageProfileConfig } from '@/lib/ai-image-config'
import { getPostGeneratorAvailability } from '@/lib/ai-post-generators'
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated(req.cookies.get(COOKIE_NAME)?.value)))
    return jsonError('Unauthorized', 401)
  const route = await getRouteEnvWithDb()
  if (!route.ok) return route.response
  const kind = req.nextUrl.searchParams.get('kind')
  if (kind === 'generators') return jsonOk(await getPostGeneratorAvailability(route.db, route.env))
  if (!['text', 'image'].includes(kind || '')) return jsonError('Invalid kind', 400)
  const ids = [
    0,
    ...new Set(
      (req.nextUrl.searchParams.get('ids') || '')
        .split(',')
        .map(Number)
        .filter((n) => Number.isSafeInteger(n) && n > 0),
    ),
  ].slice(0, 100)
  const secret = resolveAiConfigSecret(route.env as unknown as Record<string, unknown>)
  const resolve = kind === 'image' ? resolveAiImageProfileConfig : resolveAiProfileConfig
  const values: Record<string, boolean> = {}
  for (const id of ids)
    try {
      values[id] = !!(await resolve(route.db, secret, id || undefined))
    } catch {
      values[id] = false
    }
  return jsonOk(values)
}

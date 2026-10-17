import { NextRequest } from 'next/server'
import { COOKIE_NAME, isAdminAuthenticated } from '@/lib/admin-auth'
import { getRouteEnvWithDb, jsonError, jsonOk } from '@/lib/server/route-helpers'
import { publishResource } from '@/lib/repositories/publications'
import { invalidatePublicContentCache } from '@/lib/cache'
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  if (!(await isAdminAuthenticated(req.cookies.get(COOKIE_NAME)?.value)))
    return jsonError('Unauthorized', 401)
  const { kind, id } = await params
  if (!['tools', 'prompts'].includes(kind) || !Number.isInteger(Number(id)) || Number(id) < 1)
    return jsonError('无效资源', 400)
  try {
    const { publish } = await req.json()
    if (typeof publish !== 'boolean') return jsonError('无效发布动作', 400)
    const route = await getRouteEnvWithDb()
    if (!route.ok) return route.response
    if (!(await publishResource(route.db, kind as 'tools' | 'prompts', Number(id), publish)))
      return jsonError('资源不存在', 404)
    await invalidatePublicContentCache(route.env)
    return jsonOk({ success: true })
  } catch {
    return jsonError('发布操作失败', 500)
  }
}

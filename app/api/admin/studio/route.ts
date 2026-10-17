import { NextRequest } from 'next/server'
import { COOKIE_NAME, isAdminAuthenticated } from '@/lib/admin-auth'
import { getRouteEnvWithDb, jsonError, jsonOk } from '@/lib/server/route-helpers'
import { validateStudioContent } from '@/lib/studio-validation'
import { setStudioContent } from '@/lib/studio-settings'
import { findPublicPostOptions } from '@/lib/repositories/admin-posts'
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated(req.cookies.get(COOKIE_NAME)?.value)))
    return jsonError('Unauthorized', 401)
  const route = await getRouteEnvWithDb()
  if (!route.ok) return route.response
  return jsonOk({
    posts: await findPublicPostOptions(route.db, req.nextUrl.searchParams.get('q') || ''),
  })
}
export async function PUT(req: NextRequest) {
  if (!(await isAdminAuthenticated(req.cookies.get(COOKIE_NAME)?.value)))
    return jsonError('Unauthorized', 401)
  try {
    const { content, revision } = await req.json()
    if (!Number.isInteger(revision) || revision < 0) return jsonError('无效版本', 400)
    const parsed = validateStudioContent(content)
    const route = await getRouteEnvWithDb()
    if (!route.ok) return route.response
    return jsonOk({ success: true, revision: await setStudioContent(route.db, parsed, revision) })
  } catch (e) {
    const message = e instanceof Error ? e.message : '保存失败'
    return jsonError(message, message.includes('配置已更新') ? 409 : 400)
  }
}

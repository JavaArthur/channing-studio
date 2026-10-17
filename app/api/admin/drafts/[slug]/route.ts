import { NextRequest } from 'next/server'
import { COOKIE_NAME, isAdminAuthenticated } from '@/lib/admin-auth'
import { getRouteEnvWithDb, jsonError, jsonOk } from '@/lib/server/route-helpers'
import { DraftConflict, saveWorkingCopy } from '@/lib/repositories/drafts'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await isAdminAuthenticated(req.cookies.get(COOKIE_NAME)?.value)))
    return jsonError('Unauthorized', 401)
  try {
    const body = await req.json()
    if (
      !Number.isInteger(body.baseRevision) ||
      body.baseRevision < 0 ||
      !Number.isInteger(body.revision) ||
      body.revision < 0
    )
      return jsonError('无效版本', 400)
    const payload: Record<string, unknown> = {}
    for (const key of [
      'title',
      'html',
      'content',
      'description',
      'category',
      'cover_image',
      'new_slug',
    ]) {
      if (body[key] !== undefined) {
        if (
          typeof body[key] !== 'string' ||
          body[key].length > (['html', 'content'].includes(key) ? 500000 : 4000)
        )
          return jsonError('内容格式或长度不正确', 400)
        payload[key] = body[key]
      }
    }
    if (Array.isArray(body.tags))
      payload.tags = body.tags.filter((v: unknown) => typeof v === 'string').slice(0, 20)
    const route = await getRouteEnvWithDb()
    if (!route.ok) return route.response
    const { slug } = await params
    const saved = await saveWorkingCopy(route.db, slug, payload, body.baseRevision, body.revision)
    return jsonOk({ success: true, slug, ...saved })
  } catch (error) {
    return jsonError(
      error instanceof DraftConflict ? error.message : '工作稿保存失败',
      error instanceof DraftConflict ? 409 : 500,
    )
  }
}

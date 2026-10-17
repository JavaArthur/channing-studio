import {
  getProjectLinks,
  isProjectLinkKind,
  setProjectLink,
} from '@/lib/repositories/project-links'
import { NextRequest } from 'next/server'
import { COOKIE_NAME, isAdminAuthenticated } from '@/lib/admin-auth'
import { getRouteEnvWithDb, jsonError, jsonOk } from '@/lib/server/route-helpers'
import {
  archiveBrainItem,
  convertInboxItem,
  draftFromNote,
  isBrainKind,
  publishProject,
  saveBrainItem,
} from '@/lib/repositories/brain'
export async function POST(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  if (!(await isAdminAuthenticated(req.cookies.get(COOKIE_NAME)?.value)))
    return jsonError('Unauthorized', 401)
  const { kind } = await params
  if (!isBrainKind(kind)) return jsonError('未知类型', 404)
  const route = await getRouteEnvWithDb()
  if (!route.ok) return route.response
  let input: Record<string, unknown>
  try {
    input = await req.json()
  } catch {
    return jsonError('格式错误', 400)
  }
  if (!input || typeof input !== 'object') return jsonError('格式错误', 400)
  const id = typeof input.id === 'string' ? input.id : undefined
  try {
    if (input.action === 'archive' || input.action === 'restore') {
      if (!id) return jsonError('缺少 ID', 400)
      await archiveBrainItem(route.db, kind, id, input.action === 'restore')
    } else if (input.action === 'convert') {
      if (kind !== 'inbox' || !id || !['note', 'post'].includes(String(input.target)))
        return jsonError('无效转换', 400)
      return jsonOk({
        success: true,
        target: await convertInboxItem(route.db, id, input.target as 'note' | 'post'),
      })
    } else if (input.action === 'draft') {
      if (kind !== 'notes' || !id) return jsonError('无效笔记', 400)
      return jsonOk({ success: true, target: await draftFromNote(route.db, id) })
    } else if (input.action === 'link') {
      if (
        kind !== 'projects' ||
        !id ||
        typeof input.kind !== 'string' ||
        !isProjectLinkKind(input.kind) ||
        typeof input.target_id !== 'string'
      )
        return jsonError('无效关联', 400)
      await setProjectLink(route.db, id, input.kind, input.target_id, input.remove === true)
    } else if (input.action === 'publish') {
      if (kind !== 'projects' || !id) return jsonError('无效项目', 400)
      await publishProject(route.db, id, input)
    } else if (input.action === 'save' || input.action === undefined) {
      return jsonOk({ success: true, id: await saveBrainItem(route.db, kind, input, id) })
    } else return jsonError('无效操作', 400)
    return jsonOk({ success: true })
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '操作失败', 400)
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  if (!(await isAdminAuthenticated(req.cookies.get(COOKIE_NAME)?.value)))
    return jsonError('Unauthorized', 401)
  const { kind } = await params
  if (kind !== 'projects') return jsonError('未知类型', 404)
  const project = req.nextUrl.searchParams.get('project')
  if (!project) return jsonError('缺少项目', 400)
  const route = await getRouteEnvWithDb()
  if (!route.ok) return route.response
  const query = req.nextUrl.searchParams.get('q')
  return jsonOk({ items: await getProjectLinks(route.db, project, query ?? undefined) })
}

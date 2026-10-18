import { NextRequest } from 'next/server'
import { COOKIE_NAME, isAdminAuthenticated } from '@/lib/admin-auth'
import { BrainApiError, readBody } from '@/lib/agent-brain/validation'
import { getRouteEnvWithDb, jsonError, jsonOk } from '@/lib/server/route-helpers'
import { createXDraft, listXDrafts } from '@/lib/repositories/x-drafts'
import { parseXDraft, xDraftCreateSchema, xDraftListQuery } from '@/lib/x-drafts/validation'

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated(req.cookies.get(COOKIE_NAME)?.value))) return jsonError('Unauthorized', 401)
  const route = await getRouteEnvWithDb()
  if (!route.ok) return route.response
  try {
    return jsonOk(await listXDrafts(route.db, xDraftListQuery(req.nextUrl.searchParams)))
  } catch (error) {
    return jsonError(error instanceof BrainApiError ? error.message : '读取失败', error instanceof BrainApiError ? error.status : 500)
  }
}
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated(req.cookies.get(COOKIE_NAME)?.value))) return jsonError('Unauthorized', 401)
  const route = await getRouteEnvWithDb()
  if (!route.ok) return route.response
  try {
    const fields = parseXDraft(xDraftCreateSchema, await readBody(req))
    return jsonOk(await createXDraft(route.db, crypto.randomUUID(), fields))
  } catch (error) {
    return jsonError(error instanceof BrainApiError ? error.message : '创建失败', error instanceof BrainApiError ? error.status : 500)
  }
}

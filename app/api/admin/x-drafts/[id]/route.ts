import { NextRequest } from 'next/server'
import { COOKIE_NAME, isAdminAuthenticated } from '@/lib/admin-auth'
import { BrainApiError, readBody } from '@/lib/agent-brain/validation'
import { getRouteEnvWithDb, jsonError, jsonOk } from '@/lib/server/route-helpers'
import { updateXDraft } from '@/lib/repositories/x-drafts'
import { parseXDraft, xDraftUpdateSchema } from '@/lib/x-drafts/validation'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated(req.cookies.get(COOKIE_NAME)?.value))) return jsonError('Unauthorized', 401)
  const route = await getRouteEnvWithDb()
  if (!route.ok) return route.response
  try {
    const { id } = await params
    const { expected_revision, changes } = parseXDraft(xDraftUpdateSchema, await readBody(req))
    return jsonOk({ draft: await updateXDraft(route.db, id, expected_revision, changes) })
  } catch (error) {
    return jsonError(error instanceof BrainApiError ? error.message : '更新失败', error instanceof BrainApiError ? error.status : 500)
  }
}

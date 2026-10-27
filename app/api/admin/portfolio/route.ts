import { NextRequest } from 'next/server'
import { z } from 'zod'
import { COOKIE_NAME, isAdminAuthenticated } from '@/lib/admin-auth'
import { BrainApiError, readBody } from '@/lib/agent-brain/validation'
import { invalidatePublicContentCache } from '@/lib/cache'
import { parseLibrary } from '@/lib/library/validation'
import { portfolioInputSchema } from '@/lib/portfolio'
import {
  createPortfolioProject,
  deletePortfolioProject,
  listPortfolioProjects,
  setPortfolioPublished,
  updatePortfolioProject,
} from '@/lib/repositories/portfolio'
import { getRouteEnvWithDb, jsonError, jsonOk } from '@/lib/server/route-helpers'

const id = z.number().int().positive()
const actions = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), project: portfolioInputSchema }).strict(),
  z.object({ action: z.literal('update'), id, project: portfolioInputSchema }).strict(),
  z.object({ action: z.literal('delete'), id }).strict(),
  z.object({ action: z.literal('publish'), id, publish: z.boolean() }).strict(),
])

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated(req.cookies.get(COOKIE_NAME)?.value)))
    return jsonError('Unauthorized', 401)
  const route = await getRouteEnvWithDb()
  if (!route.ok) return route.response
  return jsonOk({ projects: await listPortfolioProjects(route.db) })
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated(req.cookies.get(COOKIE_NAME)?.value)))
    return jsonError('Unauthorized', 401)
  const route = await getRouteEnvWithDb()
  if (!route.ok) return route.response
  try {
    const input = parseLibrary(actions, await readBody(req))
    switch (input.action) {
      case 'create':
        return jsonOk({ id: await createPortfolioProject(route.db, input.project) })
      case 'update':
        await updatePortfolioProject(route.db, input.id, input.project)
        return jsonOk({ id: input.id })
      case 'delete':
        await deletePortfolioProject(route.db, input.id)
        await invalidatePublicContentCache(route.env)
        return jsonOk({ id: input.id })
      case 'publish':
        await setPortfolioPublished(route.db, input.id, input.publish)
        await invalidatePublicContentCache(route.env)
        return jsonOk({ id: input.id })
    }
  } catch (error) {
    if (error instanceof BrainApiError) return jsonError(error.message, error.status)
    console.error('Portfolio admin action failed', error)
    return jsonError('操作失败，请稍后重试', 500)
  }
}

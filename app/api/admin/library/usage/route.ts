import { NextRequest } from 'next/server'
import { z } from 'zod'
import { COOKIE_NAME, isAdminAuthenticated } from '@/lib/admin-auth'
import { getRouteEnvWithDb, jsonError, jsonOk } from '@/lib/server/route-helpers'
import { BrainApiError, readBody } from '@/lib/agent-brain/validation'
import { itemReferenceSchema, librarySearchSchema, parseLibrary } from '@/lib/library/validation'
import {
  clearLibraryHistory,
  getLibraryUsage,
  pinCollectionItem,
  recordLibraryRead,
  recordLibrarySearch,
  setCollectionPreference,
} from '@/lib/repositories/library-usage'
const schema = z.discriminatedUnion('action', [
  itemReferenceSchema.extend({ action: z.literal('read') }),
  z.object({ action: z.literal('search'), query: librarySearchSchema }).strict(),
  z.object({ action: z.literal('clear'), history: z.enum(['reads', 'searches']) }).strict(),
  z
    .object({
      action: z.literal('collection'),
      id: z.string().min(1).max(180),
      pinned: z.boolean(),
      move: z.enum(['up', 'down']).optional(),
    })
    .strict(),
  itemReferenceSchema.extend({
    action: z.literal('pin'),
    collection: z.string().min(1).max(180),
    pinned: z.boolean(),
  }),
])
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated(req.cookies.get(COOKIE_NAME)?.value)))
    return jsonError('Unauthorized', 401)
  const route = await getRouteEnvWithDb()
  if (!route.ok) return route.response
  return jsonOk(await getLibraryUsage(route.db))
}
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated(req.cookies.get(COOKIE_NAME)?.value)))
    return jsonError('Unauthorized', 401)
  const route = await getRouteEnvWithDb()
  if (!route.ok) return route.response
  try {
    const input = parseLibrary(schema, await readBody(req))
    switch (input.action) {
      case 'read':
        await recordLibraryRead(route.db, input.kind, input.id)
        break
      case 'search':
        await recordLibrarySearch(route.db, input.query)
        break
      case 'clear':
        await clearLibraryHistory(route.db, input.history)
        break
      case 'collection':
        await setCollectionPreference(route.db, input.id, input.pinned, input.move)
        break
      case 'pin':
        await pinCollectionItem(route.db, input.collection, input.kind, input.id, input.pinned)
        break
    }
    return jsonOk({ success: true })
  } catch (e) {
    return jsonError(
      e instanceof BrainApiError ? e.message : '使用记录同步失败',
      e instanceof BrainApiError ? e.status : 500,
    )
  }
}

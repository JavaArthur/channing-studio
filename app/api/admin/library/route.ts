import { NextRequest } from 'next/server'
import { z } from 'zod'
import { COOKIE_NAME, isAdminAuthenticated } from '@/lib/admin-auth'
import { getRouteEnvWithDb, jsonError, jsonOk } from '@/lib/server/route-helpers'
import { BrainApiError, readBody } from '@/lib/agent-brain/validation'
import {
  librarySearchSchema,
  captureSchema,
  itemReferenceSchema,
  libraryChangesSchema,
  parseLibrary,
} from '@/lib/library/validation'
import {
  searchLibrary,
  getLibraryPublication,
  updateLibraryCollection,
  captureLibraryItem,
  draftFromLibrary,
  getLibraryItem,
  linkLibraryCollection,
  listCollections,
  publishLibraryResource,
  updateLibraryItem,
} from '@/lib/repositories/library'
import { buildHandoff } from '@/lib/library/types'
import { saveBrainItem } from '@/lib/repositories/brain'
import { invalidatePublicContentCache } from '@/lib/cache'
const revision = z.number().int().positive()
const actions = z.discriminatedUnion('action', [
  itemReferenceSchema.extend({ action: z.literal('get') }),
  z.object({ action: z.literal('search'), query: librarySearchSchema }).strict(),
  z
    .object({
      action: z.literal('publication_get'),
      kind: z.enum(['tool', 'prompt']),
      id: z.string().min(1).max(200),
    })
    .strict(),
  z
    .object({
      action: z.literal('collection_update'),
      id: z.string().min(1).max(180),
      expected_revision: revision,
      title: z.string().trim().min(1).max(200),
      description: z.string().max(50000),
      archived: z.boolean(),
    })
    .strict(),
  z.object({ action: z.literal('capture'), input: captureSchema }).strict(),
  itemReferenceSchema.extend({
    action: z.literal('update'),
    expected_revision: revision,
    changes: libraryChangesSchema,
  }),
  z
    .object({
      action: z.literal('handoff'),
      items: z.array(itemReferenceSchema).min(1).max(20),
      instruction: z.string().max(10000),
    })
    .strict(),
  itemReferenceSchema.extend({
    action: z.literal('link'),
    collection_id: z.string().min(1).max(180),
    collection_revision: revision,
    remove: z.boolean().optional(),
  }),
  z
    .object({
      action: z.literal('collection'),
      title: z.string().trim().min(1).max(200),
      description: z.string().max(50000).default(''),
    })
    .strict(),
  itemReferenceSchema.extend({ action: z.literal('draft'), expected_revision: revision }),
  z
    .object({
      action: z.literal('publish'),
      kind: z.enum(['tool', 'prompt']),
      id: z.string().min(1).max(200),
      expected_revision: revision,
      publish: z.boolean(),
      fields: z
        .object({
          title: z.string().trim().min(1).max(200),
          description: z.string().max(2000),
          content: z.string().max(50000).optional(),
          url: z
            .string()
            .url()
            .refine((v) => {
              try {
                const u = new URL(v)
                return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password
              } catch {
                return false
              }
            }, '链接必须使用 HTTP(S)，且不能包含凭据')
            .nullable()
            .optional(),
        })
        .strict(),
    })
    .strict(),
])
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated(req.cookies.get(COOKIE_NAME)?.value)))
    return jsonError('Unauthorized', 401)
  const route = await getRouteEnvWithDb()
  if (!route.ok) return route.response
  try {
    const input = parseLibrary(actions, await readBody(req))
    switch (input.action) {
      case 'search':
        return jsonOk(await searchLibrary(route.db, input.query))
      case 'publication_get':
        return jsonOk(await getLibraryPublication(route.db, input.kind, input.id))
      case 'get':
        return jsonOk({ item: await getLibraryItem(route.db, input.kind, input.id) })
      case 'collection_update':
        return jsonOk({
          collection: await updateLibraryCollection(
            route.db,
            input.id,
            input.expected_revision,
            input,
          ),
        })
      case 'capture':
        return jsonOk(await captureLibraryItem(route.db, input.input, 'manual'))
      case 'update':
        return jsonOk({
          item: await updateLibraryItem(
            route.db,
            input.kind,
            input.id,
            input.expected_revision,
            input.changes,
          ),
        })
      case 'handoff': {
        const items = await Promise.all(
          input.items.map((ref) => getLibraryItem(route.db, ref.kind, ref.id)),
        )
        return jsonOk({ text: buildHandoff(items, input.instruction, req.nextUrl.origin) })
      }
      case 'link':
        return jsonOk({
          item: await linkLibraryCollection(
            route.db,
            input.collection_id,
            input.kind,
            input.id,
            input.collection_revision,
            input.remove,
          ),
          collections: await listCollections(route.db),
        })
      case 'collection':
        return jsonOk({
          id: await saveBrainItem(route.db, 'projects', {
            title: input.title,
            description: input.description,
          }),
        })
      case 'draft':
        return jsonOk(
          await draftFromLibrary(route.db, input.kind, input.id, input.expected_revision),
        )
      case 'publish': {
        const item = await publishLibraryResource(
          route.db,
          input.kind,
          input.id,
          input.expected_revision,
          input.fields,
          input.publish,
        )
        await invalidatePublicContentCache(route.env)
        return jsonOk({ item })
      }
    }
  } catch (error) {
    return jsonError(
      error instanceof BrainApiError ? error.message : '操作失败，请稍后重试',
      error instanceof BrainApiError ? error.status : 500,
    )
  }
}

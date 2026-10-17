import { NextResponse, type NextRequest } from 'next/server'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { verifyHermesBearerToken } from '@/lib/agent-knowledge/auth'
import type { Database } from '@/lib/repositories/schema'
import {
  createAgentBrainItem, getAgentBrainItem, listAgentBrainItems, patchAgentBrainItem,
  convertAgentInbox, listAgentProjectNotes, linkAgentProjectNote,
} from '@/lib/repositories/agent-brain'
import {
  BrainApiError, brainKind, itemId, expectedRevision, creationKey, listQuery,
  parseFields, objectBody, readBody,
} from './validation'

type Context = { params: Promise<{ kind: string; id?: string; noteId?: string }> }
const headers = { 'Cache-Control': 'private, no-store, max-age=0', Vary: 'Authorization', 'X-Robots-Tag': 'noindex, nofollow' }
function json(value: unknown, status = 200, revision?: number) {
  return NextResponse.json(value, { status, headers: { ...headers, ...(revision ? { ETag: `"${revision}"` } : {}) } })
}
function endpoint(fn: (req: NextRequest, context: Context, db: Database) => Promise<NextResponse>) {
  return async (req: NextRequest, context: Context) => {
    try {
      const env = await getAppCloudflareEnv()
      // A dedicated Agent route; never fall back to qm_ tokens or browser cookies.
      if (!(await verifyHermesBearerToken(req.headers.get('authorization'), env.HERMES_SYNC_TOKEN)))
        return json({ error: 'Unauthorized' }, 401)
      if (!env.DB) return json({ error: 'Database unavailable' }, 503)
      return await fn(req, context, env.DB)
    } catch (error) {
      if (error instanceof BrainApiError) return json({ error: error.message }, error.status)
      // Do not log request bodies or raw DB errors containing personal content.
      return json({ error: 'Agent workspace operation failed' }, 500)
    }
  }
}
export const collectionGET = endpoint(async (req, context, db) => {
  const kind = brainKind((await context.params).kind)
  return json(await listAgentBrainItems(db, kind, listQuery(req.nextUrl.searchParams)))
})
export const collectionPOST = endpoint(async (req, context, db) => {
  const kind = brainKind((await context.params).kind)
  const key = creationKey(req.headers.get('idempotency-key'))
  const fields = parseFields(kind, await readBody(req), true)
  const result = await createAgentBrainItem(db, kind, key, fields)
  return json(result, result.replayed ? 200 : 201, result.item.revision)
})
export const itemGET = endpoint(async (_req, context, db) => {
  const params = await context.params
  const item = await getAgentBrainItem(db, brainKind(params.kind), itemId(params.id))
  return json({ item }, 200, item.revision)
})
export const itemPATCH = endpoint(async (req, context, db) => {
  const params = await context.params; const kind = brainKind(params.kind)
  const revision = expectedRevision(req.headers.get('if-match'))
  const item = await patchAgentBrainItem(db, kind, itemId(params.id), revision, parseFields(kind, await readBody(req)))
  return json({ item }, 200, item.revision)
})
export const convertPOST = endpoint(async (req, context, db) => {
  const params = await context.params
  if (params.kind !== 'inbox') throw new BrainApiError(404, 'Only inbox items can be converted')
  const revision = expectedRevision(req.headers.get('if-match'))
  const input = objectBody(await readBody(req))
  if (Object.keys(input).some(key => key !== 'target') || input.target !== 'note')
    throw new BrainApiError(400, 'Only target=note is supported')
  const result = await convertAgentInbox(db, itemId(params.id), revision)
  return json(result, 200, result.item.revision)
})
export const notesGET = endpoint(async (req, context, db) => {
  const params = await context.params
  if (params.kind !== 'projects') throw new BrainApiError(404, 'Only projects have note associations')
  return json(await listAgentProjectNotes(db, itemId(params.id), listQuery(req.nextUrl.searchParams)))
})
function noteMutation(remove: boolean) {
  return endpoint(async (req, context, db) => {
    const params = await context.params
    if (params.kind !== 'projects') throw new BrainApiError(404, 'Only projects have note associations')
    const item = await linkAgentProjectNote(db, itemId(params.id), itemId(params.noteId), expectedRevision(req.headers.get('if-match')), remove)
    return json({ item }, 200, item.revision)
  })
}
export const notePUT = noteMutation(false)
export const noteDELETE = noteMutation(true)

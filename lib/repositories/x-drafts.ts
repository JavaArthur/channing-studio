import { BrainApiError, creationKey, itemId } from '@/lib/agent-brain/validation'
import { countXChars, X_CHAR_LIMIT } from '@/lib/x-drafts/text'
import { parseXDraft, xDraftChangesSchema, xDraftCreateSchema, xDraftListSchema, xDraftUpdateSchema } from '@/lib/x-drafts/validation'
import type { z } from 'zod'
import type { Database } from './schema'

interface XDraftRow {
  id: string; content: string; source_url: string | null; source_type: string
  status: 'pending' | 'posted' | 'discarded'; posted_url: string | null
  revision: number; created_at: number; updated_at: number
}
export type XDraft = XDraftRow & { char_count: number; over_limit: boolean }
const columns = 'id,content,source_url,source_type,status,posted_url,revision,created_at,updated_at'
function decorate(row: XDraftRow): XDraft {
  const char_count = countXChars(row.content)
  return { ...row, char_count, over_limit: char_count > X_CHAR_LIMIT }
}
async function hash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
    .map(byte => byte.toString(16).padStart(2, '0')).join('')
}
export async function getXDraft(db: Database, id: string) {
  const row = await db.prepare(`SELECT ${columns} FROM x_drafts WHERE id=?`).bind(itemId(id)).first<XDraftRow>()
  if (!row) throw new BrainApiError(404, 'Draft not found')
  return decorate(row)
}
export async function createXDraft(db: Database, requestKey: string, fields: z.input<typeof xDraftCreateSchema>) {
  const parsed = parseXDraft(xDraftCreateSchema, fields)
  const values = [parsed.content, parsed.source_url ?? null, parsed.source_type ?? 'other']
  const keyHash = await hash(creationKey(requestKey))
  const requestHash = await hash(JSON.stringify(values))
  const id = `xd-${keyHash}`
  const result = await db.batch([
    db.prepare(`INSERT INTO x_drafts(id,content,source_url,source_type) SELECT ?,?,?,?
      WHERE NOT EXISTS (SELECT 1 FROM x_draft_creates WHERE key_hash=?)`).bind(id, ...values, keyHash),
    db.prepare('INSERT OR IGNORE INTO x_draft_creates(key_hash,request_hash,draft_id) VALUES (?,?,?)')
      .bind(keyHash, requestHash, id),
  ])
  const receipt = await db.prepare('SELECT request_hash FROM x_draft_creates WHERE key_hash=?')
    .bind(keyHash).first<{ request_hash: string }>()
  if (receipt?.request_hash !== requestHash) throw new BrainApiError(409, 'request_key was already used with a different body')
  return { draft: await getXDraft(db, id), replayed: result[0].meta?.changes === 0 }
}
export async function listXDrafts(db: Database, input: z.input<typeof xDraftListSchema>) {
  const { status = 'pending', source_type, q = '', since, until, page = 1, limit = 30 } = parseXDraft(xDraftListSchema, input)
  const filters: string[] = []; const values: Array<string | number> = []
  if (status !== 'all') { filters.push('status=?'); values.push(status) }
  if (source_type !== undefined) { filters.push('source_type=?'); values.push(source_type) }
  if (since !== undefined) { filters.push('created_at>=?'); values.push(since) }
  if (until !== undefined) { filters.push('created_at<=?'); values.push(until) }
  // D1 caps LIKE patterns at 50 bytes, so literal search uses instr() (case-insensitive for ASCII).
  if (q) { filters.push('instr(lower(content),lower(?))>0'); values.push(q) }
  const where = filters.join(' AND ') || '1=1'
  const results = await db.batch([
    db.prepare(`SELECT ${columns} FROM x_drafts WHERE ${where} ORDER BY created_at DESC,id LIMIT ? OFFSET ?`)
      .bind(...values, limit, (page - 1) * limit),
    db.prepare(`SELECT COUNT(*) AS total FROM x_drafts WHERE ${where}`).bind(...values),
  ]) as Array<{ results?: Array<Record<string, unknown>> }>
  const total = Number(results[1].results?.[0]?.total ?? 0)
  return { items: ((results[0].results ?? []) as unknown as XDraftRow[]).map(decorate), total, page, limit, has_more: page * limit < total }
}
export async function updateXDraft(db: Database, id: string, expected_revision: number, changes: z.input<typeof xDraftChangesSchema>) {
  const input = parseXDraft(xDraftUpdateSchema, { expected_revision, changes })
  if ((await getXDraft(db, id)).revision !== expected_revision)
    throw new BrainApiError(412, 'Revision changed; refresh before retrying')
  const entries = Object.entries(input.changes).filter(([, value]) => value !== undefined)
  const result = await db.prepare(`UPDATE x_drafts SET ${entries.map(([key]) => `${key}=?`).join(',')},updated_at=strftime('%s','now') WHERE id=? AND revision=?`)
    .bind(...entries.map(([, value]) => value), id, expected_revision).run()
  if (!result.meta.changes) throw new BrainApiError(412, 'Revision changed; refresh before retrying')
  return getXDraft(db, id)
}

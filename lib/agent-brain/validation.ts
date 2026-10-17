import { isBrainKind, type BrainKind } from '@/lib/repositories/brain'
import { isHttpUrl } from '@/lib/url'

export class BrainApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export function brainKind(value: string): BrainKind {
  if (!isBrainKind(value)) throw new BrainApiError(404, 'Unknown resource')
  return value
}
export function itemId(value: string | undefined): string {
  if (!value || value.length > 180 || !/^[A-Za-z0-9_-]+$/.test(value))
    throw new BrainApiError(400, 'Invalid item ID')
  return value
}
export function expectedRevision(value: string | null): number {
  if (value === null) throw new BrainApiError(428, 'If-Match is required; GET the item first')
  const match = /^"([1-9][0-9]*)"$/.exec(value)
  if (!match || !Number.isSafeInteger(Number(match[1])))
    throw new BrainApiError(400, 'If-Match must be a quoted positive revision, e.g. "1"')
  return Number(match[1])
}
export function creationKey(value: string | null): string {
  if (!value || !/^[A-Za-z0-9_.:-]{16,128}$/.test(value))
    throw new BrainApiError(400, 'Idempotency-Key must contain 16–128 ASCII letters, digits, _, ., :, or -')
  return value
}
export function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BrainApiError(400, 'JSON body must be an object')
  return value as Record<string, unknown>
}
export function parseFields(kind: BrainKind, raw: unknown, create = false) {
  const input = objectBody(raw)
  const allowed = kind === 'projects'
    ? ['title', 'description', 'next_action', 'status']
    : ['title', 'content', 'source_url', ...(create ? [] : ['archived'])]
  if (Object.keys(input).some(key => !allowed.includes(key)))
    throw new BrainApiError(400, 'Unknown or read-only field')
  if (!Object.keys(input).length || (create && input.title === undefined))
    throw new BrainApiError(400, 'A nonempty body and a title for creation are required')
  const output: Record<string, string | number | null> = {}
  // Fixed ordering also canonicalizes the creation receipt's request hash.
  for (const key of allowed) {
    const value = input[key]
    if (value === undefined) continue
    if (key === 'archived') {
      if (typeof value !== 'boolean') throw new BrainApiError(400, 'archived must be boolean')
      output.archived = value ? 1 : 0
    } else if (key === 'status') {
      if (!['active', 'paused', 'done', 'archived'].includes(String(value)) || typeof value !== 'string')
        throw new BrainApiError(400, 'Invalid project status')
      output.status = value
    } else if (key === 'source_url') {
      if (value === null || value === '') output.source_url = null
      else if (typeof value === 'string' && value.length <= 2000 && isHttpUrl(value.trim())) {
        const url = new URL(value.trim())
        if (url.username || url.password) throw new BrainApiError(400, 'URL credentials are not allowed')
        output.source_url = value.trim()
      } else throw new BrainApiError(400, 'source_url must be an HTTP(S) URL or null')
    } else {
      const max = key === 'title' ? 200 : key === 'next_action' ? 2000 : 50000
      if (typeof value !== 'string' || value.length > max || (key === 'title' && !value.trim()))
        throw new BrainApiError(400, `Invalid ${key}; maximum length is ${max}`)
      output[key] = key === 'title' ? value.trim() : value
    }
  }
  if (create) {
    if (kind === 'projects') {
      output.description ??= ''; output.next_action ??= ''; output.status ??= 'active'
    } else { output.content ??= ''; output.source_url ??= null }
  }
  return output
}
export function listQuery(params: URLSearchParams) {
  if ([...params.keys()].some(key => !['q', 'page', 'limit', 'archived'].includes(key)))
    throw new BrainApiError(400, 'Unknown query parameter')
  for (const key of params.keys()) if (params.getAll(key).length !== 1)
    throw new BrainApiError(400, 'Duplicate query parameter')
  const integer = (key: string, fallback: number, max: number) => {
    const value = params.get(key)
    if (value === null) return fallback
    if (!/^[1-9][0-9]*$/.test(value) || Number(value) > max)
      throw new BrainApiError(400, `Invalid ${key}`)
    return Number(value)
  }
  const q = (params.get('q') || '').trim()
  const archived = params.get('archived') || 'exclude'
  if (q.length > 200 || !['exclude', 'only', 'all'].includes(archived))
    throw new BrainApiError(400, 'Invalid search or archive filter')
  return { q, archived, page: integer('page', 1, 10000), limit: integer('limit', 30, 50) }
}

export async function readBody(req: Request): Promise<unknown> {
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
    throw new BrainApiError(415, 'Content-Type must be application/json')
  const max = 256 * 1024
  const reader = req.body?.getReader()
  if (!reader) throw new BrainApiError(400, 'JSON body is required')
  const chunks: Uint8Array[] = []; let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > max) { await reader.cancel(); throw new BrainApiError(413, 'Body exceeds 256 KiB') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(length); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) }
  catch { throw new BrainApiError(400, 'Invalid JSON body') }
}

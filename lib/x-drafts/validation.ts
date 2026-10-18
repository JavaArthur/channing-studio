import { z } from 'zod'
import { BrainApiError } from '@/lib/agent-brain/validation'
import { isHttpUrl, isValidContent, SOURCE_TYPE_PATTERN } from './text'

const content = z.string().refine(isValidContent, '正文不能为空，且最多 10000 字符')
const url = z.string().trim().max(2000).refine(value => value === '' || isHttpUrl(value), '链接必须是 HTTP(S) URL')
  .transform(value => value || null).nullable()
const sourceType = z.string().regex(SOURCE_TYPE_PATTERN)
export const xDraftStatus = z.enum(['pending', 'posted', 'discarded'])
export const xDraftCreateSchema = z.object({ content, source_url: url.optional(), source_type: sourceType.optional() }).strict()
export const xDraftChangesSchema = z.object({
  content: content.optional(), source_url: url.optional(), source_type: sourceType.optional(),
  status: xDraftStatus.optional(), posted_url: url.optional(),
}).strict().refine(value => Object.values(value).some(v => v !== undefined), 'No writable fields')
export const xDraftUpdateSchema = z.object({
  expected_revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), changes: xDraftChangesSchema,
}).strict()
export const xDraftListSchema = z.object({
  status: z.enum(['pending', 'posted', 'discarded', 'all']).optional(), source_type: sourceType.optional(),
  q: z.string().trim().max(200).optional(),
  since: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  until: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  page: z.number().int().min(1).max(10000).optional(), limit: z.number().int().min(1).max(50).optional(),
}).strict().refine(value => value.since === undefined || value.until === undefined || value.since <= value.until, 'Invalid time range')
export function parseXDraft<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (!result.success) throw new BrainApiError(400, result.error.issues.map(issue => issue.message).join('; '))
  return result.data
}
export function xDraftListQuery(params: URLSearchParams) {
  const input: Record<string, unknown> = {}
  for (const [key, value] of params) {
    if (params.getAll(key).length !== 1) throw new BrainApiError(400, 'Duplicate query parameter')
    input[key] = ['since', 'until', 'page', 'limit'].includes(key)
      ? (/^\d+$/.test(value) ? Number(value) : NaN) : value
  }
  return parseXDraft(xDraftListSchema, input)
}

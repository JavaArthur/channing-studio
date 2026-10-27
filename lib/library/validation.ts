import { z } from 'zod'
import { BrainApiError } from '@/lib/agent-brain/validation'
import { libraryKinds } from './types'
const sourceUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    try {
      const u = new URL(value)
      return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password
    } catch {
      return false
    }
  }, '来源链接必须使用 HTTP(S)，且不能包含凭据')
  .nullable()
  .optional()
export const captureSchema = z
  .object({
    request_key: z.string().regex(/^[A-Za-z0-9_.:-]{16,128}$/),
    type: z.enum(['note', 'article', 'tool', 'prompt', 'inspiration']),
    title: z.string().trim().min(1).max(200),
    content: z.string().max(50000).default(''),
    summary: z.string().max(1000).default(''),
    saved_reason: z.string().max(2000).default(''),
    source_url: sourceUrl,
    topics: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
    collection_ids: z.array(z.string().min(1).max(180)).max(10).default([]),
    source_status: z.enum(['unknown', 'available', 'unavailable']).default('unknown'),
    decision_question: z.string().max(1000).default(''),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (['article', 'tool'].includes(v.type) && !v.source_url)
      ctx.addIssue({ code: 'custom', path: ['source_url'], message: '工具和文章摘录需要原始链接' })
    if (
      v.source_status !== 'unavailable' &&
      ['prompt', 'inspiration'].includes(v.type) &&
      !v.content.trim()
    )
      ctx.addIssue({ code: 'custom', path: ['content'], message: '请提供正文' })
  })
export const librarySearchSchema = z
  .object({
    sort: z.enum(['newest', 'updated', 'title', 'relevance']).optional(),
    recent: z.boolean().optional(),
    q: z.string().max(200).optional(),
    kind: z.enum([...libraryKinds, 'article']).optional(),
    collection: z.string().max(180).optional(),
    topic: z.string().max(40).optional(),
    favorite: z.boolean().optional(),
    decisions: z.boolean().optional(),
    archived: z.boolean().optional(),
    page: z.number().int().min(1).max(10000).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict()
export const itemReferenceSchema = z
  .object({ kind: z.enum(libraryKinds), id: z.string().min(1).max(200) })
  .strict()
export const libraryChangesSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().max(50000).optional(),
    source_url: sourceUrl,
    summary: z.string().max(1000).optional(),
    saved_reason: z.string().max(2000).optional(),
    topics: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
    source_status: z.enum(['unknown', 'available', 'unavailable']).optional(),
    decision_question: z.string().max(1000).optional(),
    favorite: z.boolean().optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, '没有需要保存的更改')
export function parseLibrary<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value)
  if (!result.success) throw new BrainApiError(400, result.error.issues[0]?.message || '无效参数')
  return result.data
}
export function canonicalSource(value?: string | null) {
  if (!value) return null
  const u = new URL(value)
  u.hash = ''
  for (const key of [...u.searchParams.keys()])
    if (/^utm_|^(fbclid|gclid)$/i.test(key)) u.searchParams.delete(key)
  u.searchParams.sort()
  return u.toString()
}

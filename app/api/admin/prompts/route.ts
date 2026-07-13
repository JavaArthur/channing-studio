import {
  createPrompt,
  getPrompts,
  normalizePromptTags,
  normalizePromptUrl,
} from '@/lib/repositories/prompts'
import { ensureAuthenticatedRequest, getRouteEnvWithDb, jsonError, jsonOk, parseJsonBody } from '@/lib/server/route-helpers'
import type { NextRequest } from 'next/server'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export async function GET(req: NextRequest) {
  const route = await getRouteEnvWithDb('数据库未配置')
  if (!route.ok) return route.response
  const authError = await ensureAuthenticatedRequest(req, route.db)
  if (authError) return authError

  try {
    return jsonOk({ success: true, prompts: await getPrompts(route.db, { includeHidden: true }) })
  } catch (error) {
    console.error('Admin prompts fetch error:', error)
    return jsonError('获取提示词失败', 500)
  }
}

export async function POST(req: NextRequest) {
  const route = await getRouteEnvWithDb('数据库未配置')
  if (!route.ok) return route.response
  const authError = await ensureAuthenticatedRequest(req, route.db)
  if (authError) return authError

  try {
    const payload = await parseJsonBody<Record<string, unknown>>(req)
    const title = text(payload.title)
    const prompt = text(payload.prompt)
    if (!title || !prompt) return jsonError('标题和提示词正文不能为空', 400)

    const sourceUrl = payload.source_url === undefined ? null : normalizePromptUrl(payload.source_url)
    if (payload.source_url && !sourceUrl) return jsonError('来源链接必须是 http 或 https 地址', 400)

    const id = await createPrompt(route.db, {
      title,
      prompt,
      description: text(payload.description) || null,
      category: text(payload.category) || null,
      tags: normalizePromptTags(payload.tags),
      source_url: sourceUrl,
      is_pinned: payload.is_pinned === 1 ? 1 : 0,
      is_hidden: payload.is_hidden === 1 ? 1 : 0,
      sort_order: typeof payload.sort_order === 'number' ? payload.sort_order : 0,
    })
    return jsonOk({ success: true, id })
  } catch (error) {
    console.error('Admin prompt create error:', error)
    return jsonError('创建提示词失败', 500)
  }
}

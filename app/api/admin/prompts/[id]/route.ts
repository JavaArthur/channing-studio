import {
  deletePrompt,
  normalizePromptTags,
  normalizePromptUrl,
  updatePrompt,
} from '@/lib/repositories/prompts'
import { ensureAuthenticatedRequest, getRouteEnvWithDb, jsonError, jsonOk, parseJsonBody } from '@/lib/server/route-helpers'
import type { NextRequest } from 'next/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const route = await getRouteEnvWithDb('数据库未配置')
  if (!route.ok) return route.response
  const authError = await ensureAuthenticatedRequest(req, route.db)
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) return jsonError('缺少有效 id', 400)

  try {
    const payload = await parseJsonBody<Record<string, unknown>>(req)
    const updates: Record<string, unknown> = {}
    if (payload.title !== undefined) updates.title = typeof payload.title === 'string' ? payload.title.trim() : ''
    if (payload.prompt !== undefined) updates.prompt = typeof payload.prompt === 'string' ? payload.prompt : ''
    if (payload.description !== undefined) updates.description = typeof payload.description === 'string' ? payload.description.trim() || null : null
    if (payload.category !== undefined) updates.category = typeof payload.category === 'string' ? payload.category.trim() || null : null
    if (payload.tags !== undefined) updates.tags = normalizePromptTags(payload.tags)
    if (payload.source_url !== undefined) {
      const sourceUrl = normalizePromptUrl(payload.source_url)
      if (payload.source_url && !sourceUrl) return jsonError('来源链接必须是 http 或 https 地址', 400)
      updates.source_url = sourceUrl
    }
    if (payload.is_pinned !== undefined) updates.is_pinned = payload.is_pinned === 1 ? 1 : 0
    if (payload.is_hidden !== undefined) updates.is_hidden = payload.is_hidden === 1 ? 1 : 0
    if (typeof payload.sort_order === 'number') updates.sort_order = payload.sort_order
    if (updates.title === '' || (typeof updates.prompt === 'string' && !updates.prompt.trim())) return jsonError('标题和提示词正文不能为空', 400)

    await updatePrompt(route.db, id, updates)
    return jsonOk({ success: true })
  } catch (error) {
    console.error('Admin prompt update error:', error)
    return jsonError('更新提示词失败', 500)
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const route = await getRouteEnvWithDb('数据库未配置')
  if (!route.ok) return route.response
  const authError = await ensureAuthenticatedRequest(req, route.db)
  if (authError) return authError

  const id = Number((await params).id)
  if (!Number.isInteger(id) || id <= 0) return jsonError('缺少有效 id', 400)

  try {
    await deletePrompt(route.db, id)
    return jsonOk({ success: true })
  } catch (error) {
    console.error('Admin prompt delete error:', error)
    return jsonError('删除提示词失败', 500)
  }
}

import { isHttpUrl, isSafeLink } from '@/lib/url'
import {
  createTool,
  deleteTool,
  getTools,
  updateTool,
  type ToolType,
} from '@/lib/repositories/tools'
import { invalidatePublicContentCache } from '@/lib/cache'
import {
  ensureAuthenticatedRequest,
  getRouteEnvWithDb,
  jsonError,
  jsonOk,
  parseJsonBody,
} from '@/lib/server/route-helpers'
import type { NextRequest } from 'next/server'

const VALID_TYPES: ToolType[] = ['url', 'repo', 'mac-app', 'other']

function normalizeType(value: unknown): ToolType {
  return VALID_TYPES.includes(value as ToolType) ? (value as ToolType) : 'url'
}

function normalizeTags(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10)
    : []
}

// 公开：返回所有工具（工具墙渲染用）
export async function GET() {
  const route = await getRouteEnvWithDb('数据库未配置')
  if (!route.ok) return route.response
  try {
    const tools = await getTools(route.db)
    return jsonOk({ success: true, tools })
  } catch (error) {
    console.error('Tools fetch error:', error)
    return jsonError('获取工具失败', 500)
  }
}

// 管理：新增工具
export async function POST(req: NextRequest) {
  const route = await getRouteEnvWithDb('数据库未配置')
  if (!route.ok) return route.response
  const { env, db } = route

  const authError = await ensureAuthenticatedRequest(req, db)
  if (authError) return authError

  try {
    const payload = await parseJsonBody<Record<string, unknown>>(req)
    const name = typeof payload.name === 'string' ? payload.name.trim() : ''
    if (!name) return jsonError('名称不能为空', 400)

    const url = typeof payload.url === 'string' && payload.url.trim() ? payload.url.trim() : null
    const description =
      typeof payload.description === 'string' && payload.description.trim()
        ? payload.description.trim()
        : null
    const icon = typeof payload.icon === 'string' && payload.icon.trim() ? payload.icon.trim() : null

    if (url && !isHttpUrl(url)) return jsonError('链接必须是 http 或 https 地址', 400)
    if (icon && !isSafeLink(icon)) return jsonError('图标地址不正确', 400)
    const id = await createTool(db, {
      name,
      url,
      type: normalizeType(payload.type),
      description,
      tags: normalizeTags(payload.tags),
      icon,
      is_pinned: payload.is_pinned === 1 ? 1 : 0,
    })

    await invalidatePublicContentCache(env)
    return jsonOk({ success: true, id })
  } catch (error) {
    console.error('Tool create error:', error)
    return jsonError('创建工具失败', 500)
  }
}

// 管理：更新工具
export async function PATCH(req: NextRequest) {
  const route = await getRouteEnvWithDb('数据库未配置')
  if (!route.ok) return route.response
  const { env, db } = route

  const authError = await ensureAuthenticatedRequest(req, db)
  if (authError) return authError

  try {
    const payload = await parseJsonBody<Record<string, unknown>>(req)
    const id = typeof payload.id === 'number' ? payload.id : Number(payload.id)
    if (!id || Number.isNaN(id)) return jsonError('缺少有效 id', 400)

    const updates: Record<string, unknown> = {}
    if (typeof payload.name === 'string') updates.name = payload.name.trim()
    if (payload.url !== undefined) {
      updates.url = typeof payload.url === 'string' && payload.url.trim() ? payload.url.trim() : null
    }
    if (payload.type !== undefined) updates.type = normalizeType(payload.type)
    if (payload.description !== undefined) {
      updates.description =
        typeof payload.description === 'string' && payload.description.trim()
          ? payload.description.trim()
          : null
    }
    if (payload.tags !== undefined) updates.tags = normalizeTags(payload.tags)
    if (payload.icon !== undefined) {
      updates.icon = typeof payload.icon === 'string' && payload.icon.trim() ? payload.icon.trim() : null
    }
    if (payload.is_pinned !== undefined) updates.is_pinned = payload.is_pinned === 1 ? 1 : 0
    if (typeof payload.sort_order === 'number') updates.sort_order = payload.sort_order

    if (updates.url && !isHttpUrl(updates.url)) return jsonError('链接必须是 http 或 https 地址', 400)
    if (updates.icon && !isSafeLink(updates.icon)) return jsonError('图标地址不正确', 400)
    await updateTool(db, id, updates)
    await invalidatePublicContentCache(env)
    return jsonOk({ success: true })
  } catch (error) {
    console.error('Tool update error:', error)
    return jsonError('更新工具失败', 500)
  }
}

// 管理：删除工具
export async function DELETE(req: NextRequest) {
  const route = await getRouteEnvWithDb('数据库未配置')
  if (!route.ok) return route.response
  const { env, db } = route

  const authError = await ensureAuthenticatedRequest(req, db)
  if (authError) return authError

  try {
    const { searchParams } = new URL(req.url)
    const id = Number(searchParams.get('id'))
    if (!id || Number.isNaN(id)) return jsonError('缺少有效 id', 400)

    await deleteTool(db, id)
    await invalidatePublicContentCache(env)
    return jsonOk({ success: true })
  } catch (error) {
    console.error('Tool delete error:', error)
    return jsonError('删除工具失败', 500)
  }
}

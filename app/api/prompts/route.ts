import { getPrompts } from '@/lib/repositories/prompts'
import { getRouteEnvWithDb, jsonError, jsonOk } from '@/lib/server/route-helpers'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const route = await getRouteEnvWithDb('数据库未配置')
  if (!route.ok) return route.response

  try {
    const rawLimit = Number(req.nextUrl.searchParams.get('limit') || 0)
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.trunc(rawLimit), 100) : undefined
    const prompts = await getPrompts(route.db, {
      category: req.nextUrl.searchParams.get('category')?.trim() || undefined,
      tag: req.nextUrl.searchParams.get('tag')?.trim() || undefined,
      limit,
    })
    return jsonOk({ success: true, prompts })
  } catch (error) {
    console.error('Public prompts fetch error:', error)
    return jsonError('获取提示词失败', 500)
  }
}

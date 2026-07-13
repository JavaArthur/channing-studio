import type { NextRequest } from 'next/server'
import { ensureHermesAgentRequest } from '@/lib/agent-knowledge/auth'
import { getAgentState } from '@/lib/agent-knowledge/repository'
import { getRouteEnvWithDb, jsonError, jsonOk } from '@/lib/server/route-helpers'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  const route = await getRouteEnvWithDb('Dashboard DB unavailable')
  if (!route.ok) return route.response
  const unauthorized = await ensureHermesAgentRequest(req, route.env)
  if (unauthorized) return unauthorized

  const startDate = req.nextUrl.searchParams.get('start_date') ?? ''
  const endDate = req.nextUrl.searchParams.get('end_date') ?? ''
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate) || startDate > endDate) {
    return jsonError('时间窗口不合法', 400)
  }
  try {
    return jsonOk(await getAgentState(route.db, startDate, endDate))
  } catch {
    return jsonError('Dashboard API unavailable', 500)
  }
}

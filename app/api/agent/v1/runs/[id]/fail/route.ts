import type { NextRequest } from 'next/server'
import { ensureHermesAgentRequest } from '@/lib/agent-knowledge/auth'
import { getAgentRepositoryErrorStatus } from '@/lib/agent-knowledge/errors'
import { failAgentRun } from '@/lib/agent-knowledge/repository'
import { parseFailRunPayload } from '@/lib/agent-knowledge/validation'
import { getRouteEnvWithDb, jsonError, jsonOk, parseJsonBody } from '@/lib/server/route-helpers'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const route = await getRouteEnvWithDb('Dashboard DB unavailable')
  if (!route.ok) return route.response
  const unauthorized = await ensureHermesAgentRequest(req, route.env)
  if (unauthorized) return unauthorized

  let input
  try {
    input = parseFailRunPayload(await parseJsonBody(req))
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '请求不合法', 400)
  }

  try {
    const { id } = await params
    await failAgentRun(route.db, id, input)
    return jsonOk({ success: true })
  } catch (error) {
    const status = getAgentRepositoryErrorStatus(error)
    if (status) return jsonError(error instanceof Error ? error.message : '运行记录冲突', status)
    return jsonError('Dashboard API unavailable', 500)
  }
}

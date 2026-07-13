import type { NextRequest } from 'next/server'
import { ensureHermesAgentRequest } from '@/lib/agent-knowledge/auth'
import { createAgentRun } from '@/lib/agent-knowledge/repository'
import { parseRunStartPayload } from '@/lib/agent-knowledge/validation'
import { getRouteEnvWithDb, jsonError, jsonOk, parseJsonBody } from '@/lib/server/route-helpers'

export async function POST(req: NextRequest) {
  const route = await getRouteEnvWithDb('Dashboard DB unavailable')
  if (!route.ok) return route.response
  const unauthorized = await ensureHermesAgentRequest(req, route.env)
  if (unauthorized) return unauthorized

  let input
  try {
    input = parseRunStartPayload(await parseJsonBody(req))
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : '请求不合法', 400)
  }

  try {
    const runId = await createAgentRun(route.db, input)
    return jsonOk({ runId }, 201)
  } catch {
    return jsonError('Dashboard API unavailable', 500)
  }
}

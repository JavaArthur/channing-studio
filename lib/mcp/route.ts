import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { BrainApiError, readBody } from '@/lib/agent-brain/validation'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { verifyHermesBearerToken } from '@/lib/agent-knowledge/auth'
import { createWorkspaceMcpServer, type McpAccess } from './server'

function privateResponse(response: Response) {
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'private, no-store, max-age=0')
  headers.set('Vary', 'Authorization, Origin')
  headers.set('X-Robots-Tag', 'noindex, nofollow')
  return new Response(response.body, { status: response.status, headers })
}
function failure(status: number, message: string, headers?: Record<string, string>) {
  return privateResponse(Response.json({ error: message }, { status, headers }))
}
export async function handleMcpRequest(request: Request) {
  try {
    const env = await getAppCloudflareEnv()
    const origin = request.headers.get('origin')
    const allowedOrigin = new URL(env.NEXT_PUBLIC_SITE_URL || request.url).origin
    if (origin && origin !== allowedOrigin) return failure(403, 'Origin not allowed')
    const authorization = request.headers.get('authorization')
    const [write, read] = await Promise.all([
      verifyHermesBearerToken(authorization, env.MCP_WRITE_TOKEN),
      verifyHermesBearerToken(authorization, env.MCP_READ_TOKEN),
    ])
    // Never fall back to Hermes, blog API keys or browser sessions.
    if (!write && !read) return failure(401, 'MCP credential required', { 'WWW-Authenticate': 'Bearer realm="channing-studio-mcp"' })
    if (request.method !== 'POST') return failure(405, 'Use Streamable HTTP POST; standalone SSE and sessions are not supported', { Allow: 'POST' })
    if (!env.DB) return failure(503, 'Database unavailable')
    let parsedBody: unknown
    try { parsedBody = await readBody(request) }
    catch (error) {
      if (error instanceof BrainApiError) {
        if (error.status === 400) return privateResponse(Response.json({ jsonrpc: '2.0', id: null,
          error: { code: -32700, message: 'Parse error' } }, { status: 400 }))
        return failure(error.status, error.message)
      }
      throw error
    }
    if (Array.isArray(parsedBody)) return privateResponse(Response.json({ jsonrpc: '2.0', id: null,
      error: { code: -32600, message: 'JSON-RPC batch requests are not supported' } }, { status: 400 }))
    const access: McpAccess = write ? 'write' : 'read'
    const server = createWorkspaceMcpServer(env.DB, access)
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 256 * 1024,
    })
    try {
      await server.connect(transport)
      const response = await transport.handleRequest(request, { parsedBody })
      // JSON response mode completes each call before resolving; no stream/session remains to retain.
      return privateResponse(response)
    } finally { await server.close() }
  } catch {
    // Do not log raw SDK/DB errors, request bodies or credentials.
    return failure(500, 'MCP request failed')
  }
}

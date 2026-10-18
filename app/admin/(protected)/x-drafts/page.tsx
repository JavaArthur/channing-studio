import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { listXDrafts } from '@/lib/repositories/x-drafts'
import { XDraftBoard } from '@/components/x-drafts/XDraftBoard'

export const dynamic = 'force-dynamic'
export default async function XDraftPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const raw = await searchParams
  // Repeated query parameters arrive as arrays; keep the first value only.
  const params = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])) as { status?: string; range?: string; q?: string; page?: string }
  const env = await getAppCloudflareEnv()
  if (!env.DB) return <p role="alert">数据库未连接，请检查本地环境。</p>
  const status = params.status === 'posted' || params.status === 'discarded' || params.status === 'all' ? params.status : 'pending'
  const range = ['today', '7', '30'].includes(params.range ?? '') ? params.range! : 'all'
  // This dynamic Server Component computes time filters once per request.
  // eslint-disable-next-line react-hooks/purity
  const now = Math.floor(Date.now() / 1000)
  // Midnight in Asia/Shanghai (UTC+8), independent of the Worker timezone.
  const since = range === 'today' ? Math.floor((now + 28800) / 86400) * 86400 - 28800
    : range === 'all' ? undefined : now - Number(range) * 86400
  const query = params.q?.slice(0, 200) ?? ''
  const page = Math.max(1, Math.min(10000, parseInt(params.page ?? '1') || 1))
  const data = await listXDrafts(env.DB, { status, since, q: query, page, limit: 30 })
  return <XDraftBoard {...data} status={status} range={range} query={query} />
}

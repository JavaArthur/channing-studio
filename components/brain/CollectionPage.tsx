import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { listBrainItems, type BrainKind } from '@/lib/repositories/brain'
import { BrainCollection } from './BrainCollection'
export async function CollectionPage({
  kind,
  params,
}: {
  kind: BrainKind
  params: { q?: string; page?: string; archived?: string }
}) {
  const env = await getAppCloudflareEnv()
  if (!env.DB) return <p role="alert">数据库未连接，请检查本地环境。</p>
  const page = Math.max(1, Math.min(10000, parseInt(params.page || '1') || 1))
  const archived = params.archived === '1'
  const query = params.q?.slice(0, 200) ?? ''
  const data = await listBrainItems(env.DB, kind, query, archived, page)
  return <BrainCollection kind={kind} {...data} page={page} archived={archived} query={query} />
}

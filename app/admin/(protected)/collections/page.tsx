import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { listCollections } from '@/lib/repositories/library'
import { Collections } from '@/components/library/Collections'
export const dynamic = 'force-dynamic'
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>
}) {
  const archived = (await searchParams).archived === '1'
  const env = await getAppCloudflareEnv()
  if (!env.DB) return <p role="alert">数据库未连接。</p>
  return <Collections items={await listCollections(env.DB, archived)} archived={archived} />
}

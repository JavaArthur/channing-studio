import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getStudioSnapshot } from '@/lib/studio-settings'
import { StudioManager } from './StudioManager'
export const metadata = { title: '公开首页管理' }
export default async function StudioAdminPage() {
  const env=await getAppCloudflareEnv()
  if(!env?.DB) throw new Error('数据库未连接')
  const {content,revision}=await getStudioSnapshot(env.DB)
  return <StudioManager initialRevision={revision} initialContent={content} />
}

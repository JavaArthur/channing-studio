import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { DEFAULT_STUDIO_CONTENT } from '@/lib/studio-content'
import { getStudioContent } from '@/lib/studio-settings'
import { StudioManager } from './StudioManager'

export const metadata = { title: '工作室管理' }

export default async function StudioAdminPage() {
  let content = DEFAULT_STUDIO_CONTENT
  let databaseAvailable = false

  try {
    const env = await getAppCloudflareEnv()
    if (env?.DB) {
      databaseAvailable = true
      content = await getStudioContent(env.DB)
    }
  } catch (error) {
    console.error('Studio settings fetch error:', error)
  }

  return (
    <div>
      {!databaseAvailable && (
        <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          当前没有连接 D1，下面的默认内容不会被保存。请先检查 Cloudflare 数据库绑定。
        </p>
      )}
      <StudioManager initialContent={content} />
    </div>
  )
}

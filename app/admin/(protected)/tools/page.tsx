import { getTools } from '@/lib/repositories/tools'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { ToolsManager } from './ToolsManager'

export const metadata = { title: '工具管理' }

export default async function AdminToolsPage() {
  const env = await getAppCloudflareEnv()
  if(!env?.DB) throw new Error('数据库未连接')
  const tools=await getTools(env.DB, { includeHidden:true })

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif font-medium text-xl text-[var(--editor-ink)]">工具管理</h1>
        <p className="text-sm text-[var(--editor-muted)] mt-0.5">
          收藏的工具、仓库、Mac 软件 · 共 {tools.length} 件
        </p>
      </div>
      <ToolsManager initialTools={tools} />
    </div>
  )
}

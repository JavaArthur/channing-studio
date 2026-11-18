import { getTools } from '@/lib/repositories/tools'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { ToolsManager } from './ToolsManager'

export const metadata = { title: '工具管理' }

export default async function AdminToolsPage() {
  const env = await getAppCloudflareEnv()
  if (!env?.DB) throw new Error('数据库未连接')
  const tools = await getTools(env.DB, { includeHidden: true })
  const publicCount = tools.filter((t) => !t.is_hidden).length

  return (
    <div className="atelier-surface-page">
      <div className="workspace-page-heading">
        <div>
          <span className="atelier-eyebrow">ARSENAL // TOOLS CURATION</span>
          <h1>工具管理</h1>
          <p>
            收藏的工具、仓库与本地软件 · 共 {tools.length} 件（{publicCount} 件已公开）
          </p>
        </div>
      </div>
      <ToolsManager initialTools={tools} />
    </div>
  )
}

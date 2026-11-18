import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getPrompts } from '@/lib/repositories/prompts'
import { PromptsManager } from './PromptsManager'

export const metadata = { title: '提示词管理' }

export default async function AdminPromptsPage() {
  const env = await getAppCloudflareEnv()
  if (!env?.DB) throw new Error('数据库未连接')
  const prompts = await getPrompts(env.DB, { includeHidden: true })
  const publicCount = prompts.filter((p) => !p.is_hidden).length

  return (
    <div className="atelier-surface-page">
      <div className="workspace-page-heading">
        <div>
          <span className="atelier-eyebrow">ARSENAL // PROMPT SPECIMENS</span>
          <h1>提示词管理</h1>
          <p>
            收藏、整理和发布真正复用过的提示词 · 共 {prompts.length} 条（{publicCount} 条已公开）
          </p>
        </div>
      </div>
      <PromptsManager initialPrompts={prompts} />
    </div>
  )
}

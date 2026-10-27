import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getPrompts } from '@/lib/repositories/prompts'
import { PromptsManager } from './PromptsManager'

export const metadata = { title: '提示词管理' }

export default async function AdminPromptsPage() {
  const env = await getAppCloudflareEnv()
  if(!env?.DB) throw new Error('数据库未连接')
  const prompts=await getPrompts(env.DB, { includeHidden:true })

  return (
    <div>
      <div className="workspace-page-heading"><div>
        <h1 className="font-serif font-medium text-xl text-[var(--editor-ink)]">提示词管理</h1>
        <p className="mt-0.5 text-sm text-[var(--editor-muted)]">收藏、整理和发布真正复用过的提示词 · 共 {prompts.length} 条</p>
      </div></div>
      <PromptsManager initialPrompts={prompts} />
    </div>
  )
}

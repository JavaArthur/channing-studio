import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getPrompts, type Prompt } from '@/lib/repositories/prompts'
import { PromptsManager } from './PromptsManager'

export const metadata = { title: '提示词管理' }

export default async function AdminPromptsPage() {
  const env = await getAppCloudflareEnv()
  let prompts: Prompt[] = []
  if (env?.DB) {
    try {
      prompts = await getPrompts(env.DB, { includeHidden: true })
    } catch (error) {
      console.error('Prompts fetch error:', error)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--editor-ink)]">提示词管理</h1>
        <p className="mt-0.5 text-sm text-[var(--editor-muted)]">收藏、整理和发布真正复用过的提示词 · 共 {prompts.length} 条</p>
      </div>
      <PromptsManager initialPrompts={prompts} />
    </div>
  )
}

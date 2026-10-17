export const dynamic = 'force-dynamic'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getSiteHeaderData } from '@/lib/site'
import { getPrompts, type Prompt } from '@/lib/repositories/prompts'
import { StudioShell } from '@/components/StudioSection'
import { ResourceTabs } from '@/components/ResourceTabs'
import { PromptCard } from '@/components/PromptCard'
import { getSiteUrl } from '@/lib/site-config'
import type { SiteNavLink } from '@/lib/site'
import type { Theme } from '@/lib/appearance'

export const metadata = {
  title: '提示词 · Channing Studio',
  description: '我会继续使用、修改和复盘的提示词收藏。',
  alternates: { canonical: `${getSiteUrl()}/prompts` },
}

export default async function PromptsPage() {
  let prompts: Prompt[] = []
  let navLinks: SiteNavLink[] = []
  let defaultTheme: Theme = 'light'

  try {
    const env = await getAppCloudflareEnv()
    if (env?.DB) {
      const [headerData, promptRows] = await Promise.all([
        getSiteHeaderData(env.DB),
        getPrompts(env.DB),
      ])
      navLinks = headerData.navLinks
      defaultTheme = headerData.defaultTheme
      prompts = promptRows
    }
  } catch (error) {
    console.error('Prompts page: failed to fetch prompts', error)
  }

  return (
    <StudioShell
      eyebrow="PROMPTS / 07"
      title="把好用的提示词留下来。"
      description="不是收集越多越好，而是记录那些真正改变过工作结果的提问方式。"
      navLinks={navLinks}
      initialTheme={defaultTheme}
    >
      <ResourceTabs active="prompts" />
      {prompts.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2">
          {prompts.map((prompt) => <PromptCard key={prompt.id} prompt={prompt} />)}
        </div>
      ) : (
        <div className="studio-empty-state">
          <p>提示词收藏还在建立中</p>
          <span>后续会分享经过实践的提示词。</span>
        </div>
      )}
    </StudioShell>
  )
}

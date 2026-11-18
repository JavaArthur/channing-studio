export const dynamic = 'force-dynamic'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getSiteHeaderData } from '@/lib/site'
import { getPrompts, type Prompt } from '@/lib/repositories/prompts'
import { StudioLink, StudioShell } from '@/components/StudioSection'
import { ResourceTabs } from '@/components/ResourceTabs'
import { PromptCard } from '@/components/PromptCard'
import { getSiteUrl } from '@/lib/site-config'
import type { SiteNavLink } from '@/lib/site'
import type { Theme } from '@/lib/appearance'
import '@/styles/studio-indexes.css'

export const metadata = {
  title: '提示词',
  description: '持续使用、迭代和复盘的工程与写作提示词收藏。',
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

  const categories = [
    ...new Set(prompts.map((prompt) => prompt.category?.trim() || '未分类')),
  ]
  const groups = categories.map((category) => ({
    category,
    prompts: prompts.filter(
      (prompt) => (prompt.category?.trim() || '未分类') === category,
    ),
  }))

  return (
    <StudioShell
      eyebrow="TOOLKIT // 04 · PROMPTS"
      meta={prompts.length > 0 ? `${prompts.length} PROMPT SPECIMENS` : 'SPECIMEN ARCHIVE'}
      className="studio-index-page"
      title="提示词笔记"
      description="按真实工程研发与技术写作场景沉淀的提示词样本。展开检阅完整指令正文，复制后再按任务边界裁剪调整。"
      navLinks={navLinks}
      initialTheme={defaultTheme}
    >
      <ResourceTabs active="prompts" />
      {prompts.length > 0 ? (
        <>
          {groups.length > 1 && (
            <nav className="index-contents" aria-label="提示词分类目录">
              {groups.map((group, index) => (
                <a key={group.category} href={`#prompt-group-${index}`}>
                  <span>{group.category}</span>
                  <span>{group.prompts.length}</span>
                </a>
              ))}
            </nav>
          )}

          {groups.map((group, index) => (
            <section
              key={group.category}
              id={`prompt-group-${index}`}
              className="index-resource-section"
              aria-labelledby={`prompt-heading-${index}`}
            >
              <div className="index-section-heading">
                <span className="index-section-number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h2 id={`prompt-heading-${index}`}>{group.category}</h2>
                <span className="index-meta">{group.prompts.length} 份样本</span>
              </div>

              <div className="index-prompt-list">
                {group.prompts.map((prompt) => (
                  <PromptCard key={prompt.id} prompt={prompt} />
                ))}
              </div>
            </section>
          ))}
        </>
      ) : (
        <div className="studio-empty-state">
          <p>提示词收藏还在建立中</p>
          <span>后续会持续归档经过实战验证的提示词样本。</span>
          <StudioLink href="/tools">浏览工具收藏</StudioLink>
        </div>
      )}
    </StudioShell>
  )
}

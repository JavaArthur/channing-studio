export const dynamic = 'force-dynamic'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { DEFAULT_STUDIO_CONTENT } from '@/lib/studio-content'
import { getStudioSettingsWithNav } from '@/lib/studio-settings'
import { cachedPublicData, PUBLIC_CACHE_TAGS } from '@/lib/public-cache'
import { getTools, type Tool } from '@/lib/repositories/tools'
import { selectStudioTools } from '@/lib/studio-home'
import { ArrowUpRight } from 'lucide-react'
import { StudioLink, StudioShell } from '@/components/StudioSection'
import '@/styles/studio-indexes.css'
import { getSiteUrl } from '@/lib/site-config'
import type { Theme } from '@/lib/appearance'
import type { SiteNavLink } from '@/lib/site'

const LAB_TYPE_LABELS: Record<string, string> = {
  tool: '工具',
  skill: 'Skill',
  workflow: '工作流',
  agent: 'Agent',
}

export const metadata = {
  title: '工具链实验',
  description: '正在使用和持续迭代的写作自动化工具链与 Agent 工作流。',
  alternates: { canonical: `${getSiteUrl()}/labs` },
}

export default async function LabsPage() {
  let content = DEFAULT_STUDIO_CONTENT
  let navLinks: SiteNavLink[] = []
  let defaultTheme: Theme = 'light'
  let tools: Tool[] = []
  try {
    const env = await getAppCloudflareEnv()
    if (env?.DB) {
      const db = env.DB
      const data = await cachedPublicData(
        ['labs'],
        [PUBLIC_CACHE_TAGS.nav, PUBLIC_CACHE_TAGS.studio, PUBLIC_CACHE_TAGS.tools],
        async () => {
          const [settings, toolRows] = await Promise.all([
            getStudioSettingsWithNav(db),
            getTools(db),
          ])
          return {
            navLinks: settings.navLinks,
            defaultTheme: settings.defaultTheme,
            content: settings.content,
            tools: toolRows,
          }
        },
      )
      navLinks = data.navLinks
      defaultTheme = data.defaultTheme
      content = data.content
      tools = data.tools
    }
  } catch (error) {
    console.error('Labs page: failed to fetch content', error)
  }

  const visibleLabs = content.labs.filter((lab) => lab.visible)

  return (
    <StudioShell
      eyebrow="BENCH // 05 · LABS"
      meta={
        visibleLabs.length > 0
          ? `${visibleLabs.length} WORKFLOW COMPONENTS`
          : 'EXPERIMENTAL BENCH'
      }
      className="studio-index-page"
      title="工具链与自动化实验"
      description="网页剪藏、Markdown 同步与 Agent 发布脚本。这里归档各个小工具的设计职责与源码入口，展示它们如何串联日常写作与研发流程。"
      navLinks={navLinks}
      initialTheme={defaultTheme}
    >
      {visibleLabs.length > 0 ? (
        <section aria-label="公开实验">
          <div className="index-register">
            <span>WORKFLOW &amp; AGENT BENCH · 组件与工作流</span>
            <span>{visibleLabs.length} 项公开实验</span>
          </div>
          <ol className="index-lab-list">
            {visibleLabs.map((lab, index) => (
              <li key={lab.id}>
                <StudioLink href={lab.href} className="index-lab-entry">
                  <span className="index-section-number" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <article>
                    <span className="index-category">
                      {LAB_TYPE_LABELS[lab.type] ?? lab.type}
                    </span>
                    <h2>{lab.title}</h2>
                    <p>{lab.description}</p>
                  </article>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="index-entry-arrow"
                    size={20}
                  />
                </StudioLink>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <div className="studio-empty-state">
          <p>实验室正在整理中</p>
          <span>可以先浏览日常工程中使用的工具架。</span>
          <StudioLink href="/tools">浏览工具收藏</StudioLink>
        </div>
      )}

      {tools.length > 0 && (
        <section className="index-related" aria-labelledby="related-tools">
          <div className="index-section-heading">
            <span className="index-section-number" aria-hidden="true">
              REF
            </span>
            <h2 id="related-tools">相关在用工具</h2>
            <StudioLink href="/tools" className="index-text-link">
              完整工具架
              <ArrowUpRight aria-hidden size={14} />
            </StudioLink>
          </div>
          <div className="index-related-links">
            {selectStudioTools(tools).map((tool) => (
              <StudioLink
                key={tool.id}
                href={tool.url || '/tools'}
                className="index-text-link"
              >
                {tool.name}
                <ArrowUpRight aria-hidden size={14} />
              </StudioLink>
            ))}
          </div>
        </section>
      )}
    </StudioShell>
  )
}

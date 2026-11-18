export const dynamic = 'force-dynamic'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getSiteHeaderData } from '@/lib/site'
import { DEFAULT_STUDIO_CONTENT } from '@/lib/studio-content'
import { getStudioContent } from '@/lib/studio-settings'
import { getTools, type Tool } from '@/lib/repositories/tools'
import { selectStudioTools } from '@/lib/studio-home'
import { ArrowUpRight } from 'lucide-react'
import { StudioLink, StudioShell } from '@/components/StudioSection'
import '@/styles/studio-indexes.css'
import { getSiteUrl } from '@/lib/site-config'
import type { Theme } from '@/lib/appearance'
import type { SiteNavLink } from '@/lib/site'

const LAB_TYPE_LABELS: Record<string, string> = { tool: '工具', skill: 'Skill', workflow: '工作流', agent: 'Agent' }

export const metadata = {
  title: '实验室 · Channing Studio',
  description: '正在使用和持续折腾的内容工具链与 Agent 工作流。',
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
      const [headerData, studioContent, toolRows] = await Promise.all([
        getSiteHeaderData(env.DB),
        getStudioContent(env.DB),
        getTools(env.DB),
      ])
      navLinks = headerData.navLinks
      defaultTheme = headerData.defaultTheme
      content = studioContent
      tools = toolRows
    }
  } catch (error) {
    console.error('Studio labs: failed to fetch content', error)
  }

  const visibleLabs = content.labs.filter((lab) => lab.visible)

  return (
    <StudioShell
      eyebrow="LABS / 实验记录"
      className="studio-index-page"
      title="工具链实验室"
      description="发布工具、工作流与 Agent 实验。这里保留各个组件的说明与入口，便于理解它们在流程中承担的工作。"
      navLinks={navLinks}
      initialTheme={defaultTheme}
    >
      {visibleLabs.length > 0 && (
        <section aria-label="公开实验">
          <div className="index-register"><span>组件与工作流</span><span>{visibleLabs.length} 项公开实验</span></div>
          <ol className="index-lab-list">
            {visibleLabs.map((lab, index) => (
              <li key={lab.id}>
                <StudioLink href={lab.href} className="index-lab-entry">
                  <span className="index-section-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                  <article><span className="index-category">{LAB_TYPE_LABELS[lab.type] ?? lab.type}</span><h2>{lab.title}</h2><p>{lab.description}</p></article>
                  <ArrowUpRight aria-hidden="true" className="index-entry-arrow" size={20} />
                </StudioLink>
              </li>
            ))}
          </ol>
        </section>
      )}
      {visibleLabs.length === 0 && (
        <div className="studio-empty-state">
          <p>实验室正在整理中</p>
          <span>可以先浏览工作中使用的工具。</span>
          <StudioLink href="/tools">浏览工具收藏</StudioLink>
        </div>
      )}
      {tools.length > 0 && (
        <section className="index-related" aria-labelledby="related-tools">
          <div className="index-section-heading"><h2 id="related-tools">相关工具</h2><StudioLink href="/tools" className="index-text-link">完整工具架<ArrowUpRight aria-hidden size={16} /></StudioLink></div>
          <div className="index-related-links">
            {selectStudioTools(tools).map((tool) => (
              <StudioLink key={tool.id} href={tool.url || '/tools'} className="index-text-link">{tool.name}<ArrowUpRight aria-hidden size={14} /></StudioLink>
            ))}
          </div>
        </section>
      )}
    </StudioShell>
  )
}

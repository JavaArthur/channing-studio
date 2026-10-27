export const dynamic = 'force-dynamic'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getSiteHeaderData } from '@/lib/site'
import { DEFAULT_STUDIO_CONTENT } from '@/lib/studio-content'
import { getStudioContent } from '@/lib/studio-settings'
import { getTools, type Tool } from '@/lib/repositories/tools'
import { selectStudioTools } from '@/lib/studio-home'
import { ArrowUpRight } from 'lucide-react'
import { StudioCardLabel, StudioLink, StudioShell } from '@/components/StudioSection'
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

  return (
    <StudioShell
      title="先把自己每天用的工具做好。"
      description="实验室放正在验证的工作流、发布工具和 Agent 能力；它们不一定完美，但都能解决真实问题。"
      navLinks={navLinks}
      initialTheme={defaultTheme}
    >
      <div className="divide-y divide-[var(--editor-line)] border-y border-[var(--editor-line)]">
        {content.labs.filter((lab) => lab.visible).map((lab) => (
          <StudioLink key={lab.id} href={lab.href} className="block">
            <article className="studio-lab-row">
              <div>
                <StudioCardLabel>{LAB_TYPE_LABELS[lab.type] ?? lab.type}</StudioCardLabel>
                <h2 className="font-serif font-medium mt-2 text-xl text-[var(--editor-ink)]">{lab.title}</h2>
              </div>
              <div className="flex items-center gap-5">
                <p className="hidden max-w-lg text-sm leading-7 text-[var(--editor-muted)] sm:block">{lab.description}</p>
                <ArrowUpRight aria-hidden className="studio-card-arrow" size={20} />
              </div>
            </article>
          </StudioLink>
        ))}
      </div>
      {tools.length > 0 && (
        <div className="mt-14 border-t border-[var(--editor-line)] pt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-serif font-medium studio-section-title">相关工具</h2>
            <StudioLink href="/tools" className="min-h-11 min-w-11 inline-flex items-center gap-1">完整工具箱<ArrowUpRight aria-hidden size={16} /></StudioLink>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-1">
            {selectStudioTools(tools).map((tool) => (
              <StudioLink key={tool.id} href={tool.url || '/tools'} className="min-h-11 min-w-11 inline-flex items-center gap-1">{tool.name}<ArrowUpRight aria-hidden size={14} /></StudioLink>
            ))}
          </div>
        </div>
      )}
    </StudioShell>
  )
}

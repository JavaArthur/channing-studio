import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getSiteHeaderData } from '@/lib/site'
import { DEFAULT_STUDIO_CONTENT } from '@/lib/studio-content'
import { getStudioContent } from '@/lib/studio-settings'
import { StudioCardLabel, StudioLink, StudioShell } from '@/components/StudioSection'
import { getSiteUrl } from '@/lib/site-config'
import type { Theme } from '@/lib/appearance'
import type { SiteNavLink } from '@/lib/site'

export const metadata = {
  title: '实验室 · Channing Studio',
  description: '正在使用和持续折腾的内容工具链与 Agent 工作流。',
  alternates: { canonical: `${getSiteUrl()}/labs` },
}

export default async function LabsPage() {
  let content = DEFAULT_STUDIO_CONTENT
  let navLinks: SiteNavLink[] = []
  let defaultTheme: Theme = 'default'
  try {
    const env = await getAppCloudflareEnv()
    if (env?.DB) {
      const [headerData, studioContent] = await Promise.all([getSiteHeaderData(env.DB), getStudioContent(env.DB)])
      navLinks = headerData.navLinks
      defaultTheme = headerData.defaultTheme
      content = studioContent
    }
  } catch (error) {
    console.error('Studio labs: failed to fetch content', error)
  }

  return (
    <StudioShell
      eyebrow="LAB / 04"
      title="先把自己每天用的工具做好。"
      description="实验室放正在验证的工作流、发布工具和 Agent 能力；它们不一定完美，但都能解决真实问题。"
      navLinks={navLinks}
      initialTheme={defaultTheme}
    >
      <div className="divide-y divide-[var(--editor-line)] border-y border-[var(--editor-line)]">
        {content.labs.filter((lab) => lab.visible).map((lab) => (
          <StudioLink key={lab.id} href={lab.href}>
            <article className="studio-lab-row">
              <div>
                <StudioCardLabel>{lab.type.toUpperCase()}</StudioCardLabel>
                <h2 className="mt-2 text-xl font-semibold text-[var(--editor-ink)]">{lab.title}</h2>
              </div>
              <div className="flex items-center gap-5">
                <p className="hidden max-w-lg text-sm leading-7 text-[var(--editor-muted)] sm:block">{lab.description}</p>
                <span aria-hidden className="studio-card-arrow">↗</span>
              </div>
            </article>
          </StudioLink>
        ))}
      </div>
    </StudioShell>
  )
}

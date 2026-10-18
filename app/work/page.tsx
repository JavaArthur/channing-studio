export const dynamic = 'force-dynamic'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getSiteHeaderData } from '@/lib/site'
import { DEFAULT_STUDIO_CONTENT } from '@/lib/studio-content'
import { getPublicStudioContent } from '@/lib/public-studio'
import { StudioCardLabel, StudioLink, StudioShell } from '@/components/StudioSection'
import { getSiteUrl } from '@/lib/site-config'
import type { Theme } from '@/lib/appearance'
import type { SiteNavLink } from '@/lib/site'

export const metadata = {
  title: '作品 · Channing Studio',
  description: 'Channing 的公开工程项目与内容系统案例。',
  alternates: { canonical: `${getSiteUrl()}/work` },
}

export default async function WorkPage() {
  let content = DEFAULT_STUDIO_CONTENT
  let navLinks: SiteNavLink[] = []
  let defaultTheme: Theme = 'light'
  try {
    const env = await getAppCloudflareEnv()
    if (env?.DB) {
      const [headerData, studioContent] = await Promise.all([getSiteHeaderData(env.DB), getPublicStudioContent(env.DB)])
      navLinks = headerData.navLinks
      defaultTheme = headerData.defaultTheme
      content = studioContent
    }
  } catch (error) {
    console.error('Studio work: failed to fetch content', error)
  }

  return (
    <StudioShell
      eyebrow="SELECTED WORK / 03"
      title="把判断变成可以继续运行的东西。"
      description="这里放可以公开说明的系统、工具链和工程方法，重点是约束、取舍和交付结果。"
      navLinks={navLinks}
      initialTheme={defaultTheme}
    >
      <div className="grid gap-5 md:grid-cols-2">
        {content.projects.filter((project) => project.visible).map((project) => (
          <StudioLink className="min-h-11 min-w-11 block" key={project.id} href={project.href}>
            <article className="studio-card h-full">
              <StudioCardLabel>PROJECT / {project.id}</StudioCardLabel>
              <h2 className="font-serif font-medium studio-card-title mt-8">{project.title}</h2>
              <p className="studio-card-description mt-4">{project.description}</p>
              <div className="mt-7 flex flex-wrap gap-2">
                {project.tags.map((tag) => <span key={tag} className="studio-tag">{tag}</span>)}
              </div>
            </article>
          </StudioLink>
        ))}
      </div>
    </StudioShell>
  )
}

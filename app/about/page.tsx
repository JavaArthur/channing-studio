export const dynamic = 'force-dynamic'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getSiteHeaderData } from '@/lib/site'
import { DEFAULT_STUDIO_CONTENT } from '@/lib/studio-content'
import { getStudioContent } from '@/lib/studio-settings'
import { StudioCardLabel, StudioLink, StudioShell } from '@/components/StudioSection'
import { getSiteUrl } from '@/lib/site-config'
import type { Theme } from '@/lib/appearance'
import type { SiteNavLink } from '@/lib/site'

export const metadata = {
  title: '关于我 · Channing Studio',
  description: '关于 Channing 的工作方式、工程判断和公开联系入口。',
  alternates: { canonical: `${getSiteUrl()}/about` },
}

export default async function AboutPage() {
  let content = DEFAULT_STUDIO_CONTENT
  let navLinks: SiteNavLink[] = []
  let defaultTheme: Theme = 'light'
  try {
    const env = await getAppCloudflareEnv()
    if (env?.DB) {
      const [headerData, studioContent] = await Promise.all([getSiteHeaderData(env.DB), getStudioContent(env.DB)])
      navLinks = headerData.navLinks
      defaultTheme = headerData.defaultTheme
      content = studioContent
    }
  } catch (error) {
    console.error('Studio about: failed to fetch content', error)
  }

  return (
    <StudioShell
      eyebrow="ABOUT / 07"
      title={content.profile.title}
      description={content.profile.statement}
      navLinks={navLinks}
      initialTheme={defaultTheme}
    >
      <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
        <div>
          <p className="studio-eyebrow">{content.profile.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-4">
            {content.profile.contactLinks.map((link) => <StudioLink key={link.url} href={link.url} className="min-h-11 min-w-11 inline-flex items-center">{link.label} ↗</StudioLink>)}
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {content.profile.capabilities.map((capability, index) => (
            <article key={capability.title} className="studio-card">
              <StudioCardLabel>0{index + 1}</StudioCardLabel>
              <h2 className="font-serif font-medium mt-8 text-xl text-[var(--editor-ink)]">{capability.title}</h2>
              <p className="mt-4 text-sm leading-7 text-[var(--editor-muted)]">{capability.description}</p>
            </article>
          ))}
        </div>
      </div>
    </StudioShell>
  )
}

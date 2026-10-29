export const dynamic = 'force-dynamic'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getSiteHeaderData } from '@/lib/site'
import { DEFAULT_STUDIO_CONTENT } from '@/lib/studio-content'
import { getStudioContent } from '@/lib/studio-settings'
import { ArrowUpRight } from 'lucide-react'
import { StudioLink, StudioShell } from '@/components/StudioSection'
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
      title={content.profile.title}
      description={content.profile.statement}
      navLinks={navLinks}
      initialTheme={defaultTheme}
    >
      <div className="public-about-layout">
        <div>
          <p className="studio-hero-subtitle">{content.profile.subtitle}</p>
          <div className="public-contact-links">
            {content.profile.contactLinks.map((link) => <StudioLink key={link.url} href={link.url} className="public-text-link">{link.label}<ArrowUpRight aria-hidden size={16} /></StudioLink>)}
          </div>
        </div>
        <dl className="border-t border-[var(--editor-line)]">
          {content.profile.capabilities.map((capability) => (
            <div key={capability.title} className="public-capability">
              <dt className="font-serif font-medium text-xl text-[var(--editor-ink)]">{capability.title}</dt>
              <dd className="text-base leading-7 text-[var(--editor-muted)]">{capability.description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </StudioShell>
  )
}

export const dynamic = 'force-dynamic'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getSiteHeaderData } from '@/lib/site'
import { DEFAULT_STUDIO_CONTENT } from '@/lib/studio-content'
import { getStudioContent } from '@/lib/studio-settings'
import { StudioShell } from '@/components/StudioSection'
import { AboutProfile } from '@/components/AboutProfile'
import { PUBLIC_PROFILE } from '@/lib/public-profile'
import { getSiteUrl } from '@/lib/site-config'
import type { Theme } from '@/lib/appearance'
import type { SiteNavLink } from '@/lib/site'

export const metadata = {
  title: '关于我 · Channing Studio',
  description: PUBLIC_PROFILE.intro,
  alternates: { canonical: `${getSiteUrl()}/about` },
}

export default async function AboutPage() {
  let content = DEFAULT_STUDIO_CONTENT
  let navLinks: SiteNavLink[] = []
  let defaultTheme: Theme = 'light'
  try {
    const env = await getAppCloudflareEnv()
    if (env?.DB) {
      const [headerData, studioContent] = await Promise.all([
        getSiteHeaderData(env.DB),
        getStudioContent(env.DB),
      ])
      navLinks = headerData.navLinks
      defaultTheme = headerData.defaultTheme
      content = studioContent
    }
  } catch (error) {
    console.error('Studio about: failed to fetch content', error)
  }

  return (
    <StudioShell
      title={PUBLIC_PROFILE.headline.replace('，', '，\n')}
      description={PUBLIC_PROFILE.introduction}
      eyebrow="DOSSIER // ABOUT CHANNING"
      meta={`${PUBLIC_PROFILE.experience} · ${PUBLIC_PROFILE.experienceAsOf}`}
      className="studio-about"
      navLinks={navLinks}
      initialTheme={defaultTheme}
    >
      <AboutProfile
        contactLinks={content.profile.contactLinks}
        capabilities={content.profile.capabilities}
      />
    </StudioShell>
  )
}

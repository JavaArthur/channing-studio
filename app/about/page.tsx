export const dynamic = 'force-dynamic'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { DEFAULT_STUDIO_CONTENT } from '@/lib/studio-content'
import { getStudioSettingsWithNav } from '@/lib/studio-settings'
import { cachedPublicData, PUBLIC_CACHE_TAGS } from '@/lib/public-cache'
import { StudioShell } from '@/components/StudioSection'
import { AboutProfile } from '@/components/AboutProfile'
import { PUBLIC_PROFILE } from '@/lib/public-profile'
import { getSiteUrl } from '@/lib/site-config'
import type { Theme } from '@/lib/appearance'
import type { SiteNavLink } from '@/lib/site'

export const metadata = {
  title: '关于作者',
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
      const db = env.DB
      const data = await cachedPublicData(
        ['about'],
        [PUBLIC_CACHE_TAGS.nav, PUBLIC_CACHE_TAGS.studio],
        () => getStudioSettingsWithNav(db),
      )
      navLinks = data.navLinks
      defaultTheme = data.defaultTheme
      content = data.content
    }
  } catch (error) {
    console.error('About page: failed to fetch content', error)
  }

  return (
    <StudioShell
      title={PUBLIC_PROFILE.headline.replace('，', '，\n')}
      description={PUBLIC_PROFILE.introduction}
      eyebrow={`PROFILE // ${PUBLIC_PROFILE.brand} · 关于作者`}
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

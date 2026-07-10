import { getPosts } from '@/lib/db'
import { getTools, type Tool } from '@/lib/repositories/tools'
import { getPrompts, type Prompt } from '@/lib/repositories/prompts'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getStudioContent } from '@/lib/studio-settings'
import { DEFAULT_STUDIO_CONTENT } from '@/lib/studio-content'
import { selectFeaturedPosts } from '@/lib/studio-home'
import { type Theme } from '@/lib/appearance'
import type { SiteNavLink } from '@/lib/site'
import { getSiteHeaderData } from '@/lib/site'
import { StudioHome } from '@/components/StudioHome'
import { getSiteUrl } from '@/lib/site-config'
import type { PostWithTags } from '@/lib/repositories/types'

const BASE_URL = getSiteUrl()

export const revalidate = 3600
export const dynamicParams = true

export const metadata = {
  title: 'Channing Studio · 晨启AI',
  description: 'AI 平台工程、内容自动化与真实交付的公开工作台。',
  alternates: { canonical: BASE_URL },
}

export default async function Home() {
  let content = DEFAULT_STUDIO_CONTENT
  let posts: PostWithTags[] = []
  let navLinks: SiteNavLink[] = []
  let tools: Tool[] = []
  let prompts: Prompt[] = []
  let defaultTheme: Theme = 'default'

  try {
    const env = await getAppCloudflareEnv()
    if (env?.DB) {
      const [headerData, studioContent, recentPosts, toolRows, promptRows] = await Promise.all([
        getSiteHeaderData(env.DB),
        getStudioContent(env.DB),
        getPosts(env.DB, 25, 0, false, false, false, false, 'post'),
        getTools(env.DB),
        getPrompts(env.DB).catch(() => []),
      ])
      content = studioContent
      posts = selectFeaturedPosts(recentPosts, content.featuredPostSlugs)
      tools = toolRows
      prompts = promptRows
      navLinks = headerData.navLinks
      defaultTheme = headerData.defaultTheme
    }
  } catch (error) {
    console.error('Studio homepage: failed to fetch content', error)
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Channing Studio',
            url: BASE_URL,
            description: metadata.description,
            potentialAction: {
              '@type': 'SearchAction',
              target: { '@type': 'EntryPoint', urlTemplate: `${BASE_URL}/search?q={search_term_string}` },
              'query-input': 'required name=search_term_string',
            },
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Person',
            name: 'Channing',
            url: BASE_URL,
            sameAs: content.profile.contactLinks.filter((link) => link.url.startsWith('http')).map((link) => link.url),
          }),
        }}
      />
      <StudioHome
        content={content}
        posts={posts}
        tools={tools}
        prompts={prompts}
        navLinks={navLinks}
        initialTheme={defaultTheme}
      />
    </>
  )
}

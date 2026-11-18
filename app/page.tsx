import { getPosts } from '@/lib/db'
import { getTools, type Tool } from '@/lib/repositories/tools'
import { getPromptSummaries, type PromptSummary } from '@/lib/repositories/prompts'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getStudioContent } from '@/lib/studio-settings'
import { getPublicPortfolio } from '@/lib/repositories/portfolio'
import type { PublicPortfolioProject } from '@/lib/portfolio'
import { getFeaturedPosts } from '@/lib/repositories/posts'
import { DEFAULT_STUDIO_CONTENT } from '@/lib/studio-content'
import { selectFeaturedPosts } from '@/lib/studio-home'
import { type Theme } from '@/lib/appearance'
import type { SiteNavLink } from '@/lib/site'
import { getSiteHeaderData } from '@/lib/site'
import { StudioHome } from '@/components/StudioHome'
import { getSiteUrl } from '@/lib/site-config'
import { PUBLIC_PROFILE } from '@/lib/public-profile'
import type { PostWithTags } from '@/lib/repositories/types'

const BASE_URL = getSiteUrl()

export const dynamic = 'force-dynamic'
export const dynamicParams = true

export const metadata = {
  title: { absolute: '晨启AI · AI 工程与技术博客' },
  description:
    '从 Java 后端到 AI Agent，记录企业级 AI 落地、架构取舍与实战复盘的个人技术博客。',
  alternates: { canonical: BASE_URL },
}

export default async function Home() {
  let content = DEFAULT_STUDIO_CONTENT
  let portfolio: PublicPortfolioProject[] = []
  let posts: PostWithTags[] = []
  let navLinks: SiteNavLink[] = []
  let tools: Tool[] = []
  let prompts: PromptSummary[] = []
  let defaultTheme: Theme = 'light'

  try {
    const env = await getAppCloudflareEnv()
    if (env?.DB) {
      const db = env.DB
      const [headerData, studioContent] = await Promise.all([
        getSiteHeaderData(db, { includeCategories: false }),
        getStudioContent(db),
      ])
      content = studioContent
      const mods = content.homeModules
      const needPosts = mods.featuredEssay || mods.writing
      const postSelectionLimit = Math.max(mods.writingLimit + 1, 6)

      const [portfolioRows, recentPosts, featured, toolRows, promptRows] =
        await Promise.all([
          mods.projects ? getPublicPortfolio(db) : Promise.resolve([]),
          needPosts
            ? getPosts(db, 25, 0, false, false, false, false, 'post')
            : Promise.resolve([]),
          needPosts
            ? getFeaturedPosts(db, content.featuredPostSlugs)
            : Promise.resolve([]),
          mods.tools ? getTools(db, { limit: 4 }) : Promise.resolve([]),
          mods.prompts
            ? getPromptSummaries(db, 4).catch(() => [])
            : Promise.resolve([]),
        ])

      portfolio = portfolioRows
        .filter(
          (item) =>
            item.slug !== 'channing-studio' &&
            !/channing[\s-]*studio/i.test(item.title),
        )
        .slice(0, mods.projectsLimit)
      posts = needPosts
        ? selectFeaturedPosts(
            [...featured, ...recentPosts],
            content.featuredPostSlugs,
            postSelectionLimit,
          )
        : []
      tools = toolRows
      prompts = promptRows
      navLinks = headerData.navLinks
      defaultTheme = headerData.defaultTheme
    }
  } catch (error) {
    console.error('Blog homepage: failed to fetch content', error)
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: PUBLIC_PROFILE.brand,
            url: BASE_URL,
            description: metadata.description,
            potentialAction: {
              '@type': 'SearchAction',
              target: {
                '@type': 'EntryPoint',
                urlTemplate: `${BASE_URL}/search?q={search_term_string}`,
              },
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
            '@type': 'Blog',
            name: PUBLIC_PROFILE.brand,
            url: BASE_URL,
            author: {
              '@type': 'Person',
              name: PUBLIC_PROFILE.alias,
              sameAs: content.profile.contactLinks
                .filter((link) => link.url.startsWith('http'))
                .map((link) => link.url),
            },
          }),
        }}
      />
      <StudioHome
        content={content}
        portfolio={portfolio}
        posts={posts}
        tools={tools}
        prompts={prompts}
        navLinks={navLinks}
        initialTheme={defaultTheme}
      />
    </>
  )
}

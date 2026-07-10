import { getPosts, getPostsCount } from '@/lib/db'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { type Theme } from '@/lib/appearance'
import type { SiteCategoryLink, SiteNavLink } from '@/lib/site'
import { getSiteHeaderData } from '@/lib/site'
import { HomeClient } from '@/components/HomeClient'
import { getSiteUrl } from '@/lib/site-config'

const PAGE_SIZE = 25
const BASE_URL = getSiteUrl()

export const revalidate = 3600
export const dynamicParams = true

export const metadata = {
  title: '文章 · Channing Studio',
  description: '关于 AI、工程、产品和生活的持续记录。',
  alternates: { canonical: `${BASE_URL}/writing` },
}

export default async function WritingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageStr } = await searchParams
  const currentPage = Math.max(1, parseInt(pageStr ?? '1', 10) || 1)

  let posts: Awaited<ReturnType<typeof getPosts>> = []
  let totalCount = 0
  let navLinks: SiteNavLink[] = []
  let categories: SiteCategoryLink[] = []
  let defaultTheme: Theme = 'default'

  try {
    const env = await getAppCloudflareEnv()
    if (env?.DB) {
      const [headerData, writingPosts, count] = await Promise.all([
        getSiteHeaderData(env.DB),
        getPosts(env.DB, PAGE_SIZE, (currentPage - 1) * PAGE_SIZE, false, false, false, false, 'post'),
        getPostsCount(env.DB, false, false, false, false, 'post'),
      ])
      posts = writingPosts
      totalCount = count
      navLinks = headerData.navLinks
      categories = headerData.categories
      defaultTheme = headerData.defaultTheme
    }
  } catch (error) {
    console.error('Writing index: failed to fetch posts', error)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const categorySlugMap: Record<string, string> = Object.fromEntries(
    categories.map((category) => [category.name, category.slug]),
  )

  return (
    <>
      <div className="border-b border-[var(--editor-line)] bg-[var(--background)]">
        <div className="mx-auto max-w-3xl px-4 pb-8 pt-12 sm:px-6 sm:pt-16">
          <p className="studio-eyebrow">WRITING / ARCHIVE</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--editor-ink)] sm:text-5xl">持续记录</h1>
          <p className="mt-4 text-base leading-7 text-[var(--editor-muted)]">把实践、判断和还没想透的部分写下来。</p>
        </div>
      </div>
      <HomeClient
        initialTheme={defaultTheme}
        posts={posts}
        categories={categories}
        navLinks={navLinks}
        currentPage={currentPage}
        totalPages={totalPages}
        categorySlugMap={categorySlugMap}
      />
    </>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPostsByCategory, getPostsCountByCategory, getPublicCategories } from '@/lib/db'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { Pagination } from '@/components/Pagination'
import { getSiteHeaderData } from '@/lib/site'
import { getSiteUrl } from '@/lib/site-config'
import { resolveRequestTheme } from '@/lib/server-appearance'
import { formatDate } from '@/lib/format-date'

const PAGE_SIZE = 25
const BASE_URL = getSiteUrl()

export const dynamicParams = true
// ISR: 需要 open-next.config.ts 配置 incrementalCache + tagCache 才能生效
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  try {
    const env = await getAppCloudflareEnv()
    if (!env?.DB) return {}

    const categories = await getPublicCategories(env.DB)
    const category = categories.find((item) => item.slug === slug)
    if (!category) return {}

    return {
      title: `${category.name}`,
      alternates: {
        canonical: `${BASE_URL}/category/${slug}`,
      },
    }
  } catch {
    return {}
  }
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { slug } = await params
  const { page: pageStr } = await searchParams
  const currentPage = Math.max(1, parseInt(pageStr ?? '1', 10) || 1)

  const env = await getAppCloudflareEnv()
  if (!env?.DB) notFound()

  const categories = await getPublicCategories(env.DB)
  const category = categories.find((item) => item.slug === slug)
  if (!category) notFound()

  const [posts, totalCount, headerData] = await Promise.all([
    getPostsByCategory(env.DB, category.name, PAGE_SIZE, (currentPage - 1) * PAGE_SIZE),
    getPostsCountByCategory(env.DB, category.name),
    getSiteHeaderData(env.DB),
  ])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const requestTheme = await resolveRequestTheme(headerData.defaultTheme)

  return (
    <div className="public-page min-h-screen flex flex-col bg-[var(--background)]">
      <SiteHeader
        initialTheme={requestTheme}
        navLinks={headerData.navLinks}
        categories={headerData.categories}
        activeCategorySlug={slug}
      />

      <main className="page-main public-archive-main flex-1 mx-auto max-w-3xl w-full px-4 sm:px-6 py-10 sm:py-14">
        <div className="public-archive-heading">
          <h1 className="font-serif font-medium">
            {category.name}
          </h1>
          <p className="mt-3 text-sm text-[var(--editor-muted)]">
            分类文章，共 {totalCount} 篇
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="studio-empty-state">
            <p>{currentPage > 1 ? '这一页没有文章' : '这个分类下还没有公开文章'}</p>
            <span>可以返回首页，继续浏览其他文章。</span>
            {currentPage > 1 && <Link href={`/category/${slug}`} className="public-text-link">返回分类首页</Link>}
            <Link
              href="/"
              className="min-h-11 min-w-11 inline-flex items-center text-sm text-[var(--editor-accent)] hover:underline underline-offset-2"
            >
              返回首页
            </Link>
          </div>
        ) : (
          <>
            <div className="public-archive-list">
              {posts.map((post) => (
                <article
                  key={post.slug}
                  className="public-archive-entry group"
                >
                  <Link
                    href={`/${post.slug}`}
                    className="public-archive-row-link"
                  >
                    <h2 className="font-serif font-medium text-xl sm:text-2xl text-[var(--editor-ink)] leading-snug mb-2 group-hover:text-[var(--editor-accent)] transition-colors duration-200">
                      {post.title}
                    </h2>
                    {post.description ? (
                      <p className="public-entry-description">
                        {post.description}
                      </p>
                    ) : null}
                    <div className="public-entry-meta">
                      <time dateTime={new Date(post.published_at * 1000).toISOString()}>{formatDate(post.published_at)}</time>
                      <span className="px-2 py-0.5 rounded-full bg-[var(--editor-accent)]/8 text-[var(--editor-accent)] font-medium border border-[var(--editor-accent)]/15">
                        {category.name}
                      </span>
                    </div>
                  </Link>
                </article>
              ))}
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              basePath={`/category/${slug}`}
            />
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}

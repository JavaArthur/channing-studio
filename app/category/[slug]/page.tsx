import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  getPostsByCategory,
  getPostsCountByCategory,
  getPublicCategories,
} from '@/lib/db'
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
    getPostsByCategory(
      env.DB,
      category.name,
      PAGE_SIZE,
      (currentPage - 1) * PAGE_SIZE,
    ),
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

      <main
        id="main-content"
        tabIndex={-1}
        className="page-main public-archive-main flex-1 w-full"
      >
        <header className="public-archive-heading">
          <div className="public-page-strip">
            <p className="public-page-eyebrow">
              <span className="public-eyebrow-tick" aria-hidden="true" />
              INDEX // CATEGORY ARCHIVE
            </p>
            <span className="public-page-meta">{totalCount} ENTRIES</span>
          </div>
          <h1>{category.name}</h1>
          <p>分类公开文章归档 · 共 {totalCount} 篇</p>
        </header>

        {posts.length === 0 ? (
          <div className="studio-empty-state mt-8">
            <p>{currentPage > 1 ? '这一页没有文章' : '这个分类下还没有公开文章'}</p>
            <span>可以返回工程手记，继续浏览其他文章。</span>
            <div className="public-empty-actions">
              {currentPage > 1 && (
                <Link href={`/category/${slug}`} className="public-text-link">
                  返回分类首页
                </Link>
              )}
              <Link href="/writing" className="public-text-link">
                浏览全部文章
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="public-archive-list">
              {posts.map((post) => (
                <article key={post.slug} className="public-archive-entry group">
                  <Link
                    href={`/${post.slug}`}
                    className="public-archive-row-link"
                  >
                    <h2>{post.title}</h2>
                    {post.description ? (
                      <p className="public-entry-description">
                        {post.description}
                      </p>
                    ) : null}
                    <div className="public-entry-meta">
                      <time
                        dateTime={new Date(post.published_at * 1000).toISOString()}
                      >
                        {formatDate(post.published_at)}
                      </time>
                      <span className="article-category-chip">
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

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getClippings, getClippingsCount } from '@/lib/db'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { Pagination } from '@/components/Pagination'
import { getSiteHeaderData } from '@/lib/site'
import { getSiteUrl } from '@/lib/site-config'
import { resolveRequestTheme } from '@/lib/server-appearance'
import { formatDate } from '@/lib/format-date'
import { isHttpUrl } from '@/lib/url'

const PAGE_SIZE = 25
const BASE_URL = getSiteUrl()

export const dynamicParams = true
export const dynamic = 'force-dynamic'

export const metadata = {
  title: '剪报',
  description: '收藏的好文章与外部内容，带原文出处。',
  alternates: { canonical: `${BASE_URL}/clippings` },
}

function sourceHost(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export default async function ClippingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageStr } = await searchParams
  const currentPage = Math.max(1, parseInt(pageStr ?? '1', 10) || 1)

  const env = await getAppCloudflareEnv()
  if (!env?.DB) notFound()

  const [posts, totalCount, headerData] = await Promise.all([
    getClippings(env.DB, PAGE_SIZE, (currentPage - 1) * PAGE_SIZE),
    getClippingsCount(env.DB),
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
      />

      <main className="page-main public-archive-main flex-1 mx-auto max-w-3xl w-full px-4 sm:px-6 py-10 sm:py-14">
        <div className="public-archive-heading">
          <h1 className="font-serif font-medium">
            剪报收藏
          </h1>
          <p className="mt-3 text-sm text-[var(--editor-muted)]">
            读到的好文章与外部内容，共 {totalCount} 条，均保留原文出处
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="studio-empty-state">
            <p>{currentPage > 1 ? '这一页没有剪报' : '剪报区还是空的'}</p>
            <span>读到的好文章与原文出处会收录在这里。</span>
            {currentPage > 1 && <Link href="/clippings" className="public-text-link">返回剪报首页</Link>}
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
              {posts.map((post) => {
                const host = post.source_url && isHttpUrl(post.source_url) ? sourceHost(post.source_url) : null
                return (
                  <article
                    key={post.slug}
                    className="public-archive-entry group"
                  >
                    <div className="public-clipping-content">
                      <Link href={`/${post.slug}`} className="min-h-11 min-w-11 block group/title">
                        <h2 className="font-serif font-medium text-xl sm:text-2xl text-[var(--editor-ink)] leading-snug mb-2 group-hover/title:text-[var(--editor-accent)] transition-colors duration-200">
                          {post.title}
                        </h2>
                      </Link>
                      {post.description ? (
                        <p className="public-entry-description">
                          {post.description}
                        </p>
                      ) : null}
                      <div className="public-entry-meta">
                        <time dateTime={new Date(post.published_at * 1000).toISOString()}>{formatDate(post.published_at)}</time>
                        {host && (
                          <>
                            <a
                              href={post.source_url ?? '#'}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                              className="min-h-11 min-w-11 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--editor-accent)]/8 text-[var(--editor-accent)] font-medium border border-[var(--editor-accent)]/15 hover:bg-[var(--editor-accent)]/12 transition-colors"
                            >
                              原文：{host}
                              <svg aria-hidden="true" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M7 17 17 7M7 7h10v10" />
                              </svg>
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              basePath="/clippings"
            />
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}

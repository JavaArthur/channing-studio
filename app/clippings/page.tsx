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
    <div className="min-h-full flex flex-col bg-[var(--background)]">
      <SiteHeader
        initialTheme={requestTheme}
        navLinks={headerData.navLinks}
        categories={headerData.categories}
      />

      <main className="page-main flex-1 mx-auto max-w-3xl w-full px-4 sm:px-6 py-10 sm:py-14">
        <div className="mb-8 border-b border-[var(--editor-line)] pb-6">
          <div className="text-xs uppercase tracking-[0.18em] text-[var(--stone-gray)] mb-3">
            剪报
          </div>
          <h1 className="article-display-title text-3xl sm:text-4xl font-bold text-[var(--editor-ink)] leading-tight">
            收藏的好东西
          </h1>
          <p className="mt-3 text-sm text-[var(--editor-muted)]">
            读到的好文章与外部内容，共 {totalCount} 条 · 均保留原文出处
          </p>
        </div>

        {posts.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-[var(--editor-muted)] mb-2">剪报区还是空的</p>
            <Link
              href="/"
              className="text-sm text-[var(--editor-accent)] hover:underline underline-offset-2"
            >
              返回首页
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-0">
              {posts.map((post, index) => {
                const host = sourceHost(post.source_url)
                return (
                  <article
                    key={post.slug}
                    className="group border-t border-[var(--editor-line)] first:border-t-0"
                    style={{ animation: `fadeInUp 0.4s ease-out ${index * 0.05}s both` }}
                  >
                    <div className="py-6 sm:py-7 pl-4 border-l-2 border-l-transparent hover:border-l-[var(--editor-accent)] transition-all duration-200">
                      <Link href={`/${post.slug}`} className="block group/title">
                        <h2 className="text-xl sm:text-2xl font-bold text-[var(--editor-ink)] leading-snug mb-2 group-hover/title:text-[var(--editor-accent)] transition-colors duration-200">
                          {post.title}
                        </h2>
                      </Link>
                      {post.description ? (
                        <p className="text-sm text-[var(--editor-muted)] leading-relaxed line-clamp-2 mb-2.5">
                          {post.description}
                        </p>
                      ) : null}
                      <div className="flex items-center gap-2 text-xs text-[var(--stone-gray)] flex-wrap">
                        <time>{formatDate(post.published_at)}</time>
                        {host && (
                          <>
                            <span aria-hidden>·</span>
                            <a
                              href={post.source_url ?? '#'}
                              target="_blank"
                              rel="noopener noreferrer nofollow"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--editor-accent)]/8 text-[var(--editor-accent)] font-medium border border-[var(--editor-accent)]/15 hover:bg-[var(--editor-accent)]/12 transition-colors"
                            >
                              原文 · {host}
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

import { getPosts, getPostsCount } from '@/lib/db'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { type Theme } from '@/lib/appearance'
import type { SiteNavLink } from '@/lib/site'
import { getSiteHeaderData } from '@/lib/site'
import { ArrowUpRight } from 'lucide-react'
import { StudioCardLabel, StudioLink, StudioShell } from '@/components/StudioSection'
import { Pagination } from '@/components/Pagination'
import { formatDate } from '@/lib/format-date'
import { getSiteUrl } from '@/lib/site-config'

const PAGE_SIZE = 25
const BASE_URL = getSiteUrl()

export const dynamic = 'force-dynamic'
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
  let defaultTheme: Theme = 'light'

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
      defaultTheme = headerData.defaultTheme
    }
  } catch (error) {
    console.error('Writing index: failed to fetch posts', error)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  return (
    <StudioShell
      title="持续记录"
      description="把实践、判断和还没想透的部分写下来。"
      navLinks={navLinks}
      initialTheme={defaultTheme}
    >
      {posts.length === 0 ? (
        <div className="studio-empty-state">
          <p>还没有文章</p>
          <span>从后台开始写作，记录思考。</span>
        </div>
      ) : (
        <>
          <div className="divide-y divide-[var(--editor-line)] border-y border-[var(--editor-line)]">
            {posts.map((post) => (
              <StudioLink key={post.slug} href={`/${post.slug}`} className="block">
                <article className="studio-writing-row group">
                  <div className="min-w-0">
                    <StudioCardLabel>{post.category || '随笔'}</StudioCardLabel>
                    <h2 className="font-serif font-medium studio-writing-title mt-2">{post.title}</h2>
                    {post.description && <p className="studio-writing-description mt-2">{post.description}</p>}
                    <time className="studio-writing-date" dateTime={new Date(post.published_at * 1000).toISOString()}>
                      {formatDate(post.published_at)}
                    </time>
                  </div>
                  <ArrowUpRight aria-hidden className="studio-card-arrow" size={20} />
                </article>
              </StudioLink>
            ))}
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} basePath="/writing" />
        </>
      )}
    </StudioShell>
  )
}

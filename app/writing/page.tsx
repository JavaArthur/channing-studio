import { getPosts, getPostsCount } from '@/lib/db'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { type Theme } from '@/lib/appearance'
import type { SiteNavLink } from '@/lib/site'
import { getSiteHeaderData } from '@/lib/site'
import { cachedPublicData, PUBLIC_CACHE_TAGS } from '@/lib/public-cache'
import { ArrowUpRight } from 'lucide-react'
import { StudioLink, StudioShell } from '@/components/StudioSection'
import '@/styles/studio-indexes.css'
import { Pagination } from '@/components/Pagination'
import { formatDate } from '@/lib/format-date'
import { getSiteUrl } from '@/lib/site-config'

const PAGE_SIZE = 25
const BASE_URL = getSiteUrl()

export const dynamic = 'force-dynamic'
export const dynamicParams = true

export const metadata = {
  title: '文章',
  description: '关于 AI Agent 架构、后端工程与产品实践的持续记录。',
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
      const db = env.DB
      const data = await cachedPublicData(
        ['writing', String(currentPage), String(PAGE_SIZE)],
        [PUBLIC_CACHE_TAGS.nav, PUBLIC_CACHE_TAGS.posts],
        async () => {
          const [headerData, writingPosts, count] = await Promise.all([
            getSiteHeaderData(db, { includeCategories: false }),
            getPosts(
              db,
              PAGE_SIZE,
              (currentPage - 1) * PAGE_SIZE,
              false,
              false,
              false,
              false,
              'post',
            ),
            getPostsCount(db, false, false, false, false, 'post'),
          ])
          return {
            posts: writingPosts,
            totalCount: count,
            navLinks: headerData.navLinks,
            defaultTheme: headerData.defaultTheme,
          }
        },
      )
      posts = data.posts
      totalCount = data.totalCount
      navLinks = data.navLinks
      defaultTheme = data.defaultTheme
    }
  } catch (error) {
    console.error('Writing index: failed to fetch posts', error)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const startOffset = (currentPage - 1) * PAGE_SIZE

  return (
    <StudioShell
      eyebrow="INDEX // 01 · WRITING"
      meta={
        totalCount > 0
          ? `${totalCount} ENTRIES · PAGE ${String(currentPage).padStart(2, '0')}/${String(totalPages).padStart(2, '0')}`
          : 'CHRONOLOGICAL LEDGER'
      }
      className="studio-index-page"
      title="技术文章与手记"
      description="记录 AI Agent 架构、知识检索、Java 后端与系统演进中的真实复盘。留下实践中的判断，也留下尚未解决的问题。"
      navLinks={navLinks}
      initialTheme={defaultTheme}
    >
      {posts.length === 0 ? (
        <div className="studio-empty-state">
          <p>{currentPage > 1 ? '这一页没有文章' : '还没有公开文章'}</p>
          <span>
            {currentPage > 1
              ? '可以返回文章首页继续阅读。'
              : '新的技术长文与思考会在这里持续更新。'}
          </span>
          <StudioLink href={currentPage > 1 ? '/writing' : '/about'}>
            {currentPage > 1 ? '返回文章首页' : '了解作者背景'}
          </StudioLink>
        </div>
      ) : (
        <>
          <div className="index-register">
            <span>CHRONOLOGICAL ARCHIVE · 共 {totalCount} 篇文章</span>
            <span>
              第 {currentPage} / {totalPages} 页
            </span>
          </div>

          <ol className="index-writing-list">
            {posts.map((post, index) => (
              <li key={post.slug}>
                <StudioLink href={`/${post.slug}`} className="index-writing-entry">
                  <div className="index-writing-meta-col">
                    <span className="index-writing-num" aria-hidden="true">
                      #{String(startOffset + index + 1).padStart(2, '0')}
                    </span>
                    <time
                      className="index-writing-date"
                      dateTime={new Date(post.published_at * 1000).toISOString()}
                    >
                      {formatDate(post.published_at)}
                    </time>
                  </div>

                  <article>
                    <span className="index-category">{post.category || '随笔'}</span>
                    <h2>{post.title}</h2>
                    {post.description && <p>{post.description}</p>}
                  </article>

                  <ArrowUpRight
                    aria-hidden="true"
                    className="index-entry-arrow"
                    size={20}
                  />
                </StudioLink>
              </li>
            ))}
          </ol>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            basePath="/writing"
          />
        </>
      )}
    </StudioShell>
  )
}

import { getPosts, getPostsCount } from '@/lib/db'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { type Theme } from '@/lib/appearance'
import type { SiteNavLink } from '@/lib/site'
import { getSiteHeaderData } from '@/lib/site'
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
      eyebrow="WRITING / 文字档案"
      className="studio-index-page"
      title="工程手记"
      description="关于 AI、工程、产品和生活的记录。留下实践中的选择，也留下尚未解决的问题。"
      navLinks={navLinks}
      initialTheme={defaultTheme}
    >
      {posts.length === 0 ? (
        <div className="studio-empty-state">
          <p>{currentPage > 1 ? '这一页没有文章' : '还没有公开文章'}</p>
          <span>{currentPage > 1 ? '可以返回文章首页继续阅读。' : '新的实践与思考会在这里更新。'}</span>
          <StudioLink href={currentPage > 1 ? '/writing' : '/work'}>{currentPage > 1 ? '返回文章首页' : '浏览作品'}</StudioLink>
        </div>
      ) : (
        <>
          <div className="index-register"><span>按发布时间排列 · {totalCount} 篇文章</span><span>第 {currentPage} / {totalPages} 页</span></div>
          <ol className="index-writing-list">
            {posts.map((post) => (
              <li key={post.slug}>
                <StudioLink href={`/${post.slug}`} className="index-writing-entry">
                  <time className="index-writing-date" dateTime={new Date(post.published_at * 1000).toISOString()}>
                    {formatDate(post.published_at)}
                  </time>
                  <article>
                    <span className="index-category">{post.category || '随笔'}</span>
                    <h2>{post.title}</h2>
                    {post.description && <p>{post.description}</p>}
                  </article>
                  <ArrowUpRight aria-hidden="true" className="index-entry-arrow" size={20} />
                </StudioLink>
              </li>
            ))}
          </ol>
          <Pagination currentPage={currentPage} totalPages={totalPages} basePath="/writing" />
        </>
      )}
    </StudioShell>
  )
}

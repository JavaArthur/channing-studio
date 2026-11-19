import { getCategories, searchPosts } from '@/lib/db'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import Link from 'next/link'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import type { SiteCategoryLink, SiteNavLink } from '@/lib/site'
import { getSiteHeaderData } from '@/lib/site'
import { cachedPublicData, PUBLIC_CACHE_TAGS } from '@/lib/public-cache'
import type { Theme } from '@/lib/appearance'
import { resolveRequestTheme } from '@/lib/server-appearance'
import { formatDate } from '@/lib/format-date'

export const metadata = {
  title: '搜索结果',
  robots: { index: false, follow: true },
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q?.trim() || ''

  let posts: Awaited<ReturnType<typeof searchPosts>> = []
  let navLinks: SiteNavLink[] = []
  let categories: SiteCategoryLink[] = []
  let defaultTheme: Theme = 'light'

  try {
    const env = await getAppCloudflareEnv()
    if (env?.DB) {
      const db = env.DB
      const [headerData, categoryRows, searchResults] = await Promise.all([
        cachedPublicData(
          ['site-header', 'nav-only'],
          [PUBLIC_CACHE_TAGS.nav],
          () => getSiteHeaderData(db, { includeCategories: false }),
        ),
        query
          ? cachedPublicData(
              ['category-slugs'],
              [PUBLIC_CACHE_TAGS.posts],
              () => getCategories(db),
            )
          : Promise.resolve([]),
        query ? searchPosts(db, query, 100) : Promise.resolve([]),
      ])
      navLinks = headerData.navLinks
      categories = categoryRows
        .filter((category) => category.slug && category.name && category.name !== '未分类')
        .map((category) => ({ name: category.name, slug: category.slug }))
      defaultTheme = headerData.defaultTheme
      posts = searchResults
    }
  } catch (e) {
    console.error('Search page error:', e)
  }

  const categorySlugMap = new Map(
    categories.map((category) => [category.name, category.slug]),
  )
  const requestTheme = await resolveRequestTheme(defaultTheme)

  return (
    <div className="public-page min-h-screen flex flex-col bg-[var(--background)]">
      <SiteHeader
        initialTheme={requestTheme}
        navLinks={navLinks}
        categories={categories}
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
              INDEX // SEARCH ARCHIVE
            </p>
            <span className="public-page-meta">
              {query ? `${posts.length} MATCHES` : 'FULL-TEXT QUERY'}
            </span>
          </div>

          <h1>搜索文章</h1>

          <form
            action="/search"
            method="get"
            role="search"
            className="public-search-form"
          >
            <label htmlFor="public-search-query">SEARCH KEYWORD // 搜索关键词</label>
            <div className="public-search-fields">
              <input
                id="public-search-query"
                name="q"
                type="search"
                defaultValue={query}
                placeholder="AI、Agent、Java、工程实践…"
              />
              <button type="submit">检索档案</button>
            </div>
          </form>

          {query ? (
            <p>
              关键词“{query}”找到 {posts.length}
              {posts.length === 100 ? ' 篇文章（最多显示 100 篇）' : ' 篇文章'}
            </p>
          ) : (
            <p>输入关键词，检索公开工程手记与技术记录。</p>
          )}
        </header>

        {query && posts.length === 0 ? (
          <div className="studio-empty-state mt-8">
            <p>未找到相关文章</p>
            <span>试试更短的关键词，或浏览全部工程手记。</span>
            <Link href="/writing" className="public-text-link">
              浏览全部文章
            </Link>
          </div>
        ) : query ? (
          <div className="public-archive-list">
            {posts.map((post) => {
              const categorySlug = post.category
                ? categorySlugMap.get(post.category)
                : null
              return (
                <article key={post.slug} className="public-archive-entry">
                  <h2 className="public-result-title">
                    <Link href={`/${post.slug}`} className="public-article-link">
                      {post.title}
                    </Link>
                    {post.password && (
                      <svg
                        role="img"
                        aria-label="需密码访问"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-[var(--editor-muted)] flex-shrink-0"
                      >
                        <rect
                          x="3"
                          y="11"
                          width="18"
                          height="11"
                          rx="2"
                          ry="2"
                        ></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                    )}
                    {post.is_pinned === 1 && (
                      <svg
                        role="img"
                        aria-label="置顶文章"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-[var(--atelier-vermilion)] flex-shrink-0"
                      >
                        <line x1="12" y1="17" x2="12" y2="22"></line>
                        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
                      </svg>
                    )}
                  </h2>

                  {post.description && (
                    <p className="public-entry-description">{post.description}</p>
                  )}

                  <div className="public-entry-meta">
                    <time
                      dateTime={new Date(post.published_at * 1000).toISOString()}
                    >
                      {formatDate(post.published_at)}
                    </time>
                    {post.category &&
                      (categorySlug ? (
                        <Link
                          href={`/category/${categorySlug}`}
                          className="public-category-link"
                        >
                          {post.category}
                        </Link>
                      ) : (
                        <span>{post.category}</span>
                      ))}
                  </div>
                </article>
              )
            })}
          </div>
        ) : null}
      </main>

      <SiteFooter />
    </div>
  )
}

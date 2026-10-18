import { getPostBySlug, incrementViewCount, isPubliclyAccessiblePost } from '@/lib/db'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { verifyPassword } from '@/lib/password'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { FrontPostAdminBoundary } from '@/components/FrontPostAdminBoundary'
import { PasswordPrompt } from '@/components/PasswordPrompt'
import { DownloadMarkdown } from '@/components/DownloadMarkdown'
import { TwitterEmbedsEnhancer } from '@/components/TwitterEmbedsEnhancer'
import { getSiteHeaderData } from '@/lib/site'
import { getPublicContentCacheNamespace } from '@/lib/cache'
import { getSiteUrl } from '@/lib/site-config'
import { resolveRequestTheme } from '@/lib/server-appearance'
import { formatDate } from '@/lib/format-date'
import { stripLeadingTitleHeading } from '@/lib/post-render'
import { RelatedPosts } from '@/components/RelatedPosts'

// Cloudflare Workers 缓存策略
export const dynamic = 'force-dynamic' // Password checks must never share a rendered response
export const dynamicParams = true

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const baseUrl = getSiteUrl()
  try {
    const env = await getAppCloudflareEnv()
    const { slug } = await params

    if (!env?.DB) return {}

    const post = await getPostBySlug(env.DB, slug, getPublicContentCacheNamespace(env)).catch(() => null)
    if (!post || !isPubliclyAccessiblePost(post)) return {}

    // Extract first image from HTML for OG image
    const imgMatch = post.html?.match(/<img[^>]+src="([^"]+)"/)
    const ogImage = post.cover_image || imgMatch?.[1] || `${baseUrl}/icon-512.png`

    // Password-protected articles should not be indexed
    if (post.password) {
      return {
        title: post.title,
        robots: { index: false },
      }
    }

    return {
      title: post.title,
      description: post.description,
      authors: [{ name: 'Channing' }],
      alternates: {
        canonical: `${baseUrl}/${post.slug}`,
      },
      openGraph: {
        title: post.title,
        description: post.description,
        type: 'article',
        publishedTime: new Date(post.published_at * 1000).toISOString(),
        modifiedTime: new Date(post.updated_at * 1000).toISOString(),
        authors: ['Channing'],
        images: [{ url: ogImage }],
      },
      twitter: {
        card: 'summary_large_image' as const,
        title: post.title,
        description: post.description || undefined,
        images: [ogImage],
      },
    }
  } catch {
    return {}
  }
}

export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ pwd?: string }>
}) {
  const { slug } = await params
  const { pwd } = await searchParams

  let env: Awaited<ReturnType<typeof getAppCloudflareEnv>> | undefined
  try {
    env = await getAppCloudflareEnv()
  } catch {
    notFound()
  }
  if (!env?.DB) notFound()
  const db = env!.DB

  const post = await getPostBySlug(db, slug, getPublicContentCacheNamespace(env)).catch(() => null)
  if (!post) notFound()
  if (!isPubliclyAccessiblePost(post)) notFound()

  const headerData = await getSiteHeaderData(db)
  const requestTheme = await resolveRequestTheme(headerData.defaultTheme)
  const activeCategorySlug = headerData.categories.find((category) => category.name === post.category)?.slug ?? null

  // 密码保护逻辑保持公开路径纯粹，由前台管理员增强层在客户端接管编辑能力
  let passwordError: string | undefined
  const needsPassword = Boolean(post.password)

  if (needsPassword) {
    if (!pwd) {
      return (
        <div className="min-h-screen bg-[var(--background)] flex flex-col">
          <SiteHeader
            initialTheme={requestTheme}
            navLinks={headerData.navLinks}
            categories={headerData.categories}
            activeCategorySlug={activeCategorySlug}
            stickyOnMobile={false}
          />
          <main className="page-main mx-auto w-full max-w-3xl px-4 sm:px-6 flex-1 py-8 sm:py-12">
            <FrontPostAdminBoundary slug={post.slug}>
              <PasswordPrompt />
            </FrontPostAdminBoundary>
          </main>
          <SiteFooter />
        </div>
      )
    }

    const isValid = await verifyPassword(pwd, post.password!)
    if (!isValid) {
      passwordError = '密码错误，请重试'
      return (
        <div className="min-h-screen bg-[var(--background)] flex flex-col">
          <SiteHeader
            initialTheme={requestTheme}
            navLinks={headerData.navLinks}
            categories={headerData.categories}
            activeCategorySlug={activeCategorySlug}
            stickyOnMobile={false}
          />
          <main className="page-main mx-auto w-full max-w-3xl px-4 sm:px-6 flex-1 py-8 sm:py-12">
            <FrontPostAdminBoundary slug={post.slug}>
              <PasswordPrompt error={passwordError} />
            </FrontPostAdminBoundary>
          </main>
          <SiteFooter />
        </div>
      )
    }
  }

  // 异步增加阅读计数，不阻塞渲染
  void incrementViewCount(db, slug).catch(console.error)

  // 阅读时间估算（中文按 400 字/分钟）
  const textLength = post.content?.length || 0
  const readingMinutes = Math.max(1, Math.ceil(textLength / 400))
  const contentContainerId = `post-content-${post.slug}`
  const renderedHtml = stripLeadingTitleHeading(post.html, post.title)

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      <SiteHeader
        initialTheme={requestTheme}
        navLinks={headerData.navLinks}
        categories={headerData.categories}
        activeCategorySlug={activeCategorySlug}
        stickyOnMobile={false}
      />

      <main className="page-main article-main mx-auto w-full max-w-3xl px-4 sm:px-6 flex-1 py-8 sm:py-12">
        {!post.password && (() => {
          const baseUrl = getSiteUrl()
          const imgMatch = post.html?.match(/<img[^>]+src="([^"]+)"/)
          const ogImage = post.cover_image || imgMatch?.[1] || `${baseUrl}/icon-512.png`
          const jsonLd = {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.description || '',
            image: ogImage,
            author: { '@type': 'Person', name: 'Channing', url: baseUrl },
            publisher: { '@type': 'Organization', name: 'Channing Studio', url: baseUrl, logo: { '@type': 'ImageObject', url: `${baseUrl}/icon-512.png` } },
            datePublished: new Date(post.published_at * 1000).toISOString(),
            dateModified: new Date(post.updated_at * 1000).toISOString(),
            mainEntityOfPage: { '@type': 'WebPage', '@id': `${baseUrl}/${post.slug}` },
            url: `${baseUrl}/${post.slug}`,
          }
          const breadcrumbLd = {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: '首页', item: baseUrl },
              ...(post.category && activeCategorySlug
                ? [{ '@type': 'ListItem', position: 2, name: post.category, item: `${baseUrl}/category/${activeCategorySlug}` }]
                : []),
              { '@type': 'ListItem', position: post.category ? 3 : 2, name: post.title, item: `${baseUrl}/${post.slug}` },
            ],
          }
          return (
            <>
              <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
              <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
            </>
          )
        })()}
        <FrontPostAdminBoundary slug={post.slug}>
          <article>
            <header className="mb-10 sm:mb-12">
              <h1
                data-admin-edit-trigger
                className="font-serif font-medium article-display-title text-2xl sm:text-3xl lg:text-4xl text-[var(--editor-ink)] leading-snug mb-4 sm:mb-5"
              >
                {post.title}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--stone-gray)]">
                {post.category && (
                  <>
                    {activeCategorySlug ? (
                      <Link
                        href={`/category/${activeCategorySlug}`}
                        className="hit-area-44 px-2 py-0.5 rounded-full bg-[var(--editor-accent)]/8 text-[var(--editor-accent)] font-medium border border-[var(--editor-accent)]/15 hover:bg-[var(--editor-accent)]/12 transition-colors"
                      >
                        {post.category}
                      </Link>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-[var(--editor-accent)]/8 text-[var(--editor-accent)] font-medium border border-[var(--editor-accent)]/15">
                        {post.category}
                      </span>
                    )}
                    <span aria-hidden>·</span>
                  </>
                )}
                <time>
                  {formatDate(post.published_at)}
                </time>
                <span aria-hidden>·</span>
                <span>{post.view_count} 次阅读</span>
                <span aria-hidden>·</span>
                <span>约 {readingMinutes} 分钟</span>
                <DownloadMarkdown title={post.title} html={post.html} />
              </div>
              {post.source_url && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-[var(--editor-line)] bg-[var(--editor-panel)]/60 px-3 py-2 text-xs text-[var(--editor-muted)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-[var(--stone-gray)]">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  <span>收藏自</span>
                  <a
                    href={post.source_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="min-h-11 min-w-11 inline-flex items-center text-[var(--editor-accent)] hover:underline underline-offset-2 break-all"
                  >
                    {post.source_url}
                  </a>
                </div>
              )}
            </header>

            <div
              id={contentContainerId}
              data-admin-edit-trigger
              className="rich-content"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
            <TwitterEmbedsEnhancer containerId={contentContainerId} html={renderedHtml} />

            {!post.password && <RelatedPosts slug={post.slug} />}
          </article>
        </FrontPostAdminBoundary>
      </main>

      <SiteFooter />
    </div>
  )
}

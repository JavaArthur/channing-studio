import { getPostBySlug, incrementViewCount, isPubliclyAccessiblePost } from '@/lib/db'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { verifyPassword } from '@/lib/password'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { FrontPostAdminBoundary } from '@/components/FrontPostAdminBoundary'
import { PasswordPrompt } from '@/components/PasswordPrompt'
import { DownloadMarkdown } from '@/components/DownloadMarkdown'
import { TwitterEmbedsEnhancer } from '@/components/TwitterEmbedsEnhancer'
import { getSiteHeaderData } from '@/lib/site'
import { getPublicContentCacheNamespace } from '@/lib/cache'
import { getSiteUrl } from '@/lib/site-config'
import { PUBLIC_PROFILE } from '@/lib/public-profile'
import { resolveRequestTheme } from '@/lib/server-appearance'
import { formatDate } from '@/lib/format-date'
import { stripLeadingTitleHeading } from '@/lib/post-render'
import { RelatedPosts } from '@/components/RelatedPosts'
import 'katex/dist/katex.min.css'

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

    const post = await getPostBySlug(
      env.DB,
      slug,
      getPublicContentCacheNamespace(env),
    ).catch(() => null)
    if (!post || !isPubliclyAccessiblePost(post)) return {}

    const imgMatch = post.html?.match(/<img[^>]+src="([^"]+)"/)
    const ogImage = post.cover_image || imgMatch?.[1] || `${baseUrl}/icon-512.png`

    if (post.password) {
      return {
        title: post.title,
        robots: { index: false },
      }
    }

    return {
      title: post.title,
      description: post.description,
      authors: [{ name: PUBLIC_PROFILE.alias }],
      alternates: {
        canonical: `${baseUrl}/${post.slug}`,
      },
      openGraph: {
        title: post.title,
        description: post.description,
        type: 'article',
        publishedTime: new Date(post.published_at * 1000).toISOString(),
        modifiedTime: new Date(post.updated_at * 1000).toISOString(),
        authors: [PUBLIC_PROFILE.alias],
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

  const post = await getPostBySlug(
    db,
    slug,
    getPublicContentCacheNamespace(env),
  ).catch(() => null)
  if (!post) notFound()
  if (!isPubliclyAccessiblePost(post)) notFound()

  const headerData = await getSiteHeaderData(db)
  const requestTheme = await resolveRequestTheme(headerData.defaultTheme)
  const activeCategorySlug =
    headerData.categories.find((category) => category.name === post.category)?.slug ??
    null

  let passwordError: string | undefined
  const needsPassword = Boolean(post.password)

  if (needsPassword) {
    if (!pwd) {
      return (
        <div className="public-article min-h-screen bg-[var(--background)] flex flex-col">
          <SiteHeader
            initialTheme={requestTheme}
            navLinks={headerData.navLinks}
            categories={headerData.categories}
            activeCategorySlug={activeCategorySlug}
            stickyOnMobile={false}
          />
          <main
            id="main-content"
            tabIndex={-1}
            className="page-main mx-auto w-full max-w-3xl px-4 sm:px-6 flex-1 py-8 sm:py-12"
          >
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
        <div className="public-article min-h-screen bg-[var(--background)] flex flex-col">
          <SiteHeader
            initialTheme={requestTheme}
            navLinks={headerData.navLinks}
            categories={headerData.categories}
            activeCategorySlug={activeCategorySlug}
            stickyOnMobile={false}
          />
          <main
            id="main-content"
            tabIndex={-1}
            className="page-main mx-auto w-full max-w-3xl px-4 sm:px-6 flex-1 py-8 sm:py-12"
          >
            <FrontPostAdminBoundary slug={post.slug}>
              <PasswordPrompt error={passwordError} />
            </FrontPostAdminBoundary>
          </main>
          <SiteFooter />
        </div>
      )
    }
  }

  void incrementViewCount(db, slug).catch(console.error)

  const textLength = post.content?.length || 0
  const readingMinutes = Math.max(1, Math.ceil(textLength / 400))
  const contentContainerId = `post-content-${post.slug}`
  const renderedHtml = stripLeadingTitleHeading(post.html, post.title)

  return (
    <div className="public-article min-h-screen bg-[var(--background)] flex flex-col">
      <SiteHeader
        initialTheme={requestTheme}
        navLinks={headerData.navLinks}
        categories={headerData.categories}
        activeCategorySlug={activeCategorySlug}
        stickyOnMobile={false}
      />

      <main
        id="main-content"
        tabIndex={-1}
        className="page-main article-main mx-auto w-full flex-1"
      >
        {!post.password &&
          (() => {
            const baseUrl = getSiteUrl()
            const imgMatch = post.html?.match(/<img[^>]+src="([^"]+)"/)
            const ogImage =
              post.cover_image || imgMatch?.[1] || `${baseUrl}/icon-512.png`
            const jsonLd = {
              '@context': 'https://schema.org',
              '@type': 'BlogPosting',
              headline: post.title,
              description: post.description || '',
              image: ogImage,
              author: { '@type': 'Person', name: PUBLIC_PROFILE.alias, url: baseUrl },
              publisher: {
                '@type': 'Organization',
                name: PUBLIC_PROFILE.brand,
                url: baseUrl,
                logo: { '@type': 'ImageObject', url: `${baseUrl}/icon-512.png` },
              },
              datePublished: new Date(post.published_at * 1000).toISOString(),
              dateModified: new Date(post.updated_at * 1000).toISOString(),
              mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': `${baseUrl}/${post.slug}`,
              },
              url: `${baseUrl}/${post.slug}`,
            }
            const breadcrumbLd = {
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: '首页', item: baseUrl },
                ...(post.category && activeCategorySlug
                  ? [
                      {
                        '@type': 'ListItem',
                        position: 2,
                        name: post.category,
                        item: `${baseUrl}/category/${activeCategorySlug}`,
                      },
                    ]
                  : []),
                {
                  '@type': 'ListItem',
                  position: post.category ? 3 : 2,
                  name: post.title,
                  item: `${baseUrl}/${post.slug}`,
                },
              ],
            }
            return (
              <>
                <script
                  type="application/ld+json"
                  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
                <script
                  type="application/ld+json"
                  dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
                />
              </>
            )
          })()}

        <FrontPostAdminBoundary slug={post.slug}>
          <article>
            <div className="article-monograph-bar">
              <Link href="/writing" className="article-back-link">
                <ArrowLeft size={14} aria-hidden="true" />
                返回文章归档
              </Link>
              <span>{`${PUBLIC_PROFILE.brand} // 技术长文`}</span>
            </div>

            <header className="article-header">
              <h1
                data-admin-edit-trigger
                className="font-serif font-medium article-display-title"
              >
                {post.title}
              </h1>

              <div className="article-meta-ledger">
                {post.category && (
                  <>
                    {activeCategorySlug ? (
                      <Link
                        href={`/category/${activeCategorySlug}`}
                        className="hit-area-44 article-category-chip"
                      >
                        {post.category}
                      </Link>
                    ) : (
                      <span className="article-category-chip">{post.category}</span>
                    )}
                    <span aria-hidden="true">/</span>
                  </>
                )}
                <time dateTime={new Date(post.published_at * 1000).toISOString()}>
                  {formatDate(post.published_at)}
                </time>
                <span aria-hidden="true">/</span>
                <span>约 {readingMinutes} 分钟</span>
                <span aria-hidden="true">/</span>
                <span>{post.view_count} 次阅读</span>
                <DownloadMarkdown title={post.title} html={post.html} />
              </div>

              {post.source_url && (
                <div className="article-provenance">
                  <span>收藏自</span>
                  <a
                    href={post.source_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="min-h-11 min-w-11 inline-flex items-center text-[var(--atelier-vermilion)] hover:underline underline-offset-4 break-all"
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
            <TwitterEmbedsEnhancer
              containerId={contentContainerId}
              html={renderedHtml}
            />

            <div className="article-endmark">
              <span>END OF ESSAY · {PUBLIC_PROFILE.brand}</span>
              <div className="article-endmark-links">
                <Link href="/writing">
                  <ArrowLeft size={14} aria-hidden="true" />
                  全部技术文章
                </Link>
                <Link href="/about">
                  关于作者
                  <ArrowUpRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </div>

            {!post.password && <RelatedPosts slug={post.slug} />}
          </article>
        </FrontPostAdminBoundary>
      </main>

      <SiteFooter />
    </div>
  )
}

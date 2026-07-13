import { NextRequest, NextResponse } from 'next/server'
import { getPostBySlug, isPubliclyAccessiblePost } from '@/lib/db'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getPublicContentCacheNamespace } from '@/lib/cache'
import { getRelatedPosts, limitRelatedPosts } from '@/lib/related-content'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    const env = await getAppCloudflareEnv()
    if (!env?.DB) {
      return NextResponse.json({ success: true, related: { strategy: 'fts', source: 'rules', results: [] } })
    }

    const post = await getPostBySlug(env.DB, slug, getPublicContentCacheNamespace(env)).catch(() => null)
    if (!post || !isPubliclyAccessiblePost(post) || post.password) {
      return NextResponse.json({ error: '文章不存在' }, { status: 404 })
    }

    const rawLimit = Number(req.nextUrl.searchParams.get('limit') || 3)
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 6) : 3
    const related = await getRelatedPosts(env.DB, env, post, limit)

    return NextResponse.json({
      success: true,
      related: {
        strategy: related.strategy,
        source: related.source,
        results: limitRelatedPosts(related.results, slug, limit).map((item) => ({
          slug: item.slug,
          title: item.title,
          description: item.description,
          category: item.category,
          published_at: item.published_at,
        })),
      },
    })
  } catch (error) {
    console.error('Related posts API error:', error)
    return NextResponse.json({ success: true, related: { strategy: 'fts', source: 'rules', results: [] } })
  }
}

import { clearWorkingCopy } from '@/lib/repositories/drafts'
import { deletePost, getPostBySlug, updatePost } from '@/lib/db'
import { isAdminAuthenticated, COOKIE_NAME } from '@/lib/admin-auth'
import { invalidatePublicContentCache } from '@/lib/cache'
import { buildAutoDescription, normalizePostSlug } from '@/lib/post-utils'
import { enqueueBackgroundJob } from '@/lib/background-jobs'
import { renderPostMarkdownToHtml } from '@/lib/post-render'
import { getRouteContextWithDb, jsonError, jsonOk, parseJsonBody } from '@/lib/server/route-helpers'
import type { NextRequest } from 'next/server'

async function checkAuth(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  return isAdminAuthenticated(token)
}

type Ctx = { params: Promise<{ slug: string }> }

// 获取单篇文章（编辑用）
export async function GET(req: NextRequest, { params }: Ctx) {
  if (!(await checkAuth(req))) {
    return jsonError('Unauthorized', 401)
  }

  const { slug } = await params
  const route = await getRouteContextWithDb('DB not configured')
  if (!route.ok) return route.response

  const post = await getPostBySlug(route.db, slug, undefined, { includeUnpublished: true })
  if (!post) return jsonError('文章不存在', 404)

  return jsonOk(post)
}

// 更新文章
export async function PUT(req: NextRequest, { params }: Ctx) {
  if (!(await checkAuth(req))) {
    return jsonError('Unauthorized', 401)
  }

  const { slug } = await params
  const route = await getRouteContextWithDb('DB not configured')
  if (!route.ok) return route.response
  const { env, db, ctx } = route

  const post = await getPostBySlug(db, slug, undefined, { includeUnpublished: true })
  if (!post) return jsonError('文章不存在', 404)

  try {
    const {
      expected_revision,
      expected_draft_revision,
      slug: nextSlugRaw,
      title,
      content,
      html,
      category,
      status,
      password,
      is_pinned,
      is_hidden,
      cover_image,
      tags,
      description,
    } = await parseJsonBody<{
      expected_draft_revision?: number
      expected_revision?: number
      slug?: string
      title?: string
      content?: string
      html?: string
      category?: string
      status?: 'draft' | 'published' | 'deleted'
      password?: string | null
      is_pinned?: number
      is_hidden?: number
      cover_image?: string | null
      tags?: string[]
      description?: string
    }>(req)
    const nextSlug = typeof nextSlugRaw === 'string' ? normalizePostSlug(nextSlugRaw) : ''
    const normalizedDescription = typeof description === 'string' && description.trim()
      ? description.trim()
      : buildAutoDescription(typeof content === 'string' ? content : '')
    const nextHtml = typeof html === 'string'
      ? html
      : (typeof content === 'string' ? await renderPostMarkdownToHtml(content) : undefined)

    if (expected_revision !== undefined && (!Number.isInteger(expected_revision) || expected_revision < 0)) return jsonError('无效版本', 400)
    if (expected_draft_revision !== undefined && (!Number.isInteger(expected_draft_revision) || expected_draft_revision < 0 || expected_revision === undefined)) return jsonError('无效工作稿版本', 400)
    const update = {
      slug: nextSlug || undefined,
      title,
      content,
      html: nextHtml,
      category,
      status,
      password,
      is_pinned,
      is_hidden,
      cover_image,
      tags,
      description: normalizedDescription,
    }
    if (expected_draft_revision !== undefined) await updatePost(db, post.id, update, expected_revision, expected_draft_revision)
    else if (expected_revision !== undefined) await updatePost(db, post.id, update, expected_revision)
    else await updatePost(db, post.id, update)
    if (expected_revision !== undefined && (html !== undefined || content !== undefined)) await clearWorkingCopy(db, post.id, expected_revision)

    // 清除 KV 缓存（失败不影响保存结果）
    try {
      await invalidatePublicContentCache(env)
    } catch (cacheErr) {
      console.warn('Cache invalidation failed:', cacheErr)
    }

    await enqueueBackgroundJob(
      env,
      {
        type: 'sync-post-related-index',
        postId: post.id,
      },
      {
        waitUntil: ctx?.waitUntil?.bind(ctx),
      },
    )

    return jsonOk({ success: true, slug: nextSlug || slug, revision: (post.revision ?? 0) + 1 })
  } catch (err) {
    if (err instanceof Error && err.message === 'REVISION_CONFLICT') return jsonError('文章已更新，请重新打开后继续。', 409)
    if (err instanceof Error && /UNIQUE constraint failed: posts\.slug/i.test(err.message)) {
      return jsonError('slug 已存在，请换一个', 409)
    }
    console.error('PUT /api/admin/posts/[slug] error:', err)
    return jsonError(err instanceof Error ? err.message : '保存失败', 500)
  }
}

// 删除文章
export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!(await checkAuth(req))) {
    return jsonError('Unauthorized', 401)
  }

  const { slug } = await params
  const route = await getRouteContextWithDb('DB not configured')
  if (!route.ok) return route.response
  const { env, db, ctx } = route

  try {
    const post = await getPostBySlug(db, slug, undefined, { includeUnpublished: true })
    if (!post) {
      return jsonError('文章不存在', 404)
    }

    await deletePost(db, slug)

    // 清除 KV 缓存（失败不影响删除结果）
    try {
      await invalidatePublicContentCache(env)
    } catch (cacheErr) {
      console.warn('Cache invalidation failed:', cacheErr)
    }

    await enqueueBackgroundJob(
      env,
      {
        type: 'delete-post-related-index',
        postId: post.id,
      },
      {
        waitUntil: ctx?.waitUntil?.bind(ctx),
      },
    )

    return jsonOk({ success: true })
  } catch (error) {
    console.error('Delete post failed:', error)
    return jsonOk(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除失败，请重试',
      },
      500,
    )
  }
}

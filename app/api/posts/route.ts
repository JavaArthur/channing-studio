import { createPost, updatePostBySlug } from '@/lib/db'
import { invalidatePublicContentCache } from '@/lib/cache'
import { enqueueBackgroundJob } from '@/lib/background-jobs'
import { nanoid } from 'nanoid'
import { buildAutoDescription, normalizePostSlug } from '@/lib/post-utils'
import { renderPostMarkdownToHtml } from '@/lib/post-render'
import {
  ensureAuthenticatedRequest,
  getRouteContextWithDb,
  jsonError,
  jsonOk,
  parseJsonBody,
} from '@/lib/server/route-helpers'
import type { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const route = await getRouteContextWithDb('数据库未配置')
    if (!route.ok) return route.response
    const { env, db, ctx } = route

    // 2. 统一认证：Cookie OR Bearer Token
    const authError = await ensureAuthenticatedRequest(req, db)
    if (authError) return authError

    const payload = await parseJsonBody<Record<string, unknown>>(req)
    const title = typeof payload.title === 'string' ? payload.title.trim() : ''
    const content = typeof payload.content === 'string' ? payload.content.trim() : ''
    const rawHtml = typeof payload.html === 'string' ? payload.html.trim() : ''
    const payloadCategory = typeof payload.category === 'string' ? payload.category.trim() : ''
    const customSlug = typeof payload.slug === 'string' ? normalizePostSlug(payload.slug) : ''
    const status = payload.status === 'draft' ? 'draft' : 'published'
    const password = typeof payload.password === 'string' && payload.password.trim() ? payload.password.trim() : null
    const is_hidden = payload.is_hidden === 1 ? 1 : 0
    const sourceUrl = typeof payload.source_url === 'string' && payload.source_url.trim()
      ? payload.source_url.trim()
      : null
    // 剪报：显式 kind='clipping' 或带了原文链接的外部收藏，归入剪报区，不进首页主线
    const kind: 'post' | 'clipping' =
      payload.kind === 'clipping' || sourceUrl ? 'clipping' : 'post'
    const description = typeof payload.description === 'string' && payload.description.trim()
      ? payload.description.trim()
      : buildAutoDescription(content)
    const tags = Array.isArray(payload.tags)
      ? (payload.tags as unknown[])
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 10)
      : []
    const coverImage = typeof payload.cover_image === 'string' && payload.cover_image.trim()
      ? payload.cover_image.trim()
      : null

    if (!title || !content) {
      return jsonError('标题和内容不能为空', 400)
    }

    // 2. 生成 slug（日期 + 随机）
    const date = new Date().toISOString().split('T')[0]
    const slug = customSlug || `${date}-${nanoid(6)}`

    // 3. 优先使用编辑器直接生成的 HTML，兼容旧版 Markdown 提交
    const htmlContent =
      rawHtml ||
      await renderPostMarkdownToHtml(content)

    // 4. 立即保存到 D1（不等 AI）
    const postId = await createPost(db, {
      slug,
      title,
      content,
      html: htmlContent,
      description,
      category: payloadCategory || '未分类',
      tags,
      status,
      password,
      is_hidden,
      cover_image: coverImage,
      kind,
      source_url: sourceUrl,
    })

    // 6. 清除缓存
    await invalidatePublicContentCache(env)



    await enqueueBackgroundJob(
      env,
      {
        type: 'sync-post-related-index',
        postId,
      },
      {
        waitUntil: ctx?.waitUntil?.bind(ctx),
      },
    )

    return jsonOk({
      success: true,
      slug,
      id: postId,
      category: payloadCategory || '未分类',
      tags,
      description,
      cover_image: coverImage,
    })
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed: posts\.slug/i.test(error.message)) {
      return jsonError('slug 已存在，请换一个', 409)
    }
    console.error('Save error:', error)
    return jsonError('保存失败', 500)
  }
}

// PATCH: 自动保存（只更新变化的字段）
export async function PATCH(req: NextRequest) {
  try {
    const route = await getRouteContextWithDb('数据库未配置')
    if (!route.ok) return route.response
    const { env, db } = route

    const authError = await ensureAuthenticatedRequest(req, db)
    if (authError) return authError

    const payload = await parseJsonBody<Record<string, unknown>>(req)
    const currentSlug = typeof payload.current_slug === 'string'
      ? payload.current_slug.trim()
      : (typeof payload.slug === 'string' ? payload.slug.trim() : '')
    const nextSlug = typeof payload.new_slug === 'string'
      ? normalizePostSlug(payload.new_slug)
      : ''

    if (!currentSlug) {
      return jsonError('slug 不能为空', 400)
    }

    // 构建更新对象（只包含提供的字段）
    const updates: Record<string, unknown> = {}
    if (nextSlug && nextSlug !== currentSlug) updates.slug = nextSlug
    if (payload.title !== undefined) updates.title = payload.title
    if (payload.content !== undefined) updates.content = payload.content
    if (payload.html !== undefined) updates.html = payload.html
    else if (typeof payload.content === 'string') {
      updates.html = await renderPostMarkdownToHtml(payload.content)
    }
    if (payload.description !== undefined) {
      const rawDescription = typeof payload.description === 'string' ? payload.description.trim() : ''
      const rawContent = typeof payload.content === 'string' ? payload.content : ''
      updates.description = rawDescription || buildAutoDescription(rawContent)
    }
    if (payload.category !== undefined) updates.category = payload.category
    if (payload.tags !== undefined) updates.tags = payload.tags
    if (payload.cover_image !== undefined) updates.cover_image = payload.cover_image
    if (payload.source_url !== undefined) {
      updates.source_url = typeof payload.source_url === 'string' && payload.source_url.trim()
        ? payload.source_url.trim()
        : null
    }
    if (payload.kind === 'post' || payload.kind === 'clipping') {
      updates.kind = payload.kind
    }
    if (payload.status === 'draft' || payload.status === 'published' || payload.status === 'deleted') {
      updates.status = payload.status
    }

    if (Object.keys(updates).length === 0) {
      return jsonOk({ success: true, slug: currentSlug })
    }

    await updatePostBySlug(db, currentSlug, updates)

    // 清除缓存
    await invalidatePublicContentCache(env)

    return jsonOk({ success: true, slug: nextSlug || currentSlug })
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed: posts\.slug/i.test(error.message)) {
      return jsonError('slug 已存在，请换一个', 409)
    }
    console.error('Auto-save error:', error)
    return jsonError('自动保存失败', 500)
  }
}

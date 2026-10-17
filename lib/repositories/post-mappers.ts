import type { Post, PostWithTags } from '@/lib/repositories/types'

export function parsePostTags(value: string | null): string[] {
  try {
    const parsed: unknown = value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : []
  } catch { return [] }
}

export function normalizePostStatus(post: Pick<Post, 'status' | 'deleted_at'>): Post['status'] {
  return post.deleted_at ? 'deleted' : (post.status || 'published')
}

export function mapPostWithTags(post: Post): PostWithTags {
  return {
    ...post,
    status: normalizePostStatus(post),
    tags: parsePostTags(post.tags),
  }
}

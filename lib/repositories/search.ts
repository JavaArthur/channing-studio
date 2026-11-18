import { mapPostWithTags } from '@/lib/repositories/post-mappers'
import type { Database } from '@/lib/repositories/schema'
import type { Post, PostWithTags } from '@/lib/repositories/types'

// 全文搜索（FTS5，回退 LIKE；超出 D1 模式长度时使用子串匹配）
export async function searchPosts(
  db: Database,
  query: string,
  limit = 20,
  includeDrafts = false,
  includeEncrypted = false,
  includeHidden = false,
  includeDeleted = false,
): Promise<PostWithTags[]> {
  let results: Post[]

  const conditions: string[] = []
  if (!includeDrafts) conditions.push("posts.status = 'published'")
  if (!includeEncrypted) conditions.push('posts.password IS NULL')
  if (!includeHidden) conditions.push('posts.is_hidden = 0')
  if (!includeDeleted) conditions.push('posts.deleted_at IS NULL')
  const whereClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''

  try {
    const ftsResult = await db
      .prepare(
        `SELECT posts.* FROM posts_fts
         JOIN posts ON posts.id = posts_fts.rowid
         WHERE posts_fts MATCH ?
         ${whereClause}
         ORDER BY rank
         LIMIT ?`,
      )
      .bind(query, limit)
      .all<Post>()
    results = ftsResult.results
  } catch {
    const pattern = `%${query}%`
    // D1 caps LIKE/GLOB patterns at 50 UTF-8 bytes, including the surrounding %.
    // Keep the whole query for longer text instead of truncating Chinese titles or tags.
    const useSubstring = new TextEncoder().encode(pattern).length > 50
    const match = useSubstring
      ? 'instr(lower(title), lower(?)) > 0 OR instr(lower(content), lower(?)) > 0'
      : 'title LIKE ? OR content LIKE ?'
    const searchValue = useSubstring ? query : pattern
    const likeResult = await db
      .prepare(
        `SELECT * FROM posts
         WHERE (${match})
         ${whereClause}
         ORDER BY published_at DESC
         LIMIT ?`,
      )
      .bind(searchValue, searchValue, limit)
      .all<Post>()
    results = likeResult.results
  }

  return results.map(mapPostWithTags)
}

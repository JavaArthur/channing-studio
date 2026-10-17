import type { Database } from './schema'
import type { Post } from './types'
import { mapPostWithTags } from './post-mappers'

export async function findPublicPostOptions(db: Database, query: string) {
  const { results } = await db
    .prepare(
      "SELECT slug,title FROM posts WHERE status='published' AND deleted_at IS NULL AND is_hidden=0 AND password IS NULL AND (kind='post' OR kind IS NULL) AND title LIKE ? ORDER BY published_at DESC LIMIT 30",
    )
    .bind(`%${query.slice(0, 200)}%`)
    .all<{ slug: string; title: string }>()
  return results
}

export async function getAdminPostPage(
  db: Database,
  input: { q?: string; category?: string; status?: string; page?: number },
) {
  const conditions: string[] = []
  const values: string[] = []
  if (input.q?.trim()) {
    conditions.push('(title LIKE ? OR description LIKE ? OR content LIKE ?)')
    values.push(...Array(3).fill(`%${input.q.trim().slice(0, 200)}%`))
  }
  if (input.category && input.category !== 'all') {
    conditions.push('category = ?')
    values.push(input.category)
  }
  const base = conditions.length ? conditions.join(' AND ') : '1=1'
  const live = 'deleted_at IS NULL'
  const filters: Record<string, string> = {
    published: `${live} AND status='published'`,
    draft: `${live} AND status='draft'`,
    deleted: 'deleted_at IS NOT NULL',
    encrypted: `${live} AND password IS NOT NULL`,
    unlisted: `${live} AND is_hidden=1`,
    pinned: `${live} AND is_pinned=1`,
  }
  const where = `${base} AND (${filters[input.status ?? ''] ?? '1=1'})`
  const [stats, count, categories] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS "all", ${Object.entries(filters)
          .map(
            ([key, condition]) =>
              `COALESCE(SUM(CASE WHEN ${condition} THEN 1 ELSE 0 END),0) AS ${key}`,
          )
          .join(', ')} FROM posts WHERE ${base}`,
      )
      .bind(...values)
      .first<{
        all: number
        published: number
        draft: number
        deleted: number
        encrypted: number
        unlisted: number
        pinned: number
      }>(),
    db
      .prepare(`SELECT COUNT(*) AS n FROM posts WHERE ${where}`)
      .bind(...values)
      .first<{ n: number }>(),
    db
      .prepare(
        "SELECT DISTINCT category FROM posts WHERE category IS NOT NULL AND category != '' ORDER BY category",
      )
      .all<{ category: string }>(),
  ])
  const total = count?.n ?? 0
  const totalPages = Math.max(1, Math.ceil(total / 30))
  const page = Math.min(totalPages, Math.max(1, Math.floor(input.page || 1)))
  const { results } = await db
    .prepare(
      `SELECT id,slug,title,description,category,tags,status,password,is_pinned,is_hidden,cover_image,kind,source_url,published_at,view_count,deleted_at FROM posts WHERE ${where} ORDER BY updated_at DESC,id DESC LIMIT 30 OFFSET ?`,
    )
    .bind(...values, (page - 1) * 30)
    .all<Post>()
  return {
    posts: results.map(mapPostWithTags),
    stats: stats!,
    total,
    page,
    totalPages,
    categories: categories.results.map((row) => row.category),
  }
}

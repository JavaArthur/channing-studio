import type { Database } from './schema'
import { isHttpUrl } from '@/lib/url'

export type BrainKind = 'inbox' | 'notes' | 'projects'
const tables = { inbox: 'inbox_items', notes: 'notes', projects: 'projects' } as const
export function isBrainKind(value: string): value is BrainKind {
  return value in tables && Object.hasOwn(tables, value)
}
export interface BrainItem {
  id: string
  title: string
  content?: string
  description?: string
  next_action?: string
  source_url?: string | null
  public_url?: string | null
  status?: string
  archived?: number
  published_payload?: string | null
  target_type?: string | null
  target_id?: string | null
  updated_at: number
}
export function validateBrainInput(kind: BrainKind, data: Record<string, unknown>) {
  const title = typeof data.title === 'string' ? data.title.trim() : ''
  if (!title || title.length > 200) throw new Error('标题需要 1–200 个字')
  const text = (key: string, max = 50000) => {
    if (data[key] === undefined) return ''
    if (typeof data[key] !== 'string' || data[key].length > max)
      throw new Error('内容过长或格式不正确')
    return data[key] as string
  }
  const sourceUrl = text('source_url', 2000).trim()
  if (sourceUrl && !isHttpUrl(sourceUrl)) throw new Error('来源链接必须使用 http 或 https')
  return {
    title,
    content: text('content'),
    description: text('description'),
    next_action: text('next_action', 2000),
    source_url: sourceUrl || null,
    status:
      kind === 'projects'
        ? ['active', 'paused', 'done', 'archived'].includes(String(data.status))
          ? String(data.status)
          : 'active'
        : 'inbox',
  }
}
export async function listBrainItems(
  db: Database,
  kind: BrainKind,
  q = '',
  archived = false,
  page = 1,
) {
  const table = tables[kind]
  const filter = kind === 'notes' ? 'archived = ?' : "status = 'archived'"
  const state = kind === 'notes' ? filter : archived ? filter : "status != 'archived'"
  const params: (string | number)[] = kind === 'notes' ? [archived ? 1 : 0] : []
  const where = `${state} AND title LIKE ?`
  params.push(`%${q.slice(0, 200)}%`)
  const [{ results }, count] = await Promise.all([
    db
      .prepare(
        `SELECT * FROM ${table} WHERE ${where} ORDER BY updated_at DESC, id LIMIT 30 OFFSET ?`,
      )
      .bind(...params, (page - 1) * 30)
      .all<BrainItem>(),
    db
      .prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`)
      .bind(...params)
      .first<{ n: number }>(),
  ])
  return { items: results, total: count?.n ?? 0 }
}
export async function saveBrainItem(
  db: Database,
  kind: BrainKind,
  input: Record<string, unknown>,
  id?: string,
) {
  const data = validateBrainInput(kind, input)
  const key = id ?? crypto.randomUUID()
  if (id) {
    const statement =
      kind === 'projects'
        ? db
            .prepare(
              "UPDATE projects SET title=?,description=?,next_action=?,status=?,updated_at=strftime('%s','now') WHERE id=?",
            )
            .bind(data.title, data.description, data.next_action, data.status, key)
        : db
            .prepare(
              `UPDATE ${tables[kind]} SET title=?,content=?,source_url=?,updated_at=strftime('%s','now') WHERE id=?`,
            )
            .bind(data.title, data.content, data.source_url, key)
    if (!(await statement.run()).meta.changes) throw new Error('内容不存在')
  } else if (kind === 'projects') {
    await db
      .prepare('INSERT INTO projects (id,title,description,next_action,status) VALUES (?,?,?,?,?)')
      .bind(key, data.title, data.description, data.next_action, data.status)
      .run()
  } else {
    await db
      .prepare(`INSERT INTO ${tables[kind]} (id,title,content,source_url) VALUES (?,?,?,?)`)
      .bind(key, data.title, data.content, data.source_url)
      .run()
  }
  return key
}
export async function archiveBrainItem(db: Database, kind: BrainKind, id: string, restore = false) {
  const state =
    kind === 'notes'
      ? `archived = ${restore ? 0 : 1}`
      : `status = '${restore ? (kind === 'projects' ? 'active' : 'inbox') : 'archived'}'`
  await db
    .prepare(`UPDATE ${tables[kind]} SET ${state},updated_at=strftime('%s','now') WHERE id=?`)
    .bind(id)
    .run()
}
export async function convertInboxItem(db: Database, id: string, target: 'note' | 'post') {
  const targetId = `inbox-${id}`
  const source = await db
    .prepare('SELECT * FROM inbox_items WHERE id=?')
    .bind(id)
    .first<BrainItem>()
  if (!source) throw new Error('内容不存在')
  if (source.target_id) return { kind: source.target_type, id: source.target_id }
  if (source.status !== 'inbox') throw new Error('请先恢复到收件箱再整理')
  const insert =
    target === 'note'
      ? db
          .prepare(
            `INSERT INTO notes (id,title,content,source_url) SELECT ?,title,content,source_url FROM inbox_items WHERE id=? AND target_id IS NULL AND status='inbox'`,
          )
          .bind(targetId, id)
      : db
          .prepare(
            `INSERT INTO posts (slug,title,content,html,description,status,kind,source_url) SELECT ?,title,content,'','','draft','post',source_url FROM inbox_items WHERE id=? AND target_id IS NULL AND status='inbox'`,
          )
          .bind(targetId, id)
  // The source becomes organized only in the same transaction as the destination insert.
  await db.batch([
    insert,
    db
      .prepare(
        "UPDATE inbox_items SET status='organized',target_type=?,target_id=?,updated_at=strftime('%s','now') WHERE id=? AND target_id IS NULL AND status='inbox'",
      )
      .bind(target, targetId, id),
  ])
  const result = await db
    .prepare('SELECT target_type,target_id FROM inbox_items WHERE id=?')
    .bind(id)
    .first<BrainItem>()
  if (!result?.target_id) throw new Error('整理未完成，请刷新后重试')
  return { kind: result.target_type, id: result.target_id }
}
export async function draftFromNote(db: Database, id: string) {
  const slug = `note-${id}`
  await db
    .prepare(
      `INSERT INTO posts(slug,title,content,html,description,status,kind,source_url)
    SELECT ?,title,content,'','','draft','post',source_url FROM notes WHERE id=? AND archived=0
    ON CONFLICT(slug) DO NOTHING`,
    )
    .bind(slug, id)
    .run()
  const post = await db
    .prepare('SELECT slug,deleted_at FROM posts WHERE slug=?')
    .bind(slug)
    .first<{ slug: string; deleted_at: number | null }>()
  if (!post) throw new Error('笔记不存在或已归档')
  if (post.deleted_at) throw new Error('对应文章在回收站，请先恢复文章')
  return { kind: 'post', id: post.slug }
}
export async function publishProject(db: Database, id: string, input: Record<string, unknown>) {
  if (input.publish === false) {
    await db.prepare('UPDATE projects SET published_payload=NULL WHERE id=?').bind(id).run()
    return
  }
  const title = typeof input.title === 'string' ? input.title.trim() : ''
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  const href = typeof input.href === 'string' ? input.href.trim() : ''
  if (!title || title.length > 200 || !description || description.length > 2000 || !isHttpUrl(href))
    throw new Error('请填写公开标题、摘要和 http/https 项目链接')
  const payload = { id, title, description, href, visible: true, tags: [] }
  const result = await db
    .prepare('UPDATE projects SET published_payload=?,public_url=? WHERE id=?')
    .bind(JSON.stringify(payload), href, id)
    .run()
  if (!result.meta.changes) throw new Error('项目不存在')
}
export async function getPublishedProjects(db: Database) {
  const { results } = await db
    .prepare(
      'SELECT published_payload FROM projects WHERE published_payload IS NOT NULL ORDER BY updated_at DESC LIMIT 30',
    )
    .all<{ published_payload: string }>()
  return results.flatMap((row) => {
    try {
      return [
        JSON.parse(row.published_payload) as {
          id: string
          title: string
          description: string
          href: string
          visible: boolean
          tags: string[]
        },
      ]
    } catch {
      return []
    }
  })
}
export async function searchBrain(db: Database, query: string) {
  if (!query.trim()) return []
  const term = `%${query.trim().slice(0, 200)}%`
  const sources = [
    {
      table: 'notes',
      title: 'title',
      text: 'content',
      kind: '笔记',
      path: '/admin/notes',
      filter: '1=1',
      id: 'id',
    },
    {
      table: 'inbox_items',
      title: 'title',
      text: 'content',
      kind: '收件箱',
      path: '/admin/inbox',
      filter: '1=1',
      id: 'id',
    },
    {
      table: 'projects',
      title: 'title',
      text: 'description',
      kind: '项目',
      path: '/admin/projects',
      filter: '1=1',
      id: 'id',
    },
    {
      table: 'posts',
      title: 'title',
      text: 'content',
      kind: '文章',
      path: '/editor',
      filter: 'deleted_at IS NULL',
      id: 'slug',
    },
    {
      table: 'tools',
      title: 'name',
      text: 'description',
      kind: '工具',
      path: '/admin/tools',
      filter: '1=1',
      id: 'id',
    },
    {
      table: 'prompts',
      title: 'title',
      text: 'prompt',
      kind: '提示词',
      path: '/admin/prompts',
      filter: '1=1',
      id: 'id',
    },
    {
      table: 'knowledge_artifacts',
      title: 'title',
      text: 'summary',
      kind: '知识成果',
      path: '/admin/connections',
      filter: '1=1',
      id: 'artifact_key',
    },
  ]
  // Separate bounded queries work within D1's compound-query limits.
  const groups = await Promise.all(
    sources.map(async (source) => {
      const { results } = await db
        .prepare(
          `SELECT ${source.id} AS id,${source.title} AS title,updated_at FROM ${source.table} WHERE ${source.filter} AND (${source.title} LIKE ? OR ${source.text} LIKE ?) ORDER BY updated_at DESC LIMIT 60`,
        )
        .bind(term, term)
        .all<{ id: string | number; title: string; updated_at: number }>()
      return results.map((row) => ({
        title: row.title,
        kind: source.kind,
        updated_at: row.updated_at,
        href:
          source.kind === '文章'
            ? `/editor?edit=${encodeURIComponent(String(row.id))}`
            : `${source.path}?q=${encodeURIComponent(row.title)}#${encodeURIComponent(String(row.id))}`,
      }))
    }),
  )
  return groups
    .flat()
    .sort((a, b) => b.updated_at - a.updated_at)
    .slice(0, 60)
}
export async function getBrainOverview(db: Database) {
  const [counts, drafts, projects, recent] = await Promise.all([
    db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM inbox_items WHERE status='inbox') AS inbox,
      (SELECT COUNT(*) FROM posts WHERE status='draft' AND deleted_at IS NULL) AS drafts,
      (SELECT COUNT(*) FROM projects WHERE status='active') AS projects,
      (SELECT COUNT(*) FROM notes WHERE archived=0) AS notes`,
      )
      .first<{ inbox: number; drafts: number; projects: number; notes: number }>(),
    db
      .prepare(
        "SELECT slug,title,updated_at FROM posts WHERE deleted_at IS NULL AND (status='draft' OR id IN (SELECT post_id FROM post_working_copies)) ORDER BY updated_at DESC LIMIT 5",
      )
      .all<{ slug: string; title: string; updated_at: number }>(),
    db
      .prepare(
        "SELECT id,title,next_action FROM projects WHERE status='active' ORDER BY updated_at DESC LIMIT 4",
      )
      .all<{ id: string; title: string; next_action: string }>(),
    db
      .prepare('SELECT id,title,status FROM inbox_items ORDER BY updated_at DESC LIMIT 4')
      .all<{ id: string; title: string; status: string }>(),
  ])
  return { counts, drafts: drafts.results, projects: projects.results, recent: recent.results }
}

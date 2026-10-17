import type { Database } from './schema'

const targets = {
  note: { table: 'notes', title: 'title', filter: 'archived=0', path: '/admin/notes' },
  post: { table: 'posts', title: 'title', filter: 'deleted_at IS NULL', path: '/admin/posts' },
  tool: { table: 'tools', title: 'name', filter: '1=1', path: '/admin/tools' },
  prompt: { table: 'prompts', title: 'title', filter: '1=1', path: '/admin/prompts' },
} as const
export type ProjectLinkKind = keyof typeof targets
export interface ProjectLink {
  kind: ProjectLinkKind
  id: string
  title: string
  href: string
}
export function isProjectLinkKind(value: string): value is ProjectLinkKind {
  return Object.hasOwn(targets, value)
}
export async function setProjectLink(
  db: Database,
  project: string,
  kind: ProjectLinkKind,
  id: string,
  remove = false,
) {
  if (remove) {
    await db
      .prepare('DELETE FROM project_links WHERE project_id=? AND kind=? AND target_id=?')
      .bind(project, kind, id)
      .run()
    return
  }
  const target = targets[kind]
  const valid = await db
    .prepare(
      `SELECT id FROM ${target.table} WHERE id=? AND ${target.filter} AND EXISTS (SELECT 1 FROM projects WHERE id=?)`,
    )
    .bind(id, project)
    .first()
  if (!valid) throw new Error('项目或关联内容不存在，或内容已归档')
  await db
    .prepare('INSERT OR IGNORE INTO project_links(project_id,kind,target_id) VALUES (?,?,?)')
    .bind(project, kind, id)
    .run()
}
export async function getProjectLinks(
  db: Database,
  project: string,
  query?: string,
): Promise<ProjectLink[]> {
  const search = query !== undefined
  const statements = Object.entries(targets).map(([kind, target]) => {
    const where = search
      ? `${target.filter} AND ${target.title} LIKE ?`
      : 'id IN (SELECT target_id FROM project_links WHERE project_id=? AND kind=?)'
    return db
      .prepare(
        `SELECT CAST(id AS TEXT) AS id,${target.title} AS title,'${kind}' AS kind FROM ${target.table} WHERE ${where} ORDER BY updated_at DESC LIMIT 20`,
      )
      .bind(...(search ? [`%${query?.slice(0, 100) ?? ''}%`] : [project, kind]))
      .all<Omit<ProjectLink, 'href'>>()
  })
  const rows = await Promise.all(statements)
  return rows
    .flatMap((row) => row.results)
    .map((row) => ({
      ...row,
      href:
        targets[row.kind].path +
        `?q=${encodeURIComponent(row.title)}#${encodeURIComponent(row.id)}`,
    }))
}

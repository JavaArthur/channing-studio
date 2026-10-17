import type { Database } from './schema'

export interface WorkingCopy {
  post_id: number
  payload: string
  revision: number
  base_revision: number
  updated_at: number
}
export class DraftConflict extends Error {
  constructor() {
    super('内容已被另一个窗口修改，请重新打开文章后继续。')
  }
}
export async function getWorkingCopy(db: Database, postId: number): Promise<WorkingCopy | null> {
  return db
    .prepare('SELECT * FROM post_working_copies WHERE post_id = ?')
    .bind(postId)
    .first<WorkingCopy>()
}
export async function saveWorkingCopy(
  db: Database,
  slug: string,
  payload: Record<string, unknown>,
  baseRevision: number,
  revision: number,
) {
  const result = await db
    .prepare(
      `
    INSERT INTO post_working_copies (post_id,payload,revision,base_revision,updated_at)
    SELECT id,?,1,revision,strftime('%s','now') FROM posts WHERE slug = ? AND revision = ? AND deleted_at IS NULL
      AND (? = 0 OR EXISTS (SELECT 1 FROM post_working_copies WHERE post_id=posts.id))
    ON CONFLICT(post_id) DO UPDATE SET payload=excluded.payload, revision=post_working_copies.revision+1,
      base_revision=excluded.base_revision, updated_at=excluded.updated_at
    WHERE post_working_copies.revision = ?
  `,
    )
    .bind(JSON.stringify(payload), slug, baseRevision, revision, revision)
    .run()
  if (!result.meta.changes) throw new DraftConflict()
  return { revision: revision + 1, baseRevision }
}
export async function clearWorkingCopy(db: Database, postId: number, baseRevision: number) {
  await db
    .prepare('DELETE FROM post_working_copies WHERE post_id = ? AND base_revision <= ?')
    .bind(postId, baseRevision)
    .run()
}

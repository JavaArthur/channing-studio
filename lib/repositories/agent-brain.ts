import { BrainApiError, type listQuery } from '@/lib/agent-brain/validation'
import type { BrainKind } from './brain'
import type { Database } from './schema'

const tables = { inbox: 'inbox_items', notes: 'notes', projects: 'projects' } as const
const common = 'id,title,revision,created_at,updated_at'
const columns = {
  inbox: `${common},content,source_url,status,target_type,target_id`,
  notes: `${common},content,source_url,archived`,
  projects: `${common},description,next_action,status`,
}
export interface AgentBrainItem {
  id: string; title: string; revision: number; created_at: number; updated_at: number
  content?: string; source_url?: string | null; archived?: number
  description?: string; next_action?: string; status?: string
  target_type?: string | null; target_id?: string | null
}
type Fields = Record<string, string | number | null>
export async function getAgentBrainItem(db: Database, kind: BrainKind, id: string) {
  const item = await db.prepare(`SELECT ${columns[kind]} FROM ${tables[kind]} WHERE id=?`)
    .bind(id).first<AgentBrainItem>()
  if (!item) throw new BrainApiError(404, 'Item not found')
  return item
}
function checkRevision(item: AgentBrainItem, revision: number) {
  if (item.revision !== revision) throw new BrainApiError(412, 'Revision changed; GET and reconcile before retrying')
}
export async function listAgentBrainItems(db: Database, kind: BrainKind, query: ReturnType<typeof listQuery>) {
  const state = kind === 'notes' ? 'archived=1' : "status='archived'"
  const filter = query.archived === 'all' ? '1=1' : query.archived === 'only' ? state : `NOT (${state})`
  const text = kind === 'projects' ? 'description' : 'content'
  const term = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`
  const where = `${filter} AND (title LIKE ? ESCAPE '\\' OR ${text} LIKE ? ESCAPE '\\'${kind === 'projects' ? " OR next_action LIKE ? ESCAPE '\\'" : ''})`
  const values = kind === 'projects' ? [term, term, term] : [term, term]
  const summary = `${common},substr(${text},1,200) AS preview,${kind === 'notes' ? 'archived' : 'status'}`
  // One D1 transaction gives the count and page the same database snapshot.
  const result = await db.batch([
    db.prepare(`SELECT ${summary} FROM ${tables[kind]} WHERE ${where} ORDER BY updated_at DESC,id LIMIT ? OFFSET ?`)
      .bind(...values, query.limit, (query.page - 1) * query.limit),
    db.prepare(`SELECT COUNT(*) AS total FROM ${tables[kind]} WHERE ${where}`).bind(...values),
  ]) as Array<{ results?: Array<Record<string, unknown>> }>
  const total = Number(result[1].results?.[0]?.total ?? 0)
  return { items: result[0].results ?? [], total, page: query.page, limit: query.limit, has_more: query.page * query.limit < total }
}
async function hash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
    .map(byte => byte.toString(16).padStart(2, '0')).join('')
}
export async function createAgentBrainItem(db: Database, kind: BrainKind, key: string, fields: Fields) {
  const keyHash = await hash(`${kind}:${key}`)
  const id = `agent-${keyHash}`
  const keys = kind === 'projects' ? ['title', 'description', 'next_action', 'status'] : ['title', 'content', 'source_url']
  const requestHash = await hash(JSON.stringify(keys.map(k => fields[k])))
  const results = await db.batch([
    db.prepare(`INSERT INTO ${tables[kind]} (id,${keys.join(',')}) SELECT ${['?', ...keys.map(() => '?')].join(',')}
      WHERE NOT EXISTS (SELECT 1 FROM agent_brain_creates WHERE key_hash=?)`)
      .bind(id, ...keys.map(k => fields[k]), keyHash),
    ...(kind === 'projects' ? [] : [db.prepare("UPDATE library_metadata SET submitted_by='agent' WHERE kind=? AND item_id=? AND NOT EXISTS (SELECT 1 FROM agent_brain_creates WHERE key_hash=?)").bind(kind === 'notes' ? 'note' : 'inbox', id, keyHash)]),
    db.prepare('INSERT OR IGNORE INTO agent_brain_creates(key_hash,kind,request_hash,item_id) VALUES (?,?,?,?)')
      .bind(keyHash, kind, requestHash, id),
  ])
  const receipt = await db.prepare('SELECT request_hash FROM agent_brain_creates WHERE key_hash=?')
    .bind(keyHash).first<{ request_hash: string }>()
  if (receipt?.request_hash !== requestHash) throw new BrainApiError(409, 'Idempotency-Key was already used with a different body')
  return { item: await getAgentBrainItem(db, kind, id), replayed: results[0].meta?.changes === 0 }
}
export async function patchAgentBrainItem(db: Database, kind: BrainKind, id: string, revision: number, fields: Fields) {
  checkRevision(await getAgentBrainItem(db, kind, id), revision)
  const allowed = kind === 'projects' ? ['title','description','next_action','status'] : ['title','content','source_url','archived']
  const values: Array<string | number | null> = []; const assignments: string[] = []
  for (const key of allowed) {
    if (!(key in fields)) continue
    if (kind === 'inbox' && key === 'archived') {
      assignments.push(fields.archived ? "status='archived'" : "status=CASE WHEN target_id IS NULL THEN 'inbox' ELSE 'organized' END")
    } else { assignments.push(`${key}=?`); values.push(fields[key]) }
  }
  if (!assignments.length) throw new BrainApiError(400, 'No writable fields')
  const result = await db.prepare(`UPDATE ${tables[kind]} SET ${assignments.join(',')},updated_at=strftime('%s','now') WHERE id=? AND revision=?`)
    .bind(...values, id, revision).run()
  if (!result.meta.changes) throw new BrainApiError(412, 'Revision changed; GET and reconcile before retrying')
  return getAgentBrainItem(db, kind, id)
}
export async function convertAgentInbox(db: Database, id: string, revision: number) {
  const source = await getAgentBrainItem(db, 'inbox', id)
  checkRevision(source, revision)
  if (source.status === 'archived') throw new BrainApiError(409, 'Restore the inbox item first')
  if (source.target_id) {
    if (source.target_type !== 'note') throw new BrainApiError(409, 'Inbox item was already converted to another resource')
    return { item: source, note: await getAgentBrainItem(db, 'notes', source.target_id), created: false }
  }
  const target = `inbox-${id}`
  const result = await db.batch([
    db.prepare(`INSERT INTO notes(id,title,content,source_url)
      SELECT ?,title,content,source_url FROM inbox_items WHERE id=? AND revision=? AND status='inbox' AND target_id IS NULL`)
      .bind(target, id, revision),
    db.prepare(`UPDATE inbox_items SET status='organized',target_type='note',target_id=?,updated_at=strftime('%s','now')
      WHERE id=? AND revision=? AND status='inbox' AND target_id IS NULL`).bind(target, id, revision),
  ])
  if (!result[1].meta?.changes) throw new BrainApiError(412, 'Revision changed; GET and reconcile before retrying')
  return { item: await getAgentBrainItem(db, 'inbox', id), note: await getAgentBrainItem(db, 'notes', target), created: true }
}
export async function listAgentProjectNotes(db: Database, id: string, query: ReturnType<typeof listQuery>) {
  const project = await getAgentBrainItem(db, 'projects', id)
  const filter = query.archived === 'all' ? '1=1' : query.archived === 'only' ? 'n.archived=1' : 'n.archived=0'
  const term = `%${query.q.replace(/[\\%_]/g, '\\$&')}%`
  const where = `l.project_id=? AND l.kind='note' AND ${filter} AND (n.title LIKE ? ESCAPE '\\' OR n.content LIKE ? ESCAPE '\\')`
  const { results } = await db.prepare(`SELECT n.id,n.title,n.revision,n.archived,n.created_at,n.updated_at,substr(n.content,1,200) AS preview
    FROM notes n JOIN project_links l ON l.target_id=n.id WHERE ${where} ORDER BY n.updated_at DESC,n.id LIMIT ? OFFSET ?`)
    .bind(id, term, term, query.limit, (query.page - 1) * query.limit).all()
  const count = await db.prepare(`SELECT count(*) AS total FROM notes n JOIN project_links l ON l.target_id=n.id WHERE ${where}`)
    .bind(id, term, term).first<{ total: number }>()
  const total = count?.total ?? 0
  return { project_revision: project.revision, items: results, total, page: query.page, limit: query.limit, has_more: query.page * query.limit < total }
}
export async function linkAgentProjectNote(db: Database, id: string, note: string, revision: number, remove = false) {
  checkRevision(await getAgentBrainItem(db, 'projects', id), revision)
  if (!remove) {
    const target = await getAgentBrainItem(db, 'notes', note)
    if (target.archived) throw new BrainApiError(409, 'Cannot link an archived note')
  }
  const statement = remove
    ? db.prepare(`DELETE FROM project_links WHERE project_id=? AND kind='note' AND target_id=?
        AND EXISTS(SELECT 1 FROM projects WHERE id=? AND revision=?)`).bind(id, note, id, revision)
    : db.prepare(`INSERT OR IGNORE INTO project_links(project_id,kind,target_id)
        SELECT id,'note',? FROM projects WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM notes WHERE id=? AND archived=0)`)
      .bind(note, id, revision, note)
  const result = await statement.run()
  const project = await getAgentBrainItem(db, 'projects', id)
  if (!result.meta.changes) {
    checkRevision(project, revision)
    if (!remove && (await getAgentBrainItem(db, 'notes', note)).archived)
      throw new BrainApiError(409, 'Cannot link an archived note')
  }
  return project
}

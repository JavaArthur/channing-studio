import { BrainApiError } from '@/lib/agent-brain/validation'
import { getAgentBrainItem } from './agent-brain'
import type { Database } from './schema'

export interface OrganizeInput {
  request_key: string
  inbox_id: string
  project_id: string
  inbox_revision: number
  project_revision: number
}
interface Receipt {
  request_hash: string
  inbox_id: string
  note_id: string
  project_id: string
  created_note: number
  added_link: number
}
async function hash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))))
    .map(byte => byte.toString(16).padStart(2, '0')).join('')
}
async function readReceipt(db: Database, key: string) {
  return db.prepare('SELECT request_hash,inbox_id,note_id,project_id,created_note,added_link FROM agent_brain_workflows WHERE key_hash=?')
    .bind(key).first<Receipt>()
}
async function result(db: Database, receipt: Receipt, replayed: boolean) {
  const [inbox, note, project, link] = await Promise.all([
    getAgentBrainItem(db, 'inbox', receipt.inbox_id),
    getAgentBrainItem(db, 'notes', receipt.note_id),
    getAgentBrainItem(db, 'projects', receipt.project_id),
    db.prepare("SELECT 1 AS found FROM project_links WHERE project_id=? AND kind='note' AND target_id=?")
      .bind(receipt.project_id, receipt.note_id).first(),
  ])
  // Return current records, not stale snapshots; a replay must never undo later edits/unlinks.
  return { replayed, created_note: !!receipt.created_note, added_link: !!receipt.added_link,
    currently_linked: !!link, inbox, note, project }
}

/** Convert and attach in one D1 batch transaction. Every write is gated by this attempt's receipt. */
export async function organizeInboxIntoProject(db: Database, input: OrganizeInput) {
  const key = await hash(`organize-inbox:${input.request_key}`)
  const requestHash = await hash(JSON.stringify([input.inbox_id, input.project_id, input.inbox_revision, input.project_revision]))
  const previous = await readReceipt(db, key)
  if (previous) {
    if (previous.request_hash !== requestHash) throw new BrainApiError(409, 'request_key was already used with different arguments')
    return result(db, previous, true)
  }
  const source = await getAgentBrainItem(db, 'inbox', input.inbox_id)
  const project = await getAgentBrainItem(db, 'projects', input.project_id)
  if (source.revision !== input.inbox_revision || project.revision !== input.project_revision)
    throw new BrainApiError(412, 'Revision changed; read both items and reconcile before using a new request_key')
  if (source.status === 'archived' || project.status === 'archived')
    throw new BrainApiError(409, 'Restore archived inbox/project before organizing')
  if (source.target_id && source.target_type !== 'note')
    throw new BrainApiError(409, 'Inbox was converted to another resource')
  const create = !source.target_id
  const noteId = source.target_id || `inbox-${input.inbox_id}`
  if (!create && (await getAgentBrainItem(db, 'notes', noteId)).archived)
    throw new BrainApiError(409, 'Restore the existing note before linking')
  const execution = crypto.randomUUID()
  const receiptGuard = 'EXISTS(SELECT 1 FROM agent_brain_workflows WHERE key_hash=? AND execution_id=?)'
  const statements = [
    // Version and state checks happen inside the transaction, including concurrent admin changes.
    db.prepare(`INSERT OR IGNORE INTO agent_brain_workflows
      (key_hash,request_hash,execution_id,inbox_id,note_id,project_id,created_note,added_link)
      SELECT ?,?,?,i.id,?,p.id,?,NOT EXISTS(SELECT 1 FROM project_links WHERE project_id=p.id AND kind='note' AND target_id=?)
      FROM inbox_items i, projects p
      WHERE i.id=? AND i.revision=? AND p.id=? AND p.revision=? AND p.status<>'archived'
      AND ((?=1 AND i.status='inbox' AND i.target_id IS NULL)
        OR (?=0 AND i.status='organized' AND i.target_type='note' AND i.target_id=?
          AND EXISTS(SELECT 1 FROM notes WHERE id=? AND archived=0)))`)
      .bind(key, requestHash, execution, noteId, create ? 1 : 0, noteId,
        input.inbox_id, input.inbox_revision, input.project_id, input.project_revision,
        create ? 1 : 0, create ? 1 : 0, noteId, noteId),
  ]
  if (create) {
    statements.push(
      db.prepare(`INSERT INTO notes(id,title,content,source_url)
        SELECT ?,title,content,source_url FROM inbox_items WHERE id=? AND ${receiptGuard}`)
        .bind(noteId, input.inbox_id, key, execution),
      db.prepare(`UPDATE inbox_items SET status='organized',target_type='note',target_id=?,updated_at=strftime('%s','now')
        WHERE id=? AND ${receiptGuard}`).bind(noteId, input.inbox_id, key, execution),
    )
  }
  statements.push(db.prepare(`INSERT OR IGNORE INTO project_links(project_id,kind,target_id)
    SELECT ?,'note',? WHERE ${receiptGuard}`).bind(input.project_id, noteId, key, execution))
  const results = await db.batch(statements)
  const receipt = await readReceipt(db, key)
  if (!receipt) throw new BrainApiError(412, 'Revision or state changed; read both items and reconcile before retrying')
  if (receipt.request_hash !== requestHash) throw new BrainApiError(409, 'request_key was already used with different arguments')
  return result(db, receipt, results[0].meta?.changes === 0)
}

export async function checkMcpWorkspace(db: Database) {
  await db.prepare('SELECT key_hash FROM agent_brain_workflows LIMIT 0').all()
}

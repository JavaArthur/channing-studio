import type { Database } from './schema'
import { BrainApiError } from '@/lib/agent-brain/validation'
import { getLibraryItem, listCollections } from './library'
import type { LibraryKind, LibraryQuery } from '@/lib/library/types'
export async function getLibraryUsage(db: Database) {
  const [collections, searches] = await Promise.all([
    listCollections(db),
    db
      .prepare(
        'SELECT query_json FROM admin_recent_searches ORDER BY used_at DESC,query_key LIMIT 20',
      )
      .all<{ query_json: string }>(),
  ])
  return {
    collections,
    searches: searches.results.map((row) => JSON.parse(row.query_json) as LibraryQuery),
  }
}
export async function recordLibraryRead(db: Database, kind: LibraryKind, id: string) {
  const item = await getLibraryItem(db, kind, id)
  if (item.archived) return
  await db.batch([
    db
      .prepare(
        'INSERT INTO admin_recent_items(kind,item_id,viewed_at) VALUES (?,?,?) ON CONFLICT(kind,item_id) DO UPDATE SET viewed_at=excluded.viewed_at',
      )
      .bind(kind, id, Date.now()),
    db.prepare(
      'DELETE FROM admin_recent_items WHERE rowid NOT IN (SELECT rowid FROM admin_recent_items ORDER BY viewed_at DESC,rowid DESC LIMIT 100)',
    ),
  ])
}
export async function recordLibrarySearch(db: Database, query: LibraryQuery) {
  if (!query.q?.trim()) return
  const data = Object.fromEntries(
    Object.entries(query)
      .filter(
        ([key, value]) =>
          [
            'q',
            'kind',
            'collection',
            'topic',
            'favorite',
            'archived',
            'decisions',
            'recent',
          ].includes(key) &&
          value !== undefined &&
          value !== false,
      )
      .sort(([a], [b]) => a.localeCompare(b)),
  )
  data.q = query.q.trim()
  const key = JSON.stringify({ ...data, q: query.q.trim().toLowerCase() })
  await db.batch([
    db
      .prepare(
        'INSERT INTO admin_recent_searches(query_key,query_json,used_at) VALUES (?,?,?) ON CONFLICT(query_key) DO UPDATE SET query_json=excluded.query_json,used_at=excluded.used_at',
      )
      .bind(key, JSON.stringify(data), Date.now()),
    db.prepare(
      'DELETE FROM admin_recent_searches WHERE query_key NOT IN (SELECT query_key FROM admin_recent_searches ORDER BY used_at DESC,rowid DESC LIMIT 20)',
    ),
  ])
}
export async function clearLibraryHistory(db: Database, history: 'reads' | 'searches') {
  await db
    .prepare(`DELETE FROM ${history === 'reads' ? 'admin_recent_items' : 'admin_recent_searches'}`)
    .run()
}
export async function setCollectionPreference(
  db: Database,
  id: string,
  pinned: boolean,
  move?: 'up' | 'down',
) {
  const active = (await listCollections(db)).find((c) => c.id === id)
  if (!active) throw new BrainApiError(404, '资料集不存在或已归档')
  if (move) {
    const list = (await listCollections(db)).filter((c) => c.pinned)
    const i = list.findIndex((c) => c.id === id),
      j = i + (move === 'up' ? -1 : 1)
    if (i < 0 || j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    await db.batch(
      list.map((c, index) =>
        db
          .prepare(
            'INSERT INTO admin_collection_preferences(collection_id,pinned,sort_order) VALUES (?,1,?) ON CONFLICT(collection_id) DO UPDATE SET sort_order=excluded.sort_order',
          )
          .bind(c.id, index),
      ),
    )
  } else
    await db
      .prepare(
        'INSERT INTO admin_collection_preferences(collection_id,pinned,sort_order) VALUES (?,?,?) ON CONFLICT(collection_id) DO UPDATE SET pinned=excluded.pinned',
      )
      .bind(id, Number(pinned), Date.now())
      .run()
}
export async function pinCollectionItem(
  db: Database,
  collection: string,
  kind: LibraryKind,
  id: string,
  pinned: boolean,
) {
  const exists = await db
    .prepare(
      "SELECT 1 FROM library_members l JOIN projects p ON p.id=l.collection_id WHERE l.collection_id=? AND l.kind=? AND l.item_id=? AND p.status!='archived'",
    )
    .bind(collection, kind, id)
    .first()
  if (!exists) throw new BrainApiError(404, '资料不在此资料集中')
  await db
    .prepare(
      'INSERT INTO library_member_preferences(collection_id,kind,item_id,pinned) VALUES (?,?,?,?) ON CONFLICT(collection_id,kind,item_id) DO UPDATE SET pinned=excluded.pinned',
    )
    .bind(collection, kind, id, Number(pinned))
    .run()
}

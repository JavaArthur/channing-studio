import type { Database } from './schema'
import { BrainApiError } from '@/lib/agent-brain/validation'
import {
  canonicalSource,
  captureSchema,
  libraryChangesSchema,
  librarySearchSchema,
  parseLibrary,
} from '@/lib/library/validation'
import {
  libraryHref,
  type LibraryItem,
  type LibraryKind,
  type LibraryQuery,
} from '@/lib/library/types'
import { searchTerms, searchMatch } from '@/lib/library/search'
import type { z } from 'zod'

type Row = Omit<LibraryItem, 'topics' | 'favorite' | 'archived' | 'href'> & {
  topics_json: string
  favorite: number
  archived: number
}
const fields = `v.kind,v.id,COALESCE(NULLIF(m.display_title,''),v.title) AS title,v.content,v.source_url,v.created_at,v.updated_at,
 COALESCE(NULLIF(m.content_type,''),v.kind) AS content_type,COALESCE(m.summary,'') AS summary,
 COALESCE(m.saved_reason,'') AS saved_reason,COALESCE(m.topics_json,'[]') AS topics_json,
 COALESCE(m.submitted_by,'unknown') AS submitted_by,COALESCE(m.source_status,'unknown') AS source_status,
 COALESCE(m.decision_question,'') AS decision_question,COALESCE(m.favorite,0) AS favorite,
 MAX(v.archived,COALESCE(m.archived,0)) AS archived,COALESCE(m.revision,1) AS revision`
const from = 'library_content v LEFT JOIN library_metadata m ON m.kind=v.kind AND m.item_id=v.id'
function decorate(row: Row): LibraryItem {
  let topics: string[] = []
  try {
    const value = JSON.parse(row.topics_json)
    if (Array.isArray(value)) topics = value.filter((t) => typeof t === 'string')
  } catch {}
  const { topics_json: _, ...rest } = row
  void _
  let sourceUrl: string | null = null
  try {
    const url = new URL(row.source_url || '')
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password)
      sourceUrl = url.href
  } catch {}
  return {
    ...rest,
    source_url: sourceUrl,
    topics,
    favorite: !!row.favorite,
    archived: !!row.archived,
    href: libraryHref(row.kind, row.id),
  }
}
export async function getLibraryItem(
  db: Database,
  kind: LibraryKind,
  id: string,
): Promise<LibraryItem> {
  const row = await db
    .prepare(`SELECT ${fields} FROM ${from} WHERE v.kind=? AND v.id=?`)
    .bind(kind, id)
    .first<Row>()
  if (!row) throw new BrainApiError(404, '内容不存在')
  const { results } = await db
    .prepare(
      `SELECT p.id,p.title FROM projects p JOIN library_members l ON l.collection_id=p.id
    WHERE l.kind=? AND l.item_id=? AND p.status!='archived' ORDER BY p.title`,
    )
    .bind(kind, id)
    .all<{ id: string; title: string }>()
  return { ...decorate(row), collections: results }
}
export async function searchLibrary(db: Database, input: LibraryQuery = {}) {
  const query = parseLibrary(librarySearchSchema, input)
  const terms = searchTerms(query.q || '')
  const filters = ["v.kind!='inspiration'", 'MAX(v.archived,COALESCE(m.archived,0))=?']
  const values: (string | number)[] = [query.archived ? 1 : 0]
  if (query.kind === 'article') filters.push("m.content_type='article'")
  else if (query.kind) {
    filters.push('v.kind=?')
    values.push(query.kind)
    if (query.kind === 'note') filters.push("COALESCE(m.content_type,'')!='article'")
  } else if (!query.collection && !query.q && !query.recent) filters.push("v.kind!='post'")
  const title = "COALESCE(NULLIF(m.display_title,''),v.title)"
  const text = `${title} || char(10) || COALESCE(m.summary,'') || char(10) || COALESCE(m.topics_json,'') || char(10) || COALESCE(m.saved_reason,'') || char(10) || v.content || char(10) || COALESCE(v.source_url,'')`
  if (terms.length)
    filters.push(`NOT EXISTS (SELECT 1 FROM terms WHERE instr(lower(${text}),terms.value)=0)`)
  if (query.collection) {
    filters.push(
      'EXISTS (SELECT 1 FROM library_members l WHERE l.kind=v.kind AND l.item_id=v.id AND l.collection_id=?)',
    )
    values.push(query.collection)
  }
  if (query.topic) {
    filters.push("EXISTS (SELECT 1 FROM json_each(COALESCE(m.topics_json,'[]')) WHERE value=?)")
    values.push(query.topic)
  }
  if (query.favorite) filters.push('m.favorite=1')
  if (query.decisions) filters.push("length(trim(COALESCE(m.decision_question,'')))>0")
  if (query.recent)
    filters.push(
      'EXISTS (SELECT 1 FROM admin_recent_items r WHERE r.kind=v.kind AND r.item_id=v.id)',
    )
  const cte = 'WITH terms AS (SELECT value FROM json_each(?)), phrase AS (SELECT ? AS value) '
  const rank = `CASE WHEN lower(${title})=(SELECT value FROM phrase) THEN 2 WHEN instr(lower(${title}),(SELECT value FROM phrase))>0 THEN 1 ELSE 0 END DESC,
    (SELECT COALESCE(SUM(CASE WHEN instr(lower(${title}),value)>0 THEN 20 ELSE 0 END + CASE WHEN instr(lower(COALESCE(m.summary,'') || ' ' || COALESCE(m.topics_json,'')),value)>0 THEN 8 ELSE 0 END + CASE WHEN instr(lower(COALESCE(m.saved_reason,'')),value)>0 THEN 4 ELSE 0 END + CASE WHEN instr(lower(v.content || ' ' || COALESCE(v.source_url,'')),value)>0 THEN 1 ELSE 0 END),0) FROM terms) DESC,v.created_at DESC`
  let order = {
    newest: 'v.created_at DESC',
    updated: 'v.updated_at DESC',
    title: `${title} COLLATE NOCASE`,
    relevance: terms.length ? rank : 'v.created_at DESC',
  }[query.sort || 'newest']
  if (query.recent)
    order =
      '(SELECT viewed_at FROM admin_recent_items r WHERE r.kind=v.kind AND r.item_id=v.id) DESC,' +
      order
  const pin = query.collection
    ? 'COALESCE((SELECT pinned FROM library_member_preferences p WHERE p.kind=v.kind AND p.item_id=v.id AND p.collection_id=?),0)'
    : '0'
  if (query.collection && !terms.length) order = 'collection_pinned DESC,' + order
  const where = filters.join(' AND '),
    page = query.page ?? 1,
    limit = query.limit ?? 30
  const common = [JSON.stringify(terms), (query.q || '').trim().toLowerCase()]
  const [rows, count] = (await db.batch([
    db
      .prepare(
        `${cte} SELECT ${terms.length ? fields : fields.replace('v.content,', 'substr(v.content,1,240) AS content,')},${pin} AS collection_pinned FROM ${from} WHERE ${where} ORDER BY ${order},v.kind,v.id LIMIT ? OFFSET ?`,
      )
      .bind(
        ...common,
        ...(query.collection ? [query.collection] : []),
        ...values,
        limit,
        (page - 1) * limit,
      ),
    db
      .prepare(`${cte} SELECT COUNT(*) AS total FROM ${from} WHERE ${where}`)
      .bind(...common, ...values),
  ])) as unknown as [
    { results: Row[]; meta?: { rows_read?: number } },
    { results: { total: number }[]; meta?: { rows_read?: number } },
  ]
  const total = count.results[0]?.total ?? 0
  return {
    items: rows.results.map((row) => {
      const item = decorate(row)
      return {
        ...item,
        ...(terms.length ? { match: searchMatch(item, terms) } : {}),
        content: item.content.slice(0, 240),
      }
    }),
    total,
    page,
    limit,
    has_more: page * limit < total,
    ...(rows.meta?.rows_read !== undefined
      ? { rows_read: rows.meta.rows_read + (count.meta?.rows_read || 0) }
      : {}),
  }
}
export async function listCollections(db: Database, archived = false) {
  const { results } = await db
    .prepare(
      `SELECT p.id,p.title,p.description,p.revision,p.status,
    COALESCE((SELECT pinned FROM admin_collection_preferences a WHERE a.collection_id=p.id),0) AS pinned,
    COALESCE((SELECT sort_order FROM admin_collection_preferences a WHERE a.collection_id=p.id),0) AS sort_order,
    (SELECT COUNT(*) FROM library_members l JOIN library_content v ON v.kind=l.kind AND v.id=l.item_id
      LEFT JOIN library_metadata m ON m.kind=v.kind AND m.item_id=v.id
      WHERE l.collection_id=p.id AND v.kind!='inspiration' AND v.archived=0 AND COALESCE(m.archived,0)=0) AS item_count
    FROM projects p WHERE ${archived ? "p.status='archived'" : "p.status!='archived'"} ORDER BY pinned DESC,sort_order,p.updated_at DESC,p.id`,
    )
    .all<{
      id: string
      title: string
      description: string
      revision: number
      pinned: number
      sort_order: number
      item_count: number
    }>()
  return results
}
async function hash(value: string) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
  )
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
export async function captureLibraryItem(
  db: Database,
  input: z.input<typeof captureSchema>,
  submittedBy: 'agent' | 'manual' = 'agent',
) {
  const data = parseLibrary(captureSchema, input)
  const { request_key, ...body } = data
  const key = await hash(request_key)
  const requestHash = await hash(JSON.stringify(body))
  const kind: LibraryKind = data.type === 'article' ? 'note' : data.type
  const source = canonicalSource(data.source_url)
  const dedupeSource = ['tool', 'article'].includes(data.type) ? source : null
  // Canonicalize matching historical URLs as well; old records deliberately retain their original source.
  let legacyDuplicate: string | null = null
  if (dedupeSource) {
    const url = new URL(dedupeSource)
    const { results } = await db
      .prepare(`SELECT id,source_url FROM library_content WHERE kind=? AND instr(source_url,?)=1`)
      .bind(kind, url.origin + url.pathname)
      .all<{ id: string; source_url: string }>()
    legacyDuplicate =
      results.find((row) => {
        try {
          return canonicalSource(row.source_url) === dedupeSource
        } catch {
          return false
        }
      })?.id ?? null
  }
  const duplicateSql = `SELECT v.id FROM ${from} WHERE v.kind=? AND (m.canonical_source=? OR v.source_url=? OR v.id=?) LIMIT 1`
  const duplicateValues = [kind, dedupeSource, dedupeSource, legacyDuplicate]
  for (const id of data.collection_ids) {
    if (
      !(await db
        .prepare("SELECT id FROM projects WHERE id=? AND status!='archived'")
        .bind(id)
        .first())
    )
      throw new BrainApiError(404, '主题资料集不存在或已归档')
  }
  const candidate = `lib-${crypto.randomUUID()}`
  const execution = crypto.randomUUID()
  const table = { note: 'notes', tool: 'tools', prompt: 'prompts', inspiration: 'x_drafts' }[
    kind as 'note' | 'tool' | 'prompt' | 'inspiration'
  ]
  const content = data.content || data.summary
  const columns =
    kind === 'tool'
      ? 'name,url,description,tags'
      : kind === 'prompt'
        ? 'title,prompt,description,source_url,tags,is_hidden'
        : kind === 'inspiration'
          ? 'id,content,source_url,source_type'
          : 'id,title,content,source_url'
  const insertValues =
    kind === 'tool'
      ? [data.title, data.source_url ?? null, content, JSON.stringify(data.topics)]
      : kind === 'prompt'
        ? [
            data.title,
            content,
            data.summary,
            data.source_url ?? null,
            JSON.stringify(data.topics),
            1,
          ]
        : kind === 'inspiration'
          ? [candidate, content, data.source_url ?? null, submittedBy]
          : [candidate, data.title, content, data.source_url ?? null]
  const receiptId = kind === 'tool' || kind === 'prompt' ? 'CAST(last_insert_rowid() AS TEXT)' : '?'
  const statements = [
    db
      .prepare(
        `INSERT INTO ${table}(${columns}) SELECT ${insertValues.map(() => '?').join(',')}
      WHERE NOT EXISTS(SELECT 1 FROM library_captures WHERE key_hash=?) AND NOT EXISTS(${duplicateSql})`,
      )
      .bind(...insertValues, key, ...duplicateValues),
    db
      .prepare(
        `INSERT OR IGNORE INTO library_captures(key_hash,request_hash,execution_id,kind,item_id,created)
      SELECT ?,?,?,?,CASE WHEN changes()>0 THEN ${receiptId} ELSE (${duplicateSql}) END,changes()>0
      WHERE changes()>0 OR EXISTS(${duplicateSql})`,
      )
      .bind(
        key,
        requestHash,
        execution,
        kind,
        ...(receiptId === '?' ? [candidate] : []),
        ...duplicateValues,
        ...duplicateValues,
      ),
    db
      .prepare(
        `UPDATE library_metadata SET display_title=?,content_type=?,summary=?,saved_reason=?,topics_json=?,submitted_by=?,source_status=?,decision_question=?,canonical_source=?
      WHERE kind=? AND item_id=(SELECT item_id FROM library_captures WHERE key_hash=? AND execution_id=? AND created=1)`,
      )
      .bind(
        kind === 'inspiration' ? data.title : '',
        data.type,
        data.summary,
        data.saved_reason,
        JSON.stringify(data.topics),
        submittedBy,
        data.source_status,
        data.decision_question,
        dedupeSource,
        kind,
        key,
        execution,
      ),
  ]
  for (const collection of data.collection_ids) {
    const legacy = ['note', 'tool', 'prompt'].includes(kind)
    statements.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO ${legacy ? 'project_links(project_id,kind,target_id)' : 'library_collection_links(collection_id,kind,item_id)'}
      SELECT ?,kind,item_id FROM library_captures WHERE key_hash=? AND execution_id=?`,
        )
        .bind(collection, key, execution),
    )
  }
  await db.batch(statements)
  const receipt = await db
    .prepare(
      'SELECT request_hash,item_id,execution_id,created FROM library_captures WHERE key_hash=?',
    )
    .bind(key)
    .first<{ request_hash: string; item_id: string; execution_id: string; created: number }>()
  if (!receipt) throw new BrainApiError(409, '保存冲突，请重新读取后重试')
  if (receipt.request_hash !== requestHash)
    throw new BrainApiError(409, '同一 request_key 不能用于不同内容')
  const item = await getLibraryItem(db, kind, receipt.item_id)
  return {
    item,
    href: item.href,
    replayed: receipt.execution_id !== execution,
    reused_source: !receipt.created,
  }
}

export async function updateLibraryItem(
  db: Database,
  kind: LibraryKind,
  id: string,
  revision: number,
  input: z.input<typeof libraryChangesSchema>,
) {
  const changes = parseLibrary(libraryChangesSchema, input)
  const current = await getLibraryItem(db, kind, id)
  if (current.revision !== revision)
    throw new BrainApiError(412, '内容已被修改，请刷新并核对后重试')
  const sourceKeys = ['title', 'content', 'source_url'] as const
  if (['artifact', 'post'].includes(kind) && sourceKeys.some((key) => key in changes))
    throw new BrainApiError(
      400,
      kind === 'post' ? '请在文章编辑器修改正文' : '同步成果正文由来源维护',
    )
  const execution = crypto.randomUUID()
  const sets = ['mutation_id=?']
  const values: (string | number | null)[] = [execution]
  for (const key of [
    'summary',
    'saved_reason',
    'source_status',
    'decision_question',
    'favorite',
    'archived',
  ] as const) {
    if (changes[key] !== undefined) {
      sets.push(`${key}=?`)
      values.push(
        typeof changes[key] === 'boolean' ? Number(changes[key]) : (changes[key] as string),
      )
    }
  }
  if (kind === 'inspiration' && changes.title !== undefined) {
    sets.push('display_title=?')
    values.push(changes.title)
  }
  if (changes.topics !== undefined) {
    sets.push('topics_json=?')
    values.push(JSON.stringify(changes.topics))
  }
  if (changes.source_url !== undefined) {
    sets.push('canonical_source=?')
    values.push(
      ['tool', 'article'].includes(current.content_type)
        ? canonicalSource(changes.source_url)
        : null,
    )
  }
  const statements = [
    db
      .prepare(
        `UPDATE library_metadata SET ${sets.join(',')} WHERE kind=? AND item_id=? AND revision=?`,
      )
      .bind(...values, kind, id, revision),
  ]
  const tables = {
    note: 'notes',
    inbox: 'inbox_items',
    tool: 'tools',
    prompt: 'prompts',
    inspiration: 'x_drafts',
  } as const
  if (kind in tables) {
    const updates: string[] = []
    const params: (string | number | null)[] = []
    for (const key of sourceKeys)
      if (changes[key] !== undefined) {
        if (key === 'title' && kind === 'inspiration') continue
        const col =
          kind === 'tool'
            ? { title: 'name', content: 'description', source_url: 'url' }[key]
            : kind === 'prompt' && key === 'content'
              ? 'prompt'
              : key
        updates.push(`${col}=?`)
        params.push(changes[key] ?? null)
      }
    if (changes.archived !== undefined) {
      if (kind === 'note') {
        updates.push('archived=?')
        params.push(Number(changes.archived))
      }
      if (kind === 'inspiration')
        updates.push(
          changes.archived
            ? "status='discarded'"
            : "status=CASE WHEN status='discarded' THEN 'pending' ELSE status END",
        )
      if (kind === 'inbox')
        updates.push(
          changes.archived
            ? "status='archived'"
            : "status=CASE WHEN target_id IS NULL THEN 'inbox' ELSE 'organized' END",
        )
    }
    updates.push("updated_at=strftime('%s','now')")
    statements.push(
      db
        .prepare(
          `UPDATE ${tables[kind as keyof typeof tables]} SET ${updates.join(',')}
      WHERE id=? AND EXISTS (SELECT 1 FROM library_metadata WHERE kind=? AND item_id=? AND mutation_id=?)`,
        )
        .bind(...params, id, kind, id, execution),
    )
  }
  const results = await db.batch(statements)
  if (!results[0].meta?.changes) throw new BrainApiError(412, '内容已被修改，请刷新并核对后重试')
  return getLibraryItem(db, kind, id)
}

export async function linkLibraryCollection(
  db: Database,
  collection: string,
  kind: LibraryKind,
  id: string,
  revision: number,
  remove = false,
) {
  await getLibraryItem(db, kind, id)
  const project = await db
    .prepare("SELECT revision FROM projects WHERE id=? AND status!='archived'")
    .bind(collection)
    .first<{ revision: number }>()
  if (!project) throw new BrainApiError(404, '主题资料集不存在')
  if (project.revision !== revision) throw new BrainApiError(412, '资料集已被修改，请刷新后重试')
  const legacy = ['note', 'tool', 'prompt', 'post'].includes(kind)
  let target = id
  if (kind === 'post') {
    const row = await db
      .prepare('SELECT id FROM posts WHERE slug=?')
      .bind(id)
      .first<{ id: number }>()
    if (!row) throw new BrainApiError(404, '文章不存在')
    target = String(row.id)
  }
  const table = legacy ? 'project_links' : 'library_collection_links'
  const collectionKey = legacy ? 'project_id' : 'collection_id'
  const itemKey = legacy ? 'target_id' : 'item_id'
  const guard = "EXISTS (SELECT 1 FROM projects WHERE id=? AND revision=? AND status!='archived')"
  const result = await db.batch([
    db
      .prepare(
        remove
          ? `DELETE FROM ${table} WHERE ${collectionKey}=? AND kind=? AND ${itemKey}=? AND ${guard}`
          : `INSERT OR IGNORE INTO ${table}(${collectionKey},kind,${itemKey}) SELECT ?,?,? WHERE ${guard}`,
      )
      .bind(collection, kind, target, collection, revision),
  ])
  const after = await db
    .prepare('SELECT revision FROM projects WHERE id=?')
    .bind(collection)
    .first<{ revision: number }>()
  if (!result[0].meta?.changes && after?.revision !== revision)
    throw new BrainApiError(412, '资料集已被修改，请刷新后重试')
  return getLibraryItem(db, kind, id)
}

export async function draftFromLibrary(
  db: Database,
  kind: LibraryKind,
  id: string,
  revision: number,
) {
  const item = await getLibraryItem(db, kind, id)
  if (item.revision !== revision) throw new BrainApiError(412, '内容已变化，请刷新后重试')
  if (item.archived) throw new BrainApiError(409, '请先恢复内容再创建草稿')
  const slug = `library-${kind}-${await hash(id)}`
  const content = [
    item.summary && item.summary !== item.content ? item.summary : '',
    item.content,
    item.saved_reason ? `## 我的收录理由\n\n${item.saved_reason}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
  const clipping = item.content_type === 'article' ? 'clipping' : 'post'
  await db
    .prepare(
      `INSERT INTO posts(slug,title,content,html,description,status,kind,source_url)
    SELECT ?,?,?,'',?,'draft',?,? WHERE EXISTS (SELECT 1 FROM library_metadata WHERE kind=? AND item_id=? AND revision=?)
    ON CONFLICT(slug) DO NOTHING`,
    )
    .bind(slug, item.title, content, item.summary, clipping, item.source_url, kind, id, revision)
    .run()
  const post = await db
    .prepare('SELECT slug,deleted_at FROM posts WHERE slug=?')
    .bind(slug)
    .first<{ slug: string; deleted_at: number | null }>()
  if (!post) throw new BrainApiError(412, '内容已变化，请刷新后重试')
  if (post.deleted_at) throw new BrainApiError(409, '已有草稿在回收站，请先恢复')
  return { href: `/editor?edit=${encodeURIComponent(slug)}` }
}

export interface PublicLibraryFields {
  title: string
  description: string
  content?: string
  url?: string | null
}
export async function getLibraryPublication(db: Database, kind: 'tool' | 'prompt', id: string) {
  const item = await getLibraryItem(db, kind, id)
  const table = kind === 'tool' ? 'tools' : 'prompts'
  const row = await db
    .prepare(`SELECT published_payload,is_hidden FROM ${table} WHERE id=?`)
    .bind(id)
    .first<{ published_payload: string | null; is_hidden: number }>()
  const payload = row?.published_payload ? JSON.parse(row.published_payload) : null
  const privateFields: PublicLibraryFields = {
    title: item.title,
    description: (item.summary || (kind === 'tool' ? item.content : '')).slice(0, 2000),
    content: item.content,
    url: item.source_url,
  }
  const fields: PublicLibraryFields = payload
    ? {
        title: kind === 'tool' ? payload.name : payload.title,
        description: payload.description || '',
        content: kind === 'prompt' ? payload.prompt : '',
        url: (kind === 'tool' ? payload.url : payload.source_url) || null,
      }
    : privateFields
  return {
    fields,
    privateFields,
    revision: item.revision,
    has_snapshot: !!payload,
    published: !!payload && row?.is_hidden === 0,
  }
}
export async function publishLibraryResource(
  db: Database,
  kind: 'tool' | 'prompt',
  id: string,
  revision: number,
  publicFields: PublicLibraryFields,
  publish = true,
) {
  const item = await getLibraryItem(db, kind, id)
  if (item.revision !== revision) throw new BrainApiError(412, '内容已变化，请核对最新版本后再发布')
  const table = kind === 'tool' ? 'tools' : 'prompts'
  const row = await db
    .prepare(`SELECT published_payload FROM ${table} WHERE id=?`)
    .bind(id)
    .first<{ published_payload: string | null }>()
  const old = row?.published_payload ? JSON.parse(row.published_payload) : {}
  const payload =
    kind === 'tool'
      ? {
          type: 'url',
          tags: [],
          icon: null,
          is_pinned: 0,
          sort_order: 0,
          ...old,
          name: publicFields.title,
          description: publicFields.description,
          url: publicFields.url === undefined ? (old.url ?? item.source_url) : publicFields.url,
        }
      : {
          tags: [],
          category: '',
          is_pinned: 0,
          sort_order: 0,
          ...old,
          title: publicFields.title,
          description: publicFields.description,
          prompt: publicFields.content ?? old.prompt ?? item.content,
          source_url: publicFields.url === undefined ? (old.source_url ?? null) : publicFields.url,
        }
  const result = await db
    .prepare(
      `UPDATE ${table} SET published_payload=CASE WHEN ? THEN ? ELSE published_payload END,is_hidden=? WHERE id=?
    AND EXISTS (SELECT 1 FROM library_metadata WHERE kind=? AND item_id=? AND revision=?)`,
    )
    .bind(Number(publish), JSON.stringify(payload), publish ? 0 : 1, id, kind, id, revision)
    .run()
  if (!result.meta.changes) throw new BrainApiError(412, '内容已变化，请核对最新版本后再发布')
  return getLibraryItem(db, kind, id)
}

export async function updateLibraryCollection(
  db: Database,
  id: string,
  revision: number,
  changes: { title: string; description: string; archived: boolean },
) {
  const result = await db
    .prepare(
      'UPDATE projects SET title=?,description=?,status=?,updated_at=unixepoch() WHERE id=? AND revision=?',
    )
    .bind(
      changes.title,
      changes.description,
      changes.archived ? 'archived' : 'active',
      id,
      revision,
    )
    .run()
  if (!result.meta?.changes) throw new BrainApiError(412, '资料集已被修改，请刷新后核对')
  return (await listCollections(db, changes.archived)).find((item) => item.id === id)
}
export async function getPublicationSummary(db: Database) {
  return db
    .prepare(
      `SELECT
    (SELECT COUNT(*) FROM posts WHERE deleted_at IS NULL AND status='published') AS posts,
    (SELECT COUNT(*) FROM posts WHERE deleted_at IS NULL AND status='draft') AS drafts,
    (SELECT COUNT(*) FROM tools WHERE is_hidden=0 AND published_payload IS NOT NULL) AS tools,
    (SELECT COUNT(*) FROM prompts WHERE is_hidden=0 AND published_payload IS NOT NULL) AS prompts,
    (SELECT COUNT(*) FROM portfolio_projects WHERE published_payload IS NOT NULL AND status!='archived') AS portfolio`,
    )
    .first<{ posts: number; drafts: number; tools: number; prompts: number; portfolio: number }>()
}

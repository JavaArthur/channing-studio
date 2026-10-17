import type { Database } from './schema'

export const RESOURCE_FIELDS = {
  tools: ['name', 'url', 'type', 'description', 'tags', 'icon', 'is_pinned', 'sort_order'],
  prompts: [
    'title',
    'description',
    'prompt',
    'category',
    'tags',
    'source_url',
    'is_pinned',
    'sort_order',
  ],
} as const
export type ResourceTable = keyof typeof RESOURCE_FIELDS
export function publicResourceColumns(table: ResourceTable) {
  return `id, ${RESOURCE_FIELDS[table].map((field) => `json_extract(published_payload, '$.${field}') AS ${field}`).join(', ')}, 0 AS is_hidden, created_at, updated_at`
}
export async function publishResource(
  db: Database,
  table: ResourceTable,
  id: number,
  publish: boolean,
) {
  const fields = RESOURCE_FIELDS[table].map((field) => `'${field}',${field}`).join(',')
  const result = await db
    .prepare(
      publish
        ? `UPDATE ${table} SET published_payload = json_object(${fields}), is_hidden = 0 WHERE id = ?`
        : `UPDATE ${table} SET is_hidden = 1 WHERE id = ?`,
    )
    .bind(id)
    .run()
  return (result.meta.changes ?? 0) > 0
}

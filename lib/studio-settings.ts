import { getSetting } from '@/lib/repositories/settings'
import type { Database } from '@/lib/repositories/schema'
import {
  parseStudioSettings,
  serializeStudioSettings,
  STUDIO_SETTING_KEYS,
  type StudioContent,
  type StudioSettingValues,
} from '@/lib/studio-content'

export async function getStudioSnapshot(db: Database) {
  const keys = [...STUDIO_SETTING_KEYS, 'studio_revision']
  const { results } = await db
    .prepare(`SELECT key,value FROM site_settings WHERE key IN (${keys.map(() => '?').join(',')})`)
    .bind(...keys)
    .all<{ key: string; value: string }>()
  const values = Object.fromEntries(results.map((row) => [row.key, row.value]))
  return {
    content: parseStudioSettings(values as StudioSettingValues),
    revision: Number(values.studio_revision || 0),
  }
}
export async function getStudioContent(db: Database): Promise<StudioContent> {
  return (await getStudioSnapshot(db)).content
}

export async function setStudioContent(
  db: Database,
  content: StudioContent,
  expectedRevision?: number,
): Promise<number> {
  const settings = serializeStudioSettings(content)
  const current = Number((await getSetting(db, 'studio_revision')) || 0)
  if (expectedRevision !== undefined && current !== expectedRevision)
    throw new Error('配置已更新，请刷新后重试')
  const guard =
    "COALESCE((SELECT CAST(value AS INTEGER) FROM site_settings WHERE key='studio_revision'),0) = ?"
  const statements = Object.entries(settings).map(([key, value]) =>
    db
      .prepare(`INSERT OR REPLACE INTO site_settings (key,value) SELECT ?,? WHERE ${guard}`)
      .bind(key, value, current),
  )
  statements.push(
    db
      .prepare(
        `INSERT OR REPLACE INTO site_settings (key,value) SELECT 'studio_revision',? WHERE ${guard}`,
      )
      .bind(String(current + 1), current),
  )
  const results = await db.batch(statements)
  if (!results.every((result) => (result.meta?.changes ?? 0) > 0))
    throw new Error('配置已更新，请刷新后重试')
  return current + 1
}

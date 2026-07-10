import { ensureSchema, type Database } from '@/lib/repositories/schema'

export interface PromptRow {
  id: number
  title: string
  description: string | null
  prompt: string
  category: string | null
  tags: string | null
  source_url: string | null
  is_pinned: number
  is_hidden: number
  sort_order: number
  created_at: number
  updated_at: number
}

export interface Prompt extends Omit<PromptRow, 'tags'> {
  tags: string[]
}

export interface PromptInput {
  title: string
  description?: string | null
  prompt: string
  category?: string | null
  tags?: string[]
  source_url?: string | null
  is_pinned?: number
  is_hidden?: number
  sort_order?: number
}

export function parsePromptTags(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0).map((tag) => tag.trim())
      : []
  } catch {
    return []
  }
}

export function normalizePromptTags(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((tag): tag is string => typeof tag === 'string')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 20)
    : []
}

export function normalizePromptUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function mapPromptRow(row: PromptRow): Prompt {
  return { ...row, tags: parsePromptTags(row.tags) }
}

export async function getPrompts(
  db: Database,
  options: { includeHidden?: boolean; category?: string; tag?: string; limit?: number } = {},
): Promise<Prompt[]> {
  await ensureSchema(db)
  const where = options.includeHidden ? '' : 'WHERE is_hidden = 0'
  const { results } = await db
    .prepare(
      `SELECT id, title, description, prompt, category, tags, source_url,
              is_pinned, is_hidden, sort_order, created_at, updated_at
       FROM prompts ${where}
       ORDER BY is_pinned DESC, sort_order ASC, updated_at DESC`,
    )
    .all<PromptRow>()

  let prompts = results.map(mapPromptRow)
  if (options.category) prompts = prompts.filter((prompt) => prompt.category === options.category)
  if (options.tag) prompts = prompts.filter((prompt) => prompt.tags.includes(options.tag!))
  return typeof options.limit === 'number' && options.limit > 0 ? prompts.slice(0, Math.min(options.limit, 100)) : prompts
}

export async function createPrompt(db: Database, data: PromptInput): Promise<number> {
  await ensureSchema(db)
  const result = await db
    .prepare(
      `INSERT INTO prompts (title, description, prompt, category, tags, source_url, is_pinned, is_hidden, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      data.title,
      data.description ?? null,
      data.prompt,
      data.category ?? null,
      JSON.stringify(normalizePromptTags(data.tags)),
      data.source_url ?? null,
      data.is_pinned === 1 ? 1 : 0,
      data.is_hidden === 1 ? 1 : 0,
      Number.isFinite(data.sort_order) ? data.sort_order : 0,
    )
    .run()
  return result.meta.last_row_id
}

export async function updatePrompt(
  db: Database,
  id: number,
  data: Partial<PromptInput>,
): Promise<void> {
  await ensureSchema(db)
  const updates: string[] = []
  const values: unknown[] = []

  if (data.title !== undefined) { updates.push('title = ?'); values.push(data.title) }
  if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description) }
  if (data.prompt !== undefined) { updates.push('prompt = ?'); values.push(data.prompt) }
  if (data.category !== undefined) { updates.push('category = ?'); values.push(data.category) }
  if (data.tags !== undefined) { updates.push('tags = ?'); values.push(JSON.stringify(normalizePromptTags(data.tags))) }
  if (data.source_url !== undefined) { updates.push('source_url = ?'); values.push(data.source_url) }
  if (data.is_pinned !== undefined) { updates.push('is_pinned = ?'); values.push(data.is_pinned === 1 ? 1 : 0) }
  if (data.is_hidden !== undefined) { updates.push('is_hidden = ?'); values.push(data.is_hidden === 1 ? 1 : 0) }
  if (data.sort_order !== undefined) { updates.push('sort_order = ?'); values.push(data.sort_order) }
  if (updates.length === 0) return

  updates.push("updated_at = strftime('%s', 'now')")
  values.push(id)
  await db.prepare(`UPDATE prompts SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
}

export async function deletePrompt(db: Database, id: number): Promise<void> {
  await ensureSchema(db)
  await db.prepare('DELETE FROM prompts WHERE id = ?').bind(id).run()
}

import type { Database } from './schema'
type OperationInput = {
  action_key: string
  label: string
  description: string
  prompt: string
  profile_id: number | null
  sort_order?: number
  is_enabled: number
}
export async function createTextOperation(
  db: Database,
  input: OperationInput & { temperature: number },
) {
  const max = await db
    .prepare('SELECT MAX(sort_order) AS value FROM ai_actions')
    .first<{ value: number | null }>()
  return db
    .prepare(
      'INSERT INTO ai_actions (action_key,label,description,prompt,temperature,profile_id,sort_order,is_enabled,is_builtin) VALUES (?,?,?,?,?,?,?,?,0)',
    )
    .bind(
      input.action_key,
      input.label,
      input.description,
      input.prompt,
      input.temperature,
      input.profile_id,
      input.sort_order ?? (max?.value ?? 0) + 10,
      input.is_enabled,
    )
    .run()
}
export async function createImageOperation(
  db: Database,
  input: OperationInput & {
    aspect_ratio: string
    resolution: string
    size: string
    quality: string
  },
) {
  const max = await db
    .prepare('SELECT MAX(sort_order) AS value FROM ai_image_actions')
    .first<{ value: number | null }>()
  return db
    .prepare(
      'INSERT INTO ai_image_actions (action_key,label,description,prompt,aspect_ratio,resolution,size,quality,profile_id,sort_order,is_enabled,is_builtin) VALUES (?,?,?,?,?,?,?,?,?,?,?,0)',
    )
    .bind(
      input.action_key,
      input.label,
      input.description,
      input.prompt,
      input.aspect_ratio,
      input.resolution,
      input.size,
      input.quality,
      input.profile_id,
      input.sort_order ?? (max?.value ?? 0) + 10,
      input.is_enabled,
    )
    .run()
}

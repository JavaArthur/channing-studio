import { getSetting, setSetting } from '@/lib/repositories/settings'
import type { Database } from '@/lib/repositories/schema'
import {
  parseStudioSettings,
  serializeStudioSettings,
  STUDIO_SETTING_KEYS,
  type StudioContent,
  type StudioSettingValues,
} from '@/lib/studio-content'

export async function getStudioContent(db: Database): Promise<StudioContent> {
  const entries = await Promise.all(
    STUDIO_SETTING_KEYS.map(async (key) => [key, await getSetting(db, key)] as const),
  )
  return parseStudioSettings(Object.fromEntries(entries) as StudioSettingValues)
}

export async function setStudioContent(db: Database, content: StudioContent): Promise<void> {
  const settings = serializeStudioSettings(content)
  await Promise.all(
    Object.entries(settings).map(([key, value]) => setSetting(db, key, value)),
  )
}

import { getSetting, setSetting } from '@/lib/repositories/settings'
import type { Database } from '@/lib/repositories/schema'
import {
  parseStudioSettings,
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
  await Promise.all([
    setSetting(db, 'studio_profile', JSON.stringify(content.profile)),
    setSetting(db, 'studio_projects', JSON.stringify(content.projects)),
    setSetting(db, 'studio_labs', JSON.stringify(content.labs)),
    setSetting(db, 'studio_featured_posts', JSON.stringify(content.featuredPostSlugs)),
  ])
}

import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalD1 } from '../helpers/local-d1'
import { DEFAULT_STUDIO_CONTENT } from '@/lib/studio-content'
import { getStudioContent, setStudioContent } from '@/lib/studio-settings'
import type { Database } from '@/lib/repositories/schema'

describe('atomic Studio configuration', () => {
  let sqlite: DatabaseSync
  let db: Database
  beforeEach(() => {
    sqlite=new DatabaseSync(':memory:')
    sqlite.exec(readFileSync('db/schema.sql','utf8'))
    db=new LocalD1(sqlite) as unknown as Database
  })
  afterEach(() => sqlite.close())
  it('reads safe defaults, saves all sections together, and rejects stale writers', async () => {
    expect(await getStudioContent(db)).toEqual(DEFAULT_STUDIO_CONTENT)
    const content=structuredClone(DEFAULT_STUDIO_CONTENT)
    content.profile.title='新标题'
    content.featuredPostSlugs=['older-post']
    expect(await setStudioContent(db,content,0)).toBe(1)
    expect(await getStudioContent(db)).toEqual(content)
    await expect(setStudioContent(db,DEFAULT_STUDIO_CONTENT,0)).rejects.toThrow('配置已更新')
    expect(await getStudioContent(db)).toEqual(content)
  })
  it('rolls back earlier writes when a later section fails', async () => {
    sqlite.exec("CREATE TRIGGER reject_labs BEFORE INSERT ON site_settings WHEN NEW.key='studio_labs' BEGIN SELECT RAISE(ABORT,'test failure'); END")
    await expect(setStudioContent(db,DEFAULT_STUDIO_CONTENT,0)).rejects.toThrow()
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM site_settings').get()?.n).toBe(0)
  })
})

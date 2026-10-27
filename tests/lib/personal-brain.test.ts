import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalD1 } from '../helpers/local-d1'
import type { Database } from '@/lib/repositories/schema'
import { saveWorkingCopy, getWorkingCopy, clearWorkingCopy } from '@/lib/repositories/drafts'
import { getPostBySlug, updatePost, getFeaturedPosts } from '@/lib/repositories/posts'
import { createTool, updateTool, getTools } from '@/lib/repositories/tools'
import { createPrompt, updatePrompt, getPrompts } from '@/lib/repositories/prompts'
import { publishResource } from '@/lib/repositories/publications'
import {
  saveBrainItem,
  draftFromNote,
  archiveBrainItem,
  convertInboxItem,
  searchBrain,
} from '@/lib/repositories/brain'
import { setProjectLink, getProjectLinks } from '@/lib/repositories/project-links'
import { getAdminPostPage } from '@/lib/repositories/admin-posts'

let sqlite: DatabaseSync
let db: Database
const fresh = () => readFileSync('db/schema.sql', 'utf8')
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(fresh())
  db = new LocalD1(sqlite) as unknown as Database
})
afterEach(() => sqlite.close())
function post(slug = 'public-post') {
  return Number(
    sqlite
      .prepare("INSERT INTO posts(slug,title,content,html,status) VALUES (?,?,?,?,'published')")
      .run(slug, slug, 'public body', '<p>public body</p>').lastInsertRowid,
  )
}

describe('publication boundaries and working versions', () => {
  it('autosaves privately, rejects stale windows and only changes public text on publish', async () => {
    const id = post()
    expect(
      await saveWorkingCopy(
        db,
        'public-post',
        { html: 'private draft', content: 'private draft' },
        0,
        0,
      ),
    ).toEqual({ revision: 1, baseRevision: 0 })
    expect((await getPostBySlug(db, 'public-post'))?.content).toBe('public body')
    await expect(
      saveWorkingCopy(db, 'public-post', { content: 'stale window' }, 0, 0),
    ).rejects.toThrow()
    await expect(updatePost(db, id, { content: 'stale publish' }, 0, 0)).rejects.toThrow(
      'REVISION_CONFLICT',
    )
    await updatePost(db, id, { content: 'reviewed', html: 'reviewed' }, 0, 1)
    await clearWorkingCopy(db, id, 0)
    expect((await getPostBySlug(db, 'public-post'))?.content).toBe('reviewed')
    expect(await getWorkingCopy(db, id)).toBeNull()
    await expect(saveWorkingCopy(db, 'public-post', { content: 'stale' }, 0, 1)).rejects.toThrow()
    await expect(
      saveWorkingCopy(db, 'public-post', { content: 'missing draft' }, 1, 2),
    ).rejects.toThrow()
    await saveWorkingCopy(db, 'public-post', { content: 'next change' }, 1, 0)
    await clearWorkingCopy(db, id, 0)
    expect(await getWorkingCopy(db, id)).not.toBeNull()
  })
  it('defaults resources to private and keeps published snapshots stable until an explicit action', async () => {
    const tool = await createTool(db, { name: 'Tool', url: 'https://example.com', type: 'url' })
    const prompt = await createPrompt(db, {
      title: 'Prompt',
      prompt: 'reviewed prompt',
      is_hidden: 0,
    })
    expect(await getTools(db)).toHaveLength(0)
    expect(await getPrompts(db)).toHaveLength(0)
    await publishResource(db, 'tools', tool, true)
    await publishResource(db, 'prompts', prompt, true)
    await updateTool(db, tool, { name: 'PRIVATE NAME' })
    await updatePrompt(db, prompt, { prompt: 'PRIVATE TEXT' })
    expect((await getTools(db))[0].name).toBe('Tool')
    expect((await getPrompts(db))[0].prompt).toBe('reviewed prompt')
    await publishResource(db, 'tools', tool, false)
    await publishResource(db, 'prompts', prompt, false)
    await updatePrompt(db, prompt, { is_hidden: 0 })
    expect(await getTools(db)).toHaveLength(0)
    expect(await getPrompts(db)).toHaveLength(0)
  })
  it('rechecks public visibility after withdrawal even if KV has an old copy', async () => {
    const id = post()
    const old = await getPostBySlug(db, 'public-post')
    await updatePost(db, id, { is_hidden: 1 })
    const cache = { get: async () => old } as unknown as KVNamespace
    expect(await getPostBySlug(db, 'public-post', cache)).toBeNull()
  })
})

describe('collect, organize and find', () => {
  it('converts once, retains the source and keeps the destination private', async () => {
    const id = await saveBrainItem(db, 'inbox', {
      title: 'My idea',
      content: 'private memo',
      source_url: 'https://example.com',
    })
    const target = await convertInboxItem(db, id, 'post')
    expect(await convertInboxItem(db, id, 'note')).toEqual(target)
    expect(await getPostBySlug(db, target.id)).toBeNull()
    expect(
      (await getPostBySlug(db, target.id, undefined, { includeUnpublished: true }))?.content,
    ).toBe('private memo')
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM posts').get()?.n).toBe(1)
    expect((await searchBrain(db, 'private memo')).length).toBe(2)
    const archived = await saveBrainItem(db, 'inbox', { title: 'Later' })
    await archiveBrainItem(db, 'inbox', archived)
    await expect(convertInboxItem(db, archived, 'note')).rejects.toThrow()
  })
  it('paginates in SQL beyond 200 articles, counts all results and finds older featured posts', async () => {
    for (let i = 0; i < 205; i++) post(`article-${i}`)
    const result = await getAdminPostPage(db, { page: 7 })
    expect(result.total).toBe(205)
    expect(result.stats.published).toBe(205)
    expect(result.posts.length).toBe(25)
    expect((await getFeaturedPosts(db, ['article-0']))[0].slug).toBe('article-0')
    expect((await getAdminPostPage(db, { q: 'article-0' })).total).toBe(1)
    await updatePost(db, 1, { status: 'deleted' })
    expect((await getAdminPostPage(db, { status: 'deleted' })).total).toBe(1)
    expect(await getFeaturedPosts(db, ['article-0'])).toEqual([])
  })
  it('links existing resources only and turns notes into one independent writing draft', async () => {
    const note = await saveBrainItem(db, 'notes', {
      title: 'Private note',
      content: 'Before review',
    })
    const project = await saveBrainItem(db, 'projects', { title: 'Private project' })
    await setProjectLink(db, project, 'note', note)
    await setProjectLink(db, project, 'note', note)
    expect(await getProjectLinks(db, project)).toHaveLength(1)
    await expect(setProjectLink(db, project, 'note', 'missing')).rejects.toThrow()
    const draft = await draftFromNote(db, note)
    expect(await draftFromNote(db, note)).toEqual(draft)
    await saveBrainItem(db, 'notes', { title: 'Private note', content: 'New PRIVATE edit' }, note)
    expect(
      (await getPostBySlug(db, draft.id, undefined, { includeUnpublished: true }))?.content,
    ).toBe('Before review')
    expect(await getPostBySlug(db, draft.id)).toBeNull()
    await setProjectLink(db, project, 'note', note, true)
    expect(await getProjectLinks(db, project)).toHaveLength(0)
  })
  it('rejects executable and non-web source URLs', async () => {
    await expect(
      saveBrainItem(db, 'notes', { title: 'bad', source_url: 'javascript:alert(1)' }),
    ).rejects.toThrow()
  })
})

it('migrates old visibility without losing private prompts or old public resources', async () => {
  sqlite.close()
  sqlite = new DatabaseSync(':memory:')
  sqlite.exec(readFileSync('tests/fixtures/pre-brain-schema.sql', 'utf8'))
  sqlite.exec(
    "INSERT INTO tools(name,type) VALUES ('Old tool','url'); INSERT INTO prompts(title,prompt,is_hidden) VALUES ('Public','old public',0),('Private','PRIVATE BODY',1)",
  )
  sqlite.exec(readFileSync('db/migrations/2026-10-16-personal-brain.sql', 'utf8'))
  db = new LocalD1(sqlite) as unknown as Database
  expect((await getTools(db))[0].name).toBe('Old tool')
  expect((await getPrompts(db)).map((p) => p.title)).toEqual(['Public'])
  expect(sqlite.prepare('SELECT COUNT(*) AS n FROM prompts').get()?.n).toBe(2)
  expect(
    sqlite.prepare("SELECT published_payload FROM prompts WHERE title='Private'").get()
      ?.published_payload,
  ).toBeNull()
})

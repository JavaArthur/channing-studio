import { notFound, redirect } from 'next/navigation'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getLibraryItem, listCollections, searchLibrary } from '@/lib/repositories/library'
import { renderLibraryMarkdown } from '@/lib/library/markdown'
import { libraryKinds, type LibraryItem, type LibraryQuery } from '@/lib/library/types'
import { BrainApiError } from '@/lib/agent-brain/validation'
import { LibraryBrowser } from './LibraryBrowser'
export type LibraryParams = Record<string, string | string[] | undefined>
export async function LibraryPage({
  params,
  defaults = {},
}: {
  params: LibraryParams
  defaults?: LibraryQuery
}) {
  const get = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : '')
  const rawKind = get('kind')
  const reference = get('item')
  if (rawKind === 'inspiration' || reference.startsWith('inspiration:')) {
    const query = new URLSearchParams()
    if (reference.startsWith('inspiration:')) query.set('item', reference.slice('inspiration:'.length))
    if (get('q')) query.set('q', get('q'))
    if (get('archived') === '1') query.set('status', 'discarded')
    redirect(`/admin/operations?${query}`)
  }
  const kind = [...libraryKinds, 'article'].includes(rawKind)
    ? (rawKind as LibraryQuery['kind'])
    : defaults.kind
  const query: LibraryQuery = {
    ...defaults,
    sort: ['newest', 'updated', 'title', 'relevance'].includes(get('sort'))
      ? (get('sort') as LibraryQuery['sort'])
      : get('q').trim()
        ? 'relevance'
        : undefined,
    recent: get('recent') === '1',
    ...(kind ? { kind } : {}),
    q: get('q').slice(0, 200) || undefined,
    collection: get('collection').slice(0, 180) || undefined,
    topic: get('topic').slice(0, 40) || undefined,
    favorite: get('favorite') === '1',
    decisions: get('decisions') === '1',
    archived: get('archived') === '1',
    page: Math.max(1, Math.min(10000, parseInt(get('page')) || 1)),
    limit: 30,
  }
  const env = await getAppCloudflareEnv()
  if (!env.DB) return <p role="alert">数据库未连接，请检查环境配置。</p>
  const [data, collections] = await Promise.all([
    searchLibrary(env.DB, query),
    listCollections(env.DB),
  ])
  let selected: LibraryItem | null = null
  const ref = get('item')
  const split = ref.indexOf(':')
  if (split > 0) {
    const itemKind = ref.slice(0, split)
    const id = ref.slice(split + 1)
    if (!(libraryKinds as readonly string[]).includes(itemKind) || id.length > 200) notFound()
    try {
      selected = await getLibraryItem(env.DB, itemKind as LibraryItem['kind'], id)
    } catch (error) {
      if (error instanceof BrainApiError && error.status === 404) notFound()
      throw error
    }
  }
  return (
    <LibraryBrowser
      items={data.items}
      total={data.total}
      page={data.page}
      hasMore={data.has_more}
      query={query}
      selected={selected}
      html={selected ? renderLibraryMarkdown(selected.content) : ''}
      collections={collections}
    />
  )
}

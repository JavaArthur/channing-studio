import { notFound } from 'next/navigation'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getLibraryItem, listCollections, searchLibrary } from '@/lib/repositories/library'
import { journalKind, type JournalFilter, type JournalKind } from '@/lib/library/journal'
import { renderLibraryMarkdown } from '@/lib/library/markdown'
import { JournalWorkbench } from '@/components/library/JournalWorkbench'
import type { LibraryItem } from '@/lib/library/types'
import type { Collection } from '@/components/library/client'
import { BrainApiError } from '@/lib/agent-brain/validation'
export const dynamic = 'force-dynamic'
export const metadata = { title: '学习与复盘 · Studio' }
export default async function LearningPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const get = (name: string) => typeof params[name] === 'string' ? params[name] as string : ''
  const filter: JournalFilter = ['learning', 'reflection'].includes(get('type')) ? get('type') as JournalKind : 'all'
  const query = get('q').slice(0, 200)
  const collection = get('collection').slice(0, 180)
  const page = Math.max(1, Math.min(10000, parseInt(get('page')) || 1))
  const create = ['learning', 'reflection'].includes(get('new')) ? get('new') as JournalKind : undefined
  let items: LibraryItem[] = [], total = 0, hasMore = false, collections: Collection[] = [], selected: LibraryItem | null = null
  let loadError = false, missing = false
  try {
    const env = await getAppCloudflareEnv()
    if (!env.DB) throw new Error('Database unavailable')
    const [data, groups, item] = await Promise.all([
      searchLibrary(env.DB, { journal: filter, q: query, collection, page, limit: 20, sort: 'newest' }),
      listCollections(env.DB),
      get('item') ? getLibraryItem(env.DB, 'note', get('item').slice(0, 200)) : null,
    ])
    items = data.items; total = data.total; hasMore = data.has_more; collections = groups; selected = item
    missing = !!selected && (selected.content_type === 'article' || !journalKind(selected.topics))
  } catch (error) {
    if (error instanceof BrainApiError && error.status === 404) missing = true
    else loadError = true
  }
  if (missing) notFound()
  return <JournalWorkbench key={JSON.stringify([filter, query, collection, page, selected?.id, create])} items={items} total={total} page={page} hasMore={hasMore} filter={filter} query={query} collection={collection} collections={collections} selected={selected} html={selected ? renderLibraryMarkdown(selected.content) : ''} create={create} loadError={loadError} />
}

import type { LibraryItem } from '@/lib/library/types'
export type Collection = {
  id: string
  title: string
  description: string
  revision: number
  pinned?: number
  sort_order?: number
  item_count: number
}
export async function libraryRequest(body: unknown) {
  const response = await fetch('/api/admin/library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok)
    throw Object.assign(new Error(data.error || '操作失败'), { status: response.status })
  return data
}
export async function copyText(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  const area = document.createElement('textarea')
  area.value = text
  area.style.cssText = 'position:fixed;opacity:0'
  document.body.append(area)
  area.focus()
  area.select()
  const ok = document.execCommand('copy')
  area.remove()
  if (!ok) throw new Error('复制失败，请手动选择正文复制。')
}
export async function copyPrepared(text: Promise<string>) {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write)
    return navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': text.then((value) => new Blob([value], { type: 'text/plain' })),
      }),
    ])
  return copyText(await text)
}
export const fetchItem = (item: Pick<LibraryItem, 'kind' | 'id'>): Promise<{ item: LibraryItem }> =>
  libraryRequest({ action: 'get', kind: item.kind, id: item.id })

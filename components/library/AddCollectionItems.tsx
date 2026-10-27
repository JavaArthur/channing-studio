'use client'
import { useState } from 'react'
import { Button, Input, Modal } from '@/components/admin/ui'
import type { LibraryItem } from '@/lib/library/types'
import { libraryRequest, type Collection } from './client'
export function AddCollectionItems({
  collection,
  onClose,
  onSaved,
}: {
  collection: Collection
  onClose: () => void
  onSaved: () => void
}) {
  const [q, setQ] = useState(''),
    [items, setItems] = useState<LibraryItem[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(collection.revision),
    [added, setAdded] = useState<string[]>([]),
    [page, setPage] = useState(1),
    [more, setMore] = useState(false)
  async function search(next = 1) {
    setBusy(true)
    setError('')
    try {
      const result = await libraryRequest({
        action: 'search',
        query: { q, sort: 'relevance', page: next, limit: 20 },
      })
      setItems(result.items)
      setPage(next)
      setMore(result.has_more)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={`添加到 ${collection.title}`}
    >
      <div className="admin-form">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void search()
          }}
        >
          <Input
            aria-label="搜索已有资料"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="输入关键词…"
          />
          <Button type="submit" disabled={busy}>
            搜索
          </Button>
        </form>
        {error && <p role="alert">{error}</p>}
        {items.map((item) => (
          <div className="collection-picker-row" key={item.kind + item.id}>
            <span>{item.title}</span>
            <Button
              disabled={busy || added.includes(item.kind + item.id)}
              onClick={async () => {
                setBusy(true)
                try {
                  const result = await libraryRequest({
                    action: 'link',
                    kind: item.kind,
                    id: item.id,
                    collection_id: collection.id,
                    collection_revision: revision,
                  })
                  setRevision(
                    result.collections.find((c: Collection) => c.id === collection.id).revision,
                  )
                  setAdded((a) => [...a, item.kind + item.id])
                  onSaved()
                } catch (e) {
                  setError((e as Error).message)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {added.includes(item.kind + item.id) ? '已加入' : '加入'}
            </Button>
          </div>
        ))}
        <div className="admin-form-actions">
          {page > 1 && <Button onClick={() => void search(page - 1)}>上一页</Button>}
          {more && <Button onClick={() => void search(page + 1)}>下一页</Button>}
        </div>
      </div>
    </Modal>
  )
}

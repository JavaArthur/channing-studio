'use client'
import { useUnsavedChanges, type SaveContext } from '@/components/admin/UnsavedChanges'
import { useWorkspace } from './WorkspaceState'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Folder, Plus } from 'lucide-react'
import { Button, Input, Menu, Modal } from '@/components/admin/ui'
import { libraryRequest, type Collection } from './client'
export function Collections({
  items,
  archived = false,
}: {
  items: Collection[]
  archived?: boolean
}) {
  const router = useRouter()
  const { sync, reload } = useWorkspace()
  const [editing, setEditing] = useState<Collection | 'new' | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const dirty =
    !!editing &&
    (title !== (editing === 'new' ? '' : editing.title) ||
      description !== (editing === 'new' ? '' : editing.description))
  const guard = useUnsavedChanges(dirty, save)
  async function save(context?: SaveContext) {
    if (busy) return false
    if (!title.trim()) {
      setError('请填写资料集名称')
      return false
    }
    setBusy(true)
    setError('')
    try {
      if (!editing) return false
      const result = editing === 'new'
        ? await libraryRequest({ action: 'collection', title, description })
        : await libraryRequest({
          action: 'collection_update',
          id: editing.id,
          expected_revision: editing.revision,
          title,
          description,
          archived,
        })
      // Keep the saved identity/revision while preserving the live title and description.
      setEditing(result.collection || { id: result.id, title, description, revision: 1, item_count: 0 })
      await reload()
      if (!context || context.isCurrent()) setEditing(null)
      router.refresh()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
      return false
    } finally {
      setBusy(false)
    }
  }
  function edit(item: Collection | 'new') {
    setTitle(item === 'new' ? '' : item.title)
    setDescription(item === 'new' ? '' : item.description)
    setError('')
    setEditing(item)
  }
  async function archive(item: Collection) {
    setError('')
    try {
      await libraryRequest({
        action: 'collection_update',
        id: item.id,
        expected_revision: item.revision,
        title: item.title,
        description: item.description,
        archived: !archived,
      })
      await reload()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    }
  }
  return (
    <div>
      <header className="workspace-page-heading">
        <div>
          <h1>主题资料集</h1>
          <p>同一主题，放在一起。</p>
        </div>
        <div className="flex gap-3">
          <Link
            className="admin-button admin-button-ghost"
            href={`/admin/collections${archived ? '' : '?archived=1'}`}
          >
            {archived ? '返回当前' : '已归档'}
          </Link>
          <Button variant="primary" onClick={() => edit('new')}>
            <Plus size={15} />
            新建资料集
          </Button>
        </div>
      </header>
      {error && <p role="alert">{error}</p>}
      <div className="collection-list">
        {items.map((item) => (
          <div className="collection-list-row" key={item.id}>
            <Link href={`/admin/library?collection=${encodeURIComponent(item.id)}`}>
              <Folder size={18} />
              <div>
                <h2>{item.title}</h2>
                <p>{item.description || '暂无说明'}</p>
              </div>
            </Link>
            <span>{item.item_count} 条</span>
            <Menu
              label={`${item.title}的操作`}
              items={[
                ...(!archived
                  ? [
                      {
                        label: item.pinned ? '取消侧栏置顶' : '置顶到侧栏',
                        onSelect: () =>
                          void sync({
                            action: 'collection',
                            id: item.id,
                            pinned: !item.pinned,
                          }).then((ok) => {
                            if (ok) router.refresh()
                          }),
                      },
                      ...(item.pinned
                        ? (['up', 'down'] as const).map((move) => ({
                            label: move === 'up' ? '上移常用顺序' : '下移常用顺序',
                            onSelect: () =>
                              void sync({
                                action: 'collection',
                                id: item.id,
                                pinned: true,
                                move,
                              }).then((ok) => {
                                if (ok) router.refresh()
                              }),
                          }))
                        : []),
                    ]
                  : []),
                { label: '编辑名称与说明', onSelect: () => edit(item) },
                {
                  label: archived ? '恢复资料集' : '归档资料集',
                  onSelect: () => void archive(item),
                },
              ]}
            />
          </div>
        ))}
      </div>
      {!items.length && (
        <div className="library-empty">
          <Folder size={28} />
          <h2>{archived ? '没有归档的资料集' : '从一个常用主题开始'}</h2>
          <p>工具、文章、笔记和灵感都可以加入同一个资料集。</p>
        </div>
      )}
      <Modal
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) guard(() => setEditing(null))
        }}
        title={editing === 'new' ? '新建资料集' : '编辑资料集'}
        sheet
      >
        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <label>
            名称
            <Input
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            说明
            <textarea
              className="admin-input"
              rows={5}
              maxLength={50000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <Button type="submit" variant="primary" disabled={busy}>
            保存资料集
          </Button>
        </form>
      </Modal>
    </div>
  )
}

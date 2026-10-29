'use client'
import { useEffect, useState } from 'react'
import { Button, Input, Modal } from '@/components/admin/ui'
import { useUnsavedChanges, type SaveContext } from '@/components/admin/UnsavedChanges'
import type { LibraryItem } from '@/lib/library/types'
import type { PublicLibraryFields } from '@/lib/repositories/library'
import { libraryRequest } from './client'
type Publication = {
  fields: PublicLibraryFields
  privateFields: PublicLibraryFields
  revision: number
  has_snapshot: boolean
  published: boolean
}
export function PublicationEditor({
  kind,
  id,
  onClose,
  onSaved,
}: {
  kind: 'tool' | 'prompt'
  id: string
  onClose: () => void
  onSaved: (item: LibraryItem) => void
}) {
  const [base, setBase] = useState<Publication | null>(null),
    [fields, setFields] = useState<PublicLibraryFields | null>(null)
  const [incoming, setIncoming] = useState<Publication | null>(null),
    [compare, setCompare] = useState(false)
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  useEffect(() => {
    let alive = true
    libraryRequest({ action: 'publication_get', kind, id })
      .then((data) => {
        if (alive) {
          setBase(data)
          setFields(data.fields)
        }
      })
      .catch((e) => {
        if (alive) setError(e.message)
      })
    return () => {
      alive = false
    }
  }, [kind, id])
  async function save(publish = true, context?: SaveContext) {
    if (busy) return false
    if (
      !fields ||
      !base ||
      !fields.title.trim() ||
      (kind === 'prompt' && !fields.content?.trim())
    ) {
      setError('请补充标题和公开正文。')
      return false
    }
    setBusy(true)
    setError('')
    try {
      const result = await libraryRequest({
        action: 'publish',
        kind,
        id,
        expected_revision: base.revision,
        publish,
        fields,
      })
      setBase({ ...base, fields, revision: result.item.revision, published: publish, has_snapshot: true })
      if (!context || context.isCurrent()) {
        onSaved(result.item)
        onClose()
      }
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : '发布失败')
      if ((e as { status?: number }).status === 412) {
        try {
          setIncoming(await libraryRequest({ action: 'publication_get', kind, id }))
        } catch {
          setError('版本冲突，暂时无法读取最新版本。本地文案已保留，请恢复连接后重试。')
        }
      }
      return false
    } finally {
      setBusy(false)
    }
  }
  const guard = useUnsavedChanges(
    !!fields && !!base && JSON.stringify(fields) !== JSON.stringify(base.fields),
    (context) => save(true, context),
  )
  const patch = (value: Partial<PublicLibraryFields>) => setFields((f) => f && { ...f, ...value })
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) guard(onClose)
      }}
      title="编辑公开版本"
      description="此处编辑公开快照，确认发布后访客才能看到。"
    >
      {error && <p role="alert">{error}</p>}
      {!fields || !base ? (
        <p role="status">正在读取公开版本…</p>
      ) : (
        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <p>
            {base.has_snapshot
              ? base.published
                ? '正在编辑已发布版本'
                : '正在编辑上次撤回的版本'
              : '首次公开：已从私人内容初始化，请检查。'}
          </p>
          <Button
            onClick={async () => {
              try {
                const latest = await libraryRequest({ action: 'publication_get', kind, id })
                setIncoming(latest)
                setCompare(true)
              } catch (e) {
                setError(e instanceof Error ? e.message : '读取私人版本失败')
              }
            }}
          >
            从私人版本更新
          </Button>
          {incoming && (
            <div className="publication-compare">
              <h3>{compare ? '核对将替换的字段' : '版本冲突：本地文案已保留'}</h3>
              {(
                [
                  'title',
                  'description',
                  ...(kind === 'prompt' ? ['content'] : []),
                  'url',
                ] as (keyof PublicLibraryFields)[]
              ).map((key) => (
                <div key={key}>
                  <strong>
                    {{ title: '标题', description: '介绍', content: '正文', url: '来源' }[key]}
                  </strong>
                  <pre>{String(fields[key] || '（空）')}</pre>
                  <span>→</span>
                  <pre>
                    {String((compare ? incoming.privateFields : incoming.fields)[key] || '（空）')}
                  </pre>
                </div>
              ))}
              <Button
                onClick={() => {
                  if (compare) setFields(incoming.privateFields)
                  setBase({ ...incoming, fields: compare ? base.fields : incoming.fields })
                  setIncoming(null)
                  setCompare(false)
                  setError('')
                }}
              >
                {compare ? '确认替换这些字段' : '已核对，保留本地文案继续编辑'}
              </Button>
              <Button
                onClick={() => {
                  setIncoming(null)
                  setCompare(false)
                }}
              >
                关闭对照
              </Button>
            </div>
          )}
          <label>
            公开标题
            <Input
              required
              maxLength={200}
              value={fields.title}
              onChange={(e) => patch({ title: e.target.value })}
            />
          </label>
          <label>
            公开介绍
            <textarea
              className="admin-input"
              aria-label="公开介绍"
              rows={4}
              maxLength={2000}
              value={fields.description}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </label>
          <label>
            {kind === 'tool' ? '公开链接' : '公开来源（可选）'}
            <Input
              type="url"
              value={fields.url || ''}
              onChange={(e) => patch({ url: e.target.value || null })}
            />
          </label>
          {kind === 'prompt' && (
            <label>
              公开提示词
              <textarea
                className="admin-input"
                aria-label="公开提示词"
                rows={10}
                maxLength={50000}
                value={fields.content || ''}
                onChange={(e) => patch({ content: e.target.value })}
              />
            </label>
          )}
          <div className="admin-form-actions">
            <Button variant="primary" type="submit" disabled={busy || !!incoming}>
              确认发布这个版本
            </Button>
            {base.published && (
              <Button variant="danger" disabled={busy} onClick={() => void save(false)}>
                撤回公开
              </Button>
            )}
          </div>
        </form>
      )}
    </Modal>
  )
}

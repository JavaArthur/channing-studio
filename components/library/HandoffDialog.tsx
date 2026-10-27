'use client'
import { useEffect, useRef, useState } from 'react'
import { Button, Modal } from '@/components/admin/ui'
import { buildHandoff, type LibraryItem } from '@/lib/library/types'
import { useWorkspace, type Selection } from './WorkspaceState'
import { copyText, libraryRequest } from './client'
export function HandoffDialog({
  refs,
  onClose,
  flush,
}: {
  refs: Selection
  onClose: () => void
  flush: () => Promise<boolean>
}) {
  const { instruction, setInstruction } = useWorkspace()
  const [items, setItems] = useState<LibraryItem[]>([]),
    [error, setError] = useState(''),
    [copied, setCopied] = useState(false)
  const flushRef = useRef(flush)
  useEffect(() => {
    flushRef.current = flush
  }, [flush])
  const keys = JSON.stringify(Object.values(refs).map(({ kind, id }) => ({ kind, id })))
  useEffect(() => {
    let alive = true
    void (async () => {
      if (!(await flushRef.current())) throw new Error('请先处理未保存的修改')
      const result = await Promise.all(
        (JSON.parse(keys) as LibraryItem[]).map((ref) =>
          libraryRequest({ action: 'get', kind: ref.kind, id: ref.id }),
        ),
      )
      if (alive) setItems(result.map((r) => r.item))
    })().catch((e) => {
      if (alive) setError(e.message)
    })
    return () => {
      alive = false
    }
  }, [keys]) // flush is read once when opening this selection.
  const preview = buildHandoff(
    items,
    instruction,
    typeof location === 'undefined' ? '' : location.origin,
  )
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="复制给助手"
      description="正文、来源和直达链接将一并复制。"
    >
      <div className="admin-form">
        <ul className="handoff-items">
          {Object.values(refs).map((ref) => (
            <li key={ref.kind + ref.id}>{ref.title}</li>
          ))}
        </ul>
        <label>
          你想继续做什么？
          <textarea
            className="admin-input"
            aria-label="你想继续做什么？"
            rows={3}
            maxLength={10000}
            value={instruction}
            onChange={(e) => {
              setInstruction(e.target.value)
              setCopied(false)
            }}
            placeholder="例如：比较这些工具，推荐适合做产品演示的一个。"
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <details open>
          <summary>复制内容预览 · {preview.length.toLocaleString()} 字符</summary>
          <pre className="handoff-preview">{items.length ? preview : '正在读取资料…'}</pre>
        </details>
        <Button
          variant="primary"
          disabled={items.length !== Object.keys(refs).length || !items.length}
          onClick={() =>
            void copyText(preview)
              .then(() => setCopied(true))
              .catch((e) => setError(e.message))
          }
        >
          {copied ? '已复制' : '复制给助手'}
        </Button>
        {copied && <p role="status">已复制内容、来源和你的要求。</p>}
      </div>
    </Modal>
  )
}

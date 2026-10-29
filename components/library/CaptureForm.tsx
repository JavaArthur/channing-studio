'use client'
import { useUnsavedChanges, type SaveContext } from '@/components/admin/UnsavedChanges'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { libraryLabels, type LibraryItem } from '@/lib/library/types'
import { libraryRequest } from './client'
export function CaptureForm({
  collection,
  onClose,
  beforeSave,
}: {
  collection?: string
  onClose: () => void
  beforeSave: () => Promise<boolean>
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    type: 'note',
    title: '',
    content: '',
    summary: '',
    source_url: '',
    topics: '',
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID())
  const [savedForm, setSavedForm] = useState(() => JSON.stringify(form))
  const [savedCapture, setSavedCapture] = useState<{ item: LibraryItem; type: string } | null>(null)
  const guard = useUnsavedChanges(
    JSON.stringify(form) !== savedForm,
    save,
  )
  async function save(context?: SaveContext) {
    if (busy) return false
    setBusy(true)
    setError('')
    try {
      if (!(await beforeSave())) throw new Error('请先处理当前资料未保存的修改')
      if (context && !context.isCurrent()) return false
      const changes = {
        title: form.title,
        content: form.content,
        summary: form.summary,
        source_url: form.source_url || null,
        topics: form.topics.split(/[、,，]/).map((x) => x.trim()).filter(Boolean),
      }
      const result = await libraryRequest(savedCapture && savedCapture.type === form.type
        ? { action: 'update', kind: savedCapture.item.kind, id: savedCapture.item.id,
            expected_revision: savedCapture.item.revision, changes }
        : { action: 'capture', input: { ...changes, type: form.type, request_key: requestKey,
            collection_ids: collection ? [collection] : [] } })
      setSavedCapture({ item: result.item, type: form.type })
      setSavedForm(JSON.stringify(form))
      setRequestKey(crypto.randomUUID())
      if (!context || context.isCurrent()) {
        onClose()
        // Guarded saves let the provider execute the requested destination exactly once.
        if (!context) router.push(result.href || result.item.href)
        router.refresh()
      }
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
      return false
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      className="capture-form"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <div className="flex items-center justify-between">
        <h2>收录内容</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="关闭手动收录"
          onClick={() => guard(onClose)}
        >
          <X size={18} />
        </button>
      </div>
      <div className="capture-fields">
        <label>
          内容类型
          <select
            className="brain-input"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            {['note', 'article', 'tool', 'prompt'].map((type) => (
              <option value={type} key={type}>
                {libraryLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <label>
          标题
          <input
            className="brain-input"
            required
            maxLength={200}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
      </div>
      <label>
        摘要
        <input
          className="brain-input"
          maxLength={1000}
          value={form.summary}
          onChange={(e) => setForm({ ...form, summary: e.target.value })}
        />
      </label>
      <label>
        正文或要点
        <textarea
          aria-label="正文或要点"
          className="brain-input min-h-32"
          maxLength={50000}
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
        />
      </label>
      <div className="capture-fields">
        <label>
          原始链接
          <input
            className="brain-input"
            required={['tool', 'article'].includes(form.type)}
            type="url"
            value={form.source_url}
            onChange={(e) => setForm({ ...form, source_url: e.target.value })}
          />
        </label>
        <label>
          主题（用顿号分隔）
          <input
            className="brain-input"
            value={form.topics}
            onChange={(e) => setForm({ ...form, topics: e.target.value })}
          />
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      <button className="brain-button" disabled={busy}>
        保存到资料库
      </button>
    </form>
  )
}

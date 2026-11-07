'use client'
import { useEffect, useRef, useState } from 'react'
import { Button, Input, Modal, Select } from '@/components/admin/ui'
import { useUnsavedChanges } from '@/components/admin/UnsavedChanges'
import { captureSchema } from '@/lib/library/validation'
import { journalDate, journalTemplates, journalTopics, type JournalKind } from '@/lib/library/journal'
import { libraryRequest, type Collection } from './client'
import { useDraftKey } from './DraftScope'
import { z } from 'zod'

// Drafts may be incomplete (for example, half a source URL); API validation runs on save.
const draftFields = z.object({
  request_key: z.string().uuid(), type: z.literal('note'), title: z.string().max(200),
  content: z.string().max(50000), topics: z.array(z.string()).max(1000),
  source_url: z.string().nullable().optional(), collection_ids: z.array(z.string()).max(10),
})
type Capture = z.output<typeof captureSchema>
export function JournalCapture({ kind, collections, onClose, onSaved }: {
  kind: JournalKind; collections: Collection[]; onClose: () => void; onSaved: (id: string) => void
}) {
  const key = useDraftKey(`new-journal:${kind}`)
  const [form, setForm] = useState<Capture>(() => ({
    request_key: crypto.randomUUID(), type: 'note', title: kind === 'reflection' ? `${journalDate()} · 日复盘` : '',
    content: '', topics: [journalTopics[kind]], summary: '', saved_reason: '', collection_ids: [],
    source_status: 'unknown', decision_question: '',
  }))
  const [tagsText, setTagsText] = useState('')
  const [ready, setReady] = useState(false)
  const [changed, setChanged] = useState(false)
  const [pending, setPending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [storageError, setStorageError] = useState(false)
  const [restored, setRestored] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedId, setSavedId] = useState('')
  const lock = useRef(false)
  useEffect(() => {
    try {
      const raw = key && sessionStorage.getItem(key)
      if (raw) {
        const value = JSON.parse(raw)
        const parsed = value.pending === true ? captureSchema.safeParse(value.form) : draftFields.safeParse(value.form)
        if (parsed.success && parsed.data.type === 'note' && parsed.data.topics.includes(journalTopics[kind])) {
          setForm((initial) => ({ ...initial, ...parsed.data }))
          setTagsText(parsed.data.topics.filter((topic) => topic !== journalTopics[kind]).join('，'))
          setPending(value.pending === true)
          setChanged(true)
          setRestored(true)
        }
      }
    } catch { setStorageError(true) }
    setReady(true)
  }, [key, kind])
  useEffect(() => {
    if (!ready || !changed || saved || !key) return
    try { sessionStorage.setItem(key, JSON.stringify({ form, pending })); setStorageError(false) }
    catch { setStorageError(true) }
  }, [form, pending, ready, changed, saved, key])
  function discard() {
    try { if (key) sessionStorage.removeItem(key) } catch {}
    setChanged(false)
  }
  async function save(navigate = true) {
    if (lock.current || !ready) return false
    const parsed = captureSchema.safeParse(form)
    if (!parsed.success || !form.content.trim()) {
      setError(!form.content.trim() ? '先写下一点内容，再保存。' : parsed.error?.issues[0]?.message || '请填写标题。')
      return false
    }
    lock.current = true
    setBusy(true)
    setError('')
    // Never send without a recoverable request key: a lost response followed by
    // refresh must not turn a committed capture into a second, unrelated capture.
    try {
      if (!key) throw new Error('Draft scope unavailable')
      sessionStorage.setItem(key, JSON.stringify({ form: parsed.data, pending: true }))
      setStorageError(false)
    } catch {
      setStorageError(true)
      setError('本次保存未发送。浏览器无法保留保存凭据，请先复制正文，恢复浏览器存储后重试。')
      lock.current = false
      setBusy(false)
      return false
    }
    setPending(true)
    try {
      const result = await libraryRequest({ action: 'capture', input: parsed.data })
      if (!result.item?.id) throw new Error('服务未返回保存结果，请重试确认。')
      setSavedId(result.item.id)
      setSaved(true)
      setPending(false)
      discard()
      if (navigate) onSaved(result.item.id)
      return true
    } catch (cause) {
      const status = (cause as { status?: number }).status
      // Validation/authentication failures did not write. Unknown responses must retry unchanged.
      if (status && status >= 400 && status < 500 && status !== 409) setPending(false)
      setError(cause instanceof Error ? cause.message : '保存结果尚未确认，请重试。')
      return false
    } finally { lock.current = false; setBusy(false) }
  }
  const guard = useUnsavedChanges(changed && !saved, () => save(false), discard)
  function patch(value: Partial<Capture>) { setForm({ ...form, ...value }); setChanged(true) }
  return <Modal open onOpenChange={(open) => { if (!open) guard(onClose) }} title={`新建${journalTopics[kind]}`} busy={busy} description="保存到私人资料库。公开发布需要另外操作。">
    {saved ? <div className="journal-capture"><p role="status">记录已保存到私人资料库。</p><Button variant="primary" onClick={() => onSaved(savedId)}>打开已保存记录</Button></div> : !ready ? <p role="status">正在读取草稿…</p> : <form className="journal-capture" onSubmit={(event) => { event.preventDefault(); void save() }}>
      {restored && <p className="journal-draft-message" role="status">已恢复此标签页的未提交草稿。</p>}
      {pending && !busy && <p role="status">上次保存结果尚未确认。请先重试确认，成功后可继续编辑。</p>}
      <fieldset disabled={busy || pending}>
        <label>标题<Input aria-label="记录标题" required maxLength={200} value={form.title} placeholder="给今天的收获起个名字" onChange={(event) => patch({ title: event.target.value })} /></label>
        <label>正文<textarea aria-label="记录正文" required maxLength={50000} rows={9} className="admin-input" value={form.content} placeholder={kind === 'learning' ? '学到了什么？试过之后，有什么自己的理解？' : '今天有什么进展？哪里可以调整？明天想迈出哪一小步？'} onChange={(event) => patch({ content: event.target.value })} /></label>
        {!form.content && <Button variant="ghost" onClick={() => patch({ content: journalTemplates[kind] })}>使用思考提纲</Button>}
        <div className="journal-form-pair">
          <label>主题标签<Input aria-label="主题标签" value={tagsText} placeholder="例如：AI、产品设计" onChange={(event) => { setTagsText(event.target.value); patch({ topics: [journalTopics[kind], ...event.target.value.split(/[,，、]/).map((topic) => topic.trim()).filter(Boolean)] }) }} /></label>
          <label>关联资料集或项目<Select aria-label="关联资料集或项目" value={form.collection_ids[0] || ''} onChange={(event) => patch({ collection_ids: event.target.value ? [event.target.value] : [] })}><option value="">暂不关联</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.title}</option>)}</Select></label>
        </div>
        <label>参考链接（可选）<Input aria-label="参考链接" type="url" value={form.source_url || ''} placeholder="https://…" onChange={(event) => patch({ source_url: event.target.value || null })} /></label>
      </fieldset>
      {error && <p className="admin-form-error" role="alert">{error}</p>}
      {storageError && <p className="admin-form-error" role="alert">浏览器无法保留草稿。请勿刷新，先复制正文；恢复浏览器存储后可重试保存。</p>}
      <footer><span role="status">{busy ? '正在保存到资料库…' : changed && !storageError ? '草稿保留在此标签页，尚未提交' : '仅自己可见'}</span><Button type="submit" variant="primary" disabled={busy} aria-busy={busy}>{busy ? '保存中…' : pending ? '重试确认保存' : '保存记录'}</Button></footer>
    </form>}
  </Modal>
}

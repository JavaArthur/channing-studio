'use client'

import { ResourceWithdrawal } from '@/components/ResourceWithdrawal'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Prompt } from '@/lib/repositories/prompts'

interface FormState {
  id: number | null
  title: string
  description: string
  prompt: string
  category: string
  tags: string
  source_url: string
  is_pinned: boolean
  is_hidden: boolean
  sort_order: number
}

const EMPTY: FormState = {
  id: null,
  title: '',
  description: '',
  prompt: '',
  category: '',
  tags: '',
  source_url: '',
  is_pinned: false,
  is_hidden: true,
  sort_order: 0,
}

const inputClass = 'w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]/15'

export function PromptsManager({ initialPrompts }: { initialPrompts: Prompt[] }) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const editing = form.id !== null

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }))

  async function save(publish = false) {
    if (!form.title.trim() || !form.prompt.trim()) {
      setError('标题和提示词正文不能为空')
      return
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const body = {
        ...(editing ? { id: form.id } : {}),
        title: form.title.trim(),
        description: form.description.trim() || null,
        prompt: form.prompt.trim(),
        category: form.category.trim() || null,
        tags: form.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
        source_url: form.source_url.trim() || null,
        is_pinned: form.is_pinned ? 1 : 0,
        sort_order: form.sort_order,
      }
      const response = await fetch(editing ? `/api/admin/prompts/${form.id}` : '/api/admin/prompts', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const result = await response.json() as { success?: boolean; error?: string; id?: number }
      if (!response.ok || !result.success) throw new Error(result.error || '保存失败')
      if (!form.id && result.id) setForm(current => ({...current,id:result.id!}))
      if (publish) {
        const publication = await fetch(`/api/admin/resources/prompts/${form.id ?? result.id}/publication`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publish: true }) })
        if (!publication.ok) throw new Error('工作版本已保存，发布失败，请重试。')
      }
      setForm(EMPTY)
      setMessage(publish ? '已公开发布。' : '已保存工作版本，公开内容保持不变。')
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function remove(prompt: Prompt) {
    if (!confirm(`确定删除「${prompt.title}」？`)) return
    const response = await fetch(`/api/admin/prompts/${prompt.id}`, { method: 'DELETE' })
    const result = await response.json() as { success?: boolean; error?: string }
    if (!response.ok || !result.success) {
      setError(result.error || '删除失败')
      return
    }
    setMessage('已删除提示词。')
    if (form.id === prompt.id) setForm(EMPTY)
    router.refresh()
  }

  function edit(prompt: Prompt) {
    setForm({
      id: prompt.id,
      title: prompt.title,
      description: prompt.description || '',
      prompt: prompt.prompt,
      category: prompt.category || '',
      tags: prompt.tags.join(', '),
      source_url: prompt.source_url || '',
      is_pinned: prompt.is_pinned === 1,
      is_hidden: prompt.is_hidden === 1,
      sort_order: prompt.sort_order,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-[var(--editor-muted)]">提示词只在你的浏览器中复制，不会发送给第三方服务。新收藏默认私密。</p>
      <button className="min-h-11 min-w-11 brain-button" disabled={saving} onClick={() => void save(true)}>保存并公开</button>
      <section className="rounded-xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif font-medium text-sm text-[var(--editor-ink)]">{editing ? '编辑提示词' : '添加提示词'}</h2>
          {editing && <button type="button" onClick={() => setForm(EMPTY)} className="min-h-11 min-w-11 text-xs text-[var(--editor-muted)] hover:text-[var(--editor-ink)]">取消编辑</button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={`min-h-11 min-w-11 ${inputClass}`} placeholder="标题 *" value={form.title} onChange={(event) => setField('title', event.target.value)} />
          <input className={`min-h-11 min-w-11 ${inputClass}`} placeholder="分类，例如：写作 / 编程" value={form.category} onChange={(event) => setField('category', event.target.value)} />
          <input className={`min-h-11 min-w-11 ${inputClass}`} placeholder="标签，用逗号分隔" value={form.tags} onChange={(event) => setField('tags', event.target.value)} />
          <input className={`min-h-11 min-w-11 ${inputClass}`} placeholder="来源 URL（可选）" value={form.source_url} onChange={(event) => setField('source_url', event.target.value)} />
          <textarea className={`min-h-11 min-w-11 ${inputClass} min-h-16 resize-y sm:col-span-2`} placeholder="一句话说明适用场景" value={form.description} onChange={(event) => setField('description', event.target.value)} />
          <textarea className={`min-h-11 min-w-11 ${inputClass} min-h-48 resize-y font-mono sm:col-span-2`} placeholder="提示词正文 *" value={form.prompt} onChange={(event) => setField('prompt', event.target.value)} />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--editor-muted)]">
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_pinned} onChange={(event) => setField('is_pinned', event.target.checked)} className="min-h-11 min-w-11" />置顶</label>

            <label className="flex items-center gap-2">排序<input className={`min-h-11 min-w-11 ${inputClass} w-20`} type="number" value={form.sort_order} onChange={(event) => setField('sort_order', Number(event.target.value) || 0)} /></label>
          </div>
          <button type="button" onClick={() => void save()} disabled={saving} className="min-h-11 min-w-11 rounded-lg bg-cta px-5 py-2.5 text-sm font-semibold text-cta-ink hover:bg-cta-hover disabled:opacity-50">{saving ? '保存中…' : editing ? '更新提示词' : '添加提示词'}</button>
        </div>
        {message && <p className="mt-4 text-sm text-[var(--success)]">{message}</p>}
        {error && <p className="mt-4 text-sm text-[var(--danger)]">{error}</p>}
      </section>

      <section className="space-y-3">
        {initialPrompts.length === 0 ? (
          <div className="py-12 text-center text-sm text-[var(--editor-muted)]">还没有提示词，先添加第一条。</div>
        ) : initialPrompts.map((prompt) => (
          <article id={String(prompt.id)} key={prompt.id} className="rounded-xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-serif font-medium text-[var(--editor-ink)]">{prompt.title}</h3>
                  {prompt.is_pinned === 1 && <span className="text-xs text-[var(--editor-accent)]">置顶</span>}
                  <span className="text-xs text-[var(--stone-gray)]">{prompt.is_hidden ? '私密' : '已公开'}</span>
                </div>
                {prompt.description && <p className="mt-1 text-sm text-[var(--editor-muted)]">{prompt.description}</p>}
              </div>
              <div className="flex gap-3 text-xs text-[var(--editor-muted)]">{prompt.is_hidden === 0 && <ResourceWithdrawal kind="prompts" id={prompt.id}/>}<button type="button" onClick={() => edit(prompt)} className="min-h-11 min-w-11 hover:text-[var(--editor-ink)]">编辑</button><button type="button" onClick={() => remove(prompt)} className="min-h-11 min-w-11 text-[var(--danger)] hover:underline">删除</button></div>
            </div>
            <pre className="mt-3 line-clamp-3 whitespace-pre-wrap rounded-lg bg-[var(--editor-soft)] p-3 text-xs leading-6 text-[var(--editor-muted)]">{prompt.prompt}</pre>
          </article>
        ))}
      </section>
    </div>
  )
}

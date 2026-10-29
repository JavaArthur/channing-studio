'use client'
import type { SaveContext } from '@/components/admin/UnsavedChanges'

import { Button, Input, Menu } from '@/components/admin/ui'
import { ManualSheet } from '@/components/admin/ManualSheet'
import { PublicationEditor } from '@/components/library/PublicationEditor'
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

export function PromptsManager({ initialPrompts }: { initialPrompts: Prompt[] }) {
  const [open, setOpen] = useState(false)
  const [publication,setPublication] = useState<string|null>(null)
  const router = useRouter()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const editing = form.id !== null

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  async function save(context?: SaveContext) {
    if (saving) return false
    if (!form.title.trim() || !form.prompt.trim()) {
      setError('标题和提示词正文不能为空')
      return false
    }
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const body = {
        ...(editing ? { id: form.id } : {}),
        title: form.title.trim(),
        description: form.description.trim() || null,
        prompt: form.prompt,
        category: form.category.trim() || null,
        tags: form.tags
          .split(/[,，]/)
          .map((tag) => tag.trim())
          .filter(Boolean),
        source_url: form.source_url.trim() || null,
        is_pinned: form.is_pinned ? 1 : 0,
        sort_order: form.sort_order,
      }
      const response = await fetch(
        editing ? `/api/admin/prompts/${form.id}` : '/api/admin/prompts',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      const result = (await response.json()) as { success?: boolean; error?: string; id?: number }
      if (!response.ok || !result.success) throw new Error(result.error || '保存失败')
      if (!form.id && result.id) setForm((current) => ({ ...current, id: result.id! }))

      if (!context || context.isCurrent()) {
        setForm(EMPTY)
        setOpen(false)
      }
      setMessage('已保存工作版本，公开内容保持不变。')
      router.refresh()
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function remove(prompt: Prompt) {
    if (!confirm(`确定删除「${prompt.title}」？`)) return
    const response = await fetch(`/api/admin/prompts/${prompt.id}`, { method: 'DELETE' })
    const result = (await response.json()) as { success?: boolean; error?: string }
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
    setOpen(true)
  }

  return (
    <div>
      <div className="resource-toolbar">
        <p>工作版本与公开快照分别保存。</p>
        <Button
          variant="primary"
          onClick={() => {
            setForm(EMPTY)
            setError('')
            setOpen(true)
          }}
        >
          添加提示词
        </Button>
      </div>
      {message && (
        <p className="library-feedback" role="status">
          {message}
        </p>
      )}
      <div className="resource-list">
        {initialPrompts.map((prompt) => (
          <div className="resource-row" id={String(prompt.id)} key={prompt.id}>
            <div>
              <h2>{prompt.title}</h2>
              <p>{prompt.description || prompt.prompt}</p>
            </div>
            <span>{prompt.is_hidden ? '私密' : '已公开'}</span>
            <Button variant="ghost" onClick={() => setPublication(String(prompt.id))}>编辑公开版本</Button>
            <Button variant="ghost" onClick={() => edit(prompt)}>
              编辑
            </Button>
            <Menu
              label={`${prompt.title}的操作`}
              items={[{ label: '删除提示词', danger: true, onSelect: () => void remove(prompt) }]}
            />
          </div>
        ))}
      </div>
      {!initialPrompts.length && (
        <div className="library-empty">还没有提示词，添加第一条收藏。</div>
      )}
      {open && <ManualSheet value={{ ...form, id: undefined }} onSave={save} onClose={()=>setOpen(false)} title={editing ? '编辑提示词' : '添加提示词'}>
        <div className="admin-form">
          <label>
            标题
            <Input
              required
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
            />
          </label>
          <label>
            适用场景
            <textarea
              className="admin-input"
              rows={3}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
            />
          </label>
          <label>
            提示词正文
            <textarea
              className="admin-input"
              rows={10}
              value={form.prompt}
              onChange={(e) => setField('prompt', e.target.value)}
            />
          </label>
          <label>
            分类
            <Input value={form.category} onChange={(e) => setField('category', e.target.value)} />
          </label>
          <label>
            标签
            <Input value={form.tags} onChange={(e) => setField('tags', e.target.value)} />
          </label>
          <label>
            来源链接
            <Input
              type="url"
              value={form.source_url}
              onChange={(e) => setField('source_url', e.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.is_pinned}
              onChange={(e) => setField('is_pinned', e.target.checked)}
            />
            置顶
          </label>
          <label>
            排序
            <Input
              type="number"
              value={form.sort_order}
              onChange={(e) => setField('sort_order', Number(e.target.value) || 0)}
            />
          </label>
          {error && <p role="alert">{error}</p>}
          <p>提示词正文仅保存在 Studio。确认公开会更新公开快照。</p>
          <div className="admin-form-actions">
            <Button disabled={saving} onClick={() => void save()}>
              保存工作版本
            </Button>
          </div>
        </div>
      </ManualSheet>}
      {publication && <PublicationEditor kind="prompt" id={publication} onClose={()=>setPublication(null)} onSaved={()=>router.refresh()} />}
    </div>
  )
}

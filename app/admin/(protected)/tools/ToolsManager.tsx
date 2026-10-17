'use client'

import { ResourceWithdrawal } from '@/components/ResourceWithdrawal'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import type { Tool, ToolType } from '@/lib/repositories/tools'

const TYPE_OPTIONS: { value: ToolType; label: string }[] = [
  { value: 'url', label: '网页工具' },
  { value: 'repo', label: '代码仓库' },
  { value: 'mac-app', label: 'Mac 软件' },
  { value: 'other', label: '其他' },
]

interface FormState {
  id: number | null
  name: string
  url: string
  type: ToolType
  description: string
  tags: string
  icon: string
  is_pinned: boolean
}

const EMPTY: FormState = {
  id: null,
  name: '',
  url: '',
  type: 'url',
  description: '',
  tags: '',
  icon: '',
  is_pinned: false,
}

export function ToolsManager({ initialTools }: { initialTools: Tool[] }) {
  const router = useRouter()
  const toast = useToast()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)

  const isEditing = form.id !== null

  async function autoFetch() {
    if (!form.url.trim()) {
      toast.warning('先填入 URL')
      return
    }
    setFetching(true)
    try {
      const resp = await fetch('/api/tools/fetch-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: form.url.trim() }),
      })
      const json = (await resp.json()) as {
        success?: boolean
        error?: string
        meta?: { name?: string; url?: string; type?: ToolType; description?: string; icon?: string }
      }
      if (!resp.ok || !json.success) {
        toast.error(json.error || '抓取失败')
        return
      }
      const m = json.meta ?? {}
      setForm((prev) => ({
        ...prev,
        name: prev.name || m.name || '',
        url: m.url || prev.url,
        type: m.type || prev.type,
        description: prev.description || m.description || '',
        icon: prev.icon || m.icon || '',
      }))
      toast.success('已自动填充，可再调整')
    } catch {
      toast.error('抓取失败')
    } finally {
      setFetching(false)
    }
  }

  async function save(publish = false) {
    if (!form.name.trim()) {
      toast.warning('名称不能为空')
      return
    }
    setSaving(true)
    try {
      const tags = form.tags
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean)
      const body = {
        ...(isEditing ? { id: form.id } : {}),
        name: form.name.trim(),
        url: form.url.trim() || null,
        type: form.type,
        description: form.description.trim() || null,
        tags,
        icon: form.icon.trim() || null,
        is_pinned: form.is_pinned ? 1 : 0,
      }
      const resp = await fetch('/api/tools', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await resp.json()) as { success?: boolean; error?: string; id?: number }
      if (!resp.ok || !json.success) {
        toast.error(json.error || '保存失败')
        return
      }
      if (!form.id && json.id) setForm(current => ({...current,id:json.id!}))
      if (publish) {
        const publication = await fetch(`/api/admin/resources/tools/${form.id ?? json.id}/publication`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publish: true }) })
        if (!publication.ok) throw new Error('内容已保存，但发布失败，请重试')
      }
      toast.success(publish ? '已公开发布' : '已保存工作版本')
      setForm(EMPTY)
      router.refresh()
    } catch {
      toast.error('保存或发布失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number, name: string) {
    if (!confirm(`确定删除「${name}」？`)) return
    try {
      const resp = await fetch(`/api/tools?id=${id}`, { method: 'DELETE' })
      const json = (await resp.json()) as { success?: boolean; error?: string }
      if (!resp.ok || !json.success) {
        toast.error(json.error || '删除失败')
        return
      }
      toast.success('已删除')
      if (form.id === id) setForm(EMPTY)
      router.refresh()
    } catch {
      toast.error('删除失败')
    }
  }

  function edit(tool: Tool) {
    setForm({
      id: tool.id,
      name: tool.name,
      url: tool.url ?? '',
      type: tool.type,
      description: tool.description ?? '',
      tags: tool.tags.join(', '),
      icon: tool.icon ?? '',
      is_pinned: tool.is_pinned === 1,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const inputCls =
    'w-full px-3 py-2 rounded-lg border border-[var(--editor-line)] bg-[var(--editor-panel)] text-sm text-[var(--editor-ink)] focus:outline-none focus:border-[var(--editor-accent)] transition-colors'

  return (
    <div className="space-y-8">
      <p className="text-sm text-[var(--editor-muted)]">新收藏默认私密。保存只修改工作版本，点击“保存并公开”才更新公开内容。</p>
      <button className="brain-button" disabled={saving} onClick={() => void save(true)}>保存并公开</button>
      {/* 录入表单 */}
      <div className="rounded-xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--editor-ink)]">
            {isEditing ? '编辑工具' : '添加工具'}
          </h2>
          {isEditing && (
            <button
              onClick={() => setForm(EMPTY)}
              className="text-xs text-[var(--editor-muted)] hover:text-[var(--editor-ink)]"
            >
              取消编辑
            </button>
          )}
        </div>

        {/* URL + 自动抓取 */}
        <div className="flex gap-2">
          <input
            className={inputCls}
            placeholder="贴入 URL（可选，留空表示无链接的东西）"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
          <button
            onClick={autoFetch}
            disabled={fetching}
            className="px-4 py-2 rounded-lg bg-[var(--editor-soft)] text-sm text-[var(--editor-ink)] hover:bg-[var(--editor-line)] transition-colors whitespace-nowrap disabled:opacity-50"
          >
            {fetching ? '抓取中…' : '自动填充'}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className={inputCls}
            placeholder="名称 *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <select
            className={inputCls}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as ToolType })}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <input
          className={inputCls}
          placeholder="一句话点评：我为什么收它"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className={inputCls}
            placeholder="标签，逗号分隔（如 AI, 效率）"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="图标 URL（可选，自动填充会带上）"
            value={form.icon}
            onChange={(e) => setForm({ ...form, icon: e.target.value })}
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-[var(--editor-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_pinned}
              onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
            />
            置顶
          </label>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-[var(--editor-accent)] text-white text-sm font-medium hover:brightness-105 transition-all disabled:opacity-50"
          >
            {saving ? '保存中…' : isEditing ? '更新' : '添加'}
          </button>
        </div>
      </div>

      {/* 列表 */}
      {initialTools.length === 0 ? (
        <div className="py-12 text-center text-sm text-[var(--editor-muted)]">
          还没有工具，在上方添加第一件
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--editor-line)] bg-[var(--editor-panel)] divide-y divide-[var(--editor-line)] overflow-hidden">
          {initialTools.map((tool) => (
            <div id={String(tool.id)} key={tool.id} className="flex items-center gap-3 px-4 py-3">
              {tool.icon ? (
                <img src={tool.icon} alt="" className="w-8 h-8 rounded border border-[var(--editor-line)] object-cover bg-white flex-shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded bg-[var(--editor-soft)] flex items-center justify-center text-xs text-[var(--stone-gray)] flex-shrink-0">
                  {tool.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--editor-ink)] truncate">{tool.name}</span><span className="shrink-0 text-xs text-[var(--editor-muted)]">{tool.is_hidden ? '私密' : '已公开'}</span>
                  {tool.is_pinned === 1 && <span className="text-[var(--editor-accent)] text-xs">★</span>}
                </div>
                {tool.description && (
                  <p className="text-xs text-[var(--editor-muted)] truncate">{tool.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {tool.is_hidden === 0 && <ResourceWithdrawal kind="tools" id={tool.id}/>}
                <button
                  onClick={() => edit(tool)}
                  className="text-xs px-2 py-1 rounded text-[var(--editor-muted)] hover:text-[var(--editor-ink)] hover:bg-[var(--editor-soft)] transition-colors"
                >
                  编辑
                </button>
                <button
                  onClick={() => remove(tool.id, tool.name)}
                  className="text-xs px-2 py-1 rounded text-rose-500 hover:bg-rose-50 transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

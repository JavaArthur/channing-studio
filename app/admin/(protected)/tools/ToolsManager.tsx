'use client'
import type { SaveContext } from '@/components/admin/UnsavedChanges'

import { Button, Input, Select, Menu } from '@/components/admin/ui'
import { ManualSheet } from '@/components/admin/ManualSheet'
import { PublicationEditor } from '@/components/library/PublicationEditor'
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
  const [open, setOpen] = useState(false)
  const [publication,setPublication] = useState<string|null>(null)
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

  async function save(context?: SaveContext) {
    if (saving) return false
    if (!form.name.trim()) {
      toast.warning('名称不能为空')
      return false
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
        return false
      }
      if (!form.id && json.id) setForm((current) => ({ ...current, id: json.id! }))

      toast.success('已保存工作版本')
      if (!context || context.isCurrent()) {
        setForm(EMPTY)
        setOpen(false)
      }
      router.refresh()
      return true
    } catch {
      toast.error('保存失败，请重试')
      return false
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
            setOpen(true)
          }}
        >
          添加工具
        </Button>
      </div>
      <div className="resource-list">
        {initialTools.map((tool) => (
          <div className="resource-row" id={String(tool.id)} key={tool.id}>
            <div>
              <h2>{tool.name}</h2>
              <p>{tool.description || tool.url}</p>
            </div>
            <span>{tool.is_hidden ? '私密' : '已公开'}</span>
            <Button variant="ghost" onClick={() => setPublication(String(tool.id))}>编辑公开版本</Button>
            <Button variant="ghost" onClick={() => edit(tool)}>
              编辑
            </Button>
            <Menu
              label={`${tool.name}的操作`}
              items={[
                {
                  label: '删除工具',
                  danger: true,
                  onSelect: () => void remove(tool.id, tool.name),
                },
              ]}
            />
          </div>
        ))}
      </div>
      {!initialTools.length && <div className="library-empty">还没有工具，添加第一件收藏。</div>}
      {open && <ManualSheet value={{ ...form, id: undefined }} onSave={save} onClose={()=>setOpen(false)} title={isEditing ? '编辑工具' : '添加工具'}>
        <div className="admin-form">
          <label>
            名称
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label>
            链接
            <Input
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
            />
          </label>
          <Button disabled={fetching} onClick={autoFetch}>
            {fetching ? '抓取中…' : '从链接填充信息'}
          </Button>
          <label>
            类型
            <Select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as ToolType })}
            >
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <label>
            介绍
            <textarea
              className="admin-input"
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label>
            标签
            <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </label>
          <label>
            图标链接
            <Input
              type="url"
              value={form.icon}
              onChange={(e) => setForm({ ...form, icon: e.target.value })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.is_pinned}
              onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
            />
            置顶
          </label>
          <p>确认公开会更新访客看到的快照。</p>
          <div className="admin-form-actions">
            <Button disabled={saving} onClick={() => void save()}>
              保存工作版本
            </Button>
          </div>
        </div>
      </ManualSheet>}
      {publication && <PublicationEditor kind="tool" id={publication} onClose={()=>setPublication(null)} onSaved={()=>router.refresh()} />}
    </div>
  )
}

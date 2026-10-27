'use client'

import { FeaturedPostPicker } from '@/components/FeaturedPostPicker'
import * as Tabs from '@radix-ui/react-tabs'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/admin/ui'
import { useUnsavedChanges } from '@/components/admin/UnsavedChanges'
import { useState } from 'react'
import {
  type StudioCapability,
  type StudioContent,
  type StudioLab,
} from '@/lib/studio-content'

interface StudioManagerProps {
  initialRevision: number
  initialContent: StudioContent
}

const inputClass = 'w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]/15'
const cardClass = 'rounded-xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-4 sm:p-5'

function updateAt<T>(items: T[], index: number, patch: Partial<T>): T[] {
  return items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)
}

function moveAt<T>(items: T[], index: number, offset: -1 | 1): T[] {
  const target = index + offset
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function StudioManager({ initialContent, initialRevision }: StudioManagerProps) {
  const router = useRouter()
  const search = useSearchParams()
  const tabs = [{ id: 'profile', label: '个人介绍' }, { id: 'capabilities', label: '能力' }, { id: 'labs', label: '实验室' }, { id: 'contacts', label: '联系链接' }, { id: 'writing', label: '精选文章' }]
  const tab = tabs.some(t => t.id === search.get('section')) ? search.get('section')! : 'profile'
  const [draft, setDraft] = useState<StudioContent>(initialContent)
  const [savedDraft,setSavedDraft] = useState(()=>JSON.stringify(initialContent))
  const [revision, setRevision] = useState(initialRevision)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const updateProfile = (key: keyof StudioContent['profile'], value: string) => {
    setDraft((current) => ({ ...current, profile: { ...current.profile, [key]: value } }))
  }

  const updateCapability = (index: number, patch: Partial<StudioCapability>) => {
    setDraft((current) => ({ ...current, profile: { ...current.profile, capabilities: updateAt(current.profile.capabilities, index, patch) } }))
  }

  const updateLab = (index: number, patch: Partial<StudioLab>) => {
    setDraft((current) => ({ ...current, labs: updateAt(current.labs, index, patch) }))
  }

  const removeCapability = (index: number) => setDraft((current) => ({ ...current, profile: { ...current.profile, capabilities: current.profile.capabilities.filter((_, itemIndex) => itemIndex !== index) } }))
  const removeLab = (index: number) => setDraft((current) => ({ ...current, labs: current.labs.filter((_, itemIndex) => itemIndex !== index) }))

  const save = async () => {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/admin/studio', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: draft, revision }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '保存失败')
      setRevision(result.revision)
      setMessage('已保存，公开页面刷新后生效。')
      setSavedDraft(JSON.stringify(draft))
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败，请稍后重试')
      return false
    } finally {
      setSaving(false)
    }
  }

  useUnsavedChanges(JSON.stringify(draft)!==savedDraft,save,()=>setDraft(JSON.parse(savedDraft)))
  return (
    <div className="studio-settings">
      <div className="workspace-page-heading">
        <div>
          <h1 className="font-serif font-medium text-xl text-[var(--editor-ink)]">工作室内容</h1>
          <p className="mt-1 text-sm text-[var(--editor-muted)]">编辑公开站点的内容，保存后对访客生效。</p>
        </div>
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? '保存中…' : '确认更新公开站点'}
        </Button>
      </div>

      {message && <p role="status" className="rounded-lg border border-[var(--success-line)] bg-[var(--success-soft-bg)] px-3 py-2 text-sm text-[var(--success)]">{message}</p>}
      {error && <p role="alert" className="rounded-lg border border-[var(--danger-line)] bg-[var(--danger-soft-bg)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p>}

      <Tabs.Root value={tab} onValueChange={value => router.replace(`/admin/studio?section=${value}`, { scroll: false })}><Tabs.List className="studio-tabs" aria-label="公开内容设置">{tabs.map(item => <Tabs.Trigger key={item.id} value={item.id}>{item.label}</Tabs.Trigger>)}</Tabs.List></Tabs.Root>
      <section hidden={tab !== 'profile'} className="space-y-4">
        <div><h2 className="font-serif font-medium text-base text-[var(--editor-ink)]">身份区</h2><p className="mt-1 text-xs text-[var(--editor-muted)]">首页首屏和关于我页面共用。</p></div>
        <div className={`${cardClass} grid gap-4 sm:grid-cols-2`}>
          <label className="text-sm text-[var(--editor-muted)]">眉题<input className={`min-h-11 min-w-11 ${inputClass} mt-1`} value={draft.profile.eyebrow} onChange={(event) => updateProfile('eyebrow', event.target.value)} /></label>
          <label className="text-sm text-[var(--editor-muted)]">副标题<input className={`min-h-11 min-w-11 ${inputClass} mt-1`} value={draft.profile.subtitle} onChange={(event) => updateProfile('subtitle', event.target.value)} /></label>
          <label className="text-sm text-[var(--editor-muted)] sm:col-span-2">主标题<textarea className={`min-h-11 min-w-11 ${inputClass} mt-1 min-h-20 resize-y`} value={draft.profile.title} onChange={(event) => updateProfile('title', event.target.value)} /></label>
          <label className="text-sm text-[var(--editor-muted)] sm:col-span-2">主张<textarea className={`min-h-11 min-w-11 ${inputClass} mt-1 min-h-24 resize-y`} value={draft.profile.statement} onChange={(event) => updateProfile('statement', event.target.value)} /></label>
        </div>
      </section>

      <section hidden={tab !== 'capabilities'} className="space-y-4">
        <div className="flex items-end justify-between gap-3"><div><h2 className="font-serif font-medium text-base text-[var(--editor-ink)]">能力卡</h2><p className="mt-1 text-xs text-[var(--editor-muted)]">首页展示三张，关于我页面也会使用。</p></div><button type="button" onClick={() => setDraft((current) => ({ ...current, profile: { ...current.profile, capabilities: [...current.profile.capabilities, { title: '', description: '' }] } }))} className="min-h-11 min-w-11 rounded-lg bg-[var(--editor-soft)] px-3 py-2 text-xs font-medium text-[var(--editor-ink)]">+ 添加能力</button></div>
        <div className="space-y-3">
          {draft.profile.capabilities.map((capability, index) => (
            <div key={index} className={`${cardClass} grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-start`}>
              <input className={`min-h-11 min-w-11 ${inputClass}`} placeholder="能力名称" value={capability.title} onChange={(event) => updateCapability(index, { title: event.target.value })} />
              <textarea className={`min-h-11 min-w-11 ${inputClass} min-h-16 resize-y`} placeholder="能力说明" value={capability.description} onChange={(event) => updateCapability(index, { description: event.target.value })} />
              <button type="button" onClick={() => removeCapability(index)} className="min-h-11 min-w-11 text-xs text-[var(--danger)] hover:underline">删除</button>
            </div>
          ))}
        </div>
      </section>

      <section hidden={tab !== 'labs'} className="space-y-4">
        <div className="flex items-end justify-between gap-3"><div><h2 className="font-serif font-medium text-base text-[var(--editor-ink)]">实验室</h2><p className="mt-1 text-xs text-[var(--editor-muted)]">工具链、Skill 和正在验证的工作流。</p></div><button type="button" onClick={() => setDraft((current) => ({ ...current, labs: [...current.labs, { id: crypto.randomUUID(), title: '', description: '', href: '/', type: 'tool', visible: true }] }))} className="min-h-11 min-w-11 rounded-lg bg-[var(--editor-soft)] px-3 py-2 text-xs font-medium text-[var(--editor-ink)]">+ 添加实验</button></div>
        <div className="space-y-3">
          {draft.labs.map((lab, index) => (
            <div key={`${index}-${lab.id}`} className={cardClass}>
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={`min-h-11 min-w-11 ${inputClass}`} placeholder="内部 ID" value={lab.id} onChange={(event) => updateLab(index, { id: event.target.value })} />
                <input className={`min-h-11 min-w-11 ${inputClass}`} placeholder="名称" value={lab.title} onChange={(event) => updateLab(index, { title: event.target.value })} />
                <input className={`min-h-11 min-w-11 ${inputClass}`} placeholder="类型，例如 tool / skill" value={lab.type} onChange={(event) => updateLab(index, { type: event.target.value })} />
                <input className={`min-h-11 min-w-11 ${inputClass}`} placeholder="链接" value={lab.href} onChange={(event) => updateLab(index, { href: event.target.value })} />
                <textarea className={`min-h-11 min-w-11 ${inputClass} min-h-20 resize-y sm:col-span-2`} placeholder="实验说明" value={lab.description} onChange={(event) => updateLab(index, { description: event.target.value })} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--editor-muted)]">
                <label className="flex items-center gap-2"><input type="checkbox" checked={lab.visible} onChange={(event) => updateLab(index, { visible: event.target.checked })} className="min-h-11 min-w-11" />公开显示</label>
                <button type="button" onClick={() => setDraft((current) => ({ ...current, labs: moveAt(current.labs, index, -1) }))} className="min-h-11 min-w-11 hover:text-[var(--editor-ink)]">上移</button>
                <button type="button" onClick={() => setDraft((current) => ({ ...current, labs: moveAt(current.labs, index, 1) }))} className="min-h-11 min-w-11 hover:text-[var(--editor-ink)]">下移</button>
                <button type="button" onClick={() => removeLab(index)} className="min-h-11 min-w-11 text-[var(--danger)] hover:underline">删除</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section hidden={tab !== 'contacts'} className="space-y-3"><h2 className="font-serif font-medium">联系链接</h2>{draft.profile.contactLinks.map((link,index) => <div key={index} className="flex gap-3"><input aria-label="链接名称" className={`min-h-11 min-w-11 ${inputClass}`} value={link.label} onChange={e=>setDraft(c=>({...c,profile:{...c.profile,contactLinks:updateAt(c.profile.contactLinks,index,{label:e.target.value})}}))}/><input aria-label="链接地址" className={`min-h-11 min-w-11 ${inputClass}`} value={link.url} onChange={e=>setDraft(c=>({...c,profile:{...c.profile,contactLinks:updateAt(c.profile.contactLinks,index,{url:e.target.value})}}))}/><button onClick={()=>setDraft(c=>({...c,profile:{...c.profile,contactLinks:c.profile.contactLinks.filter((_,i)=>i!==index)}}))} className="min-h-11 min-w-11">移除</button></div>)}<button className="min-h-11 min-w-11 brain-secondary" onClick={()=>setDraft(c=>({...c,profile:{...c.profile,contactLinks:[...c.profile.contactLinks,{label:'',url:'',openInNewTab:true}]}}))}>添加链接</button></section>

      <section hidden={tab !== 'writing'} className="space-y-3">
        <h2 className="font-serif font-medium text-base text-[var(--editor-ink)]">精选文章</h2>
        <FeaturedPostPicker selected={draft.featuredPostSlugs} onChange={slugs=>setDraft(current=>({...current,featuredPostSlugs:slugs}))} />
      </section>
    </div>
  )
}

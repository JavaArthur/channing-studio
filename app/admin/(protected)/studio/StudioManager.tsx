'use client'

import { FeaturedPostPicker } from '@/components/FeaturedPostPicker'
import { useState } from 'react'
import {
  type StudioCapability,
  type StudioContent,
  type StudioLab,
  type StudioProject,
} from '@/lib/studio-content'

interface StudioManagerProps {
  initialRevision: number
  initialContent: StudioContent
}

const inputClass = 'w-full rounded-lg border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2.5 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--editor-accent)] focus:ring-2 focus:ring-[var(--editor-accent)]/15'
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
  const [draft, setDraft] = useState<StudioContent>(initialContent)
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

  const updateProject = (index: number, patch: Partial<StudioProject>) => {
    setDraft((current) => ({ ...current, projects: updateAt(current.projects, index, patch) }))
  }

  const updateLab = (index: number, patch: Partial<StudioLab>) => {
    setDraft((current) => ({ ...current, labs: updateAt(current.labs, index, patch) }))
  }

  const removeCapability = (index: number) => setDraft((current) => ({ ...current, profile: { ...current.profile, capabilities: current.profile.capabilities.filter((_, itemIndex) => itemIndex !== index) } }))
  const removeProject = (index: number) => setDraft((current) => ({ ...current, projects: current.projects.filter((_, itemIndex) => itemIndex !== index) }))
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
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--editor-ink)]">工作室内容</h1>
          <p className="mt-1 text-sm text-[var(--editor-muted)]">在这里编辑公开页面的内容。私人项目的展示摘要在“项目”中单独管理。</p>
        </div>
        <button onClick={save} disabled={saving} className="rounded-lg bg-[var(--editor-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-50">
          {saving ? '保存中…' : '保存工作室内容'}
        </button>
      </div>

      {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <section className="space-y-4">
        <div><h2 className="text-base font-semibold text-[var(--editor-ink)]">身份区</h2><p className="mt-1 text-xs text-[var(--editor-muted)]">首页首屏和关于我页面共用。</p></div>
        <div className={`${cardClass} grid gap-4 sm:grid-cols-2`}>
          <label className="text-sm text-[var(--editor-muted)]">眉题<input className={`${inputClass} mt-1`} value={draft.profile.eyebrow} onChange={(event) => updateProfile('eyebrow', event.target.value)} /></label>
          <label className="text-sm text-[var(--editor-muted)]">副标题<input className={`${inputClass} mt-1`} value={draft.profile.subtitle} onChange={(event) => updateProfile('subtitle', event.target.value)} /></label>
          <label className="text-sm text-[var(--editor-muted)] sm:col-span-2">主标题<textarea className={`${inputClass} mt-1 min-h-20 resize-y`} value={draft.profile.title} onChange={(event) => updateProfile('title', event.target.value)} /></label>
          <label className="text-sm text-[var(--editor-muted)] sm:col-span-2">主张<textarea className={`${inputClass} mt-1 min-h-24 resize-y`} value={draft.profile.statement} onChange={(event) => updateProfile('statement', event.target.value)} /></label>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3"><div><h2 className="text-base font-semibold text-[var(--editor-ink)]">能力卡</h2><p className="mt-1 text-xs text-[var(--editor-muted)]">首页展示三张，关于我页面也会使用。</p></div><button type="button" onClick={() => setDraft((current) => ({ ...current, profile: { ...current.profile, capabilities: [...current.profile.capabilities, { title: '', description: '' }] } }))} className="rounded-lg bg-[var(--editor-soft)] px-3 py-2 text-xs font-medium text-[var(--editor-ink)]">+ 添加能力</button></div>
        <div className="space-y-3">
          {draft.profile.capabilities.map((capability, index) => (
            <div key={index} className={`${cardClass} grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-start`}>
              <input className={inputClass} placeholder="能力名称" value={capability.title} onChange={(event) => updateCapability(index, { title: event.target.value })} />
              <textarea className={`${inputClass} min-h-16 resize-y`} placeholder="能力说明" value={capability.description} onChange={(event) => updateCapability(index, { description: event.target.value })} />
              <button type="button" onClick={() => removeCapability(index)} className="text-xs text-rose-500 hover:underline">删除</button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3"><div><h2 className="text-base font-semibold text-[var(--editor-ink)]">作品</h2><p className="mt-1 text-xs text-[var(--editor-muted)]">数组顺序就是首页和作品页的展示顺序。</p></div><button type="button" onClick={() => setDraft((current) => ({ ...current, projects: [...current.projects, { id: crypto.randomUUID(), title: '', description: '', href: '/', tags: [], visible: true }] }))} className="rounded-lg bg-[var(--editor-soft)] px-3 py-2 text-xs font-medium text-[var(--editor-ink)]">+ 添加作品</button></div>
        <div className="space-y-3">
          {draft.projects.map((project, index) => (
            <div key={`${index}-${project.id}`} className={cardClass}>
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputClass} placeholder="内部 ID" value={project.id} onChange={(event) => updateProject(index, { id: event.target.value })} />
                <input className={inputClass} placeholder="作品名称" value={project.title} onChange={(event) => updateProject(index, { title: event.target.value })} />
                <input className={inputClass} placeholder="链接" value={project.href} onChange={(event) => updateProject(index, { href: event.target.value })} />
                <input className={inputClass} placeholder="技术标签，用逗号分隔" value={project.tags.join(', ')} onChange={(event) => updateProject(index, { tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} />
                <textarea className={`${inputClass} min-h-20 resize-y sm:col-span-2`} placeholder="作品说明" value={project.description} onChange={(event) => updateProject(index, { description: event.target.value })} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--editor-muted)]">
                <label className="flex items-center gap-2"><input type="checkbox" checked={project.visible} onChange={(event) => updateProject(index, { visible: event.target.checked })} />公开显示</label>
                <button type="button" onClick={() => setDraft((current) => ({ ...current, projects: moveAt(current.projects, index, -1) }))} className="hover:text-[var(--editor-ink)]">上移</button>
                <button type="button" onClick={() => setDraft((current) => ({ ...current, projects: moveAt(current.projects, index, 1) }))} className="hover:text-[var(--editor-ink)]">下移</button>
                <button type="button" onClick={() => removeProject(index)} className="text-rose-500 hover:underline">删除</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3"><div><h2 className="text-base font-semibold text-[var(--editor-ink)]">实验室</h2><p className="mt-1 text-xs text-[var(--editor-muted)]">工具链、Skill 和正在验证的工作流。</p></div><button type="button" onClick={() => setDraft((current) => ({ ...current, labs: [...current.labs, { id: crypto.randomUUID(), title: '', description: '', href: '/', type: 'tool', visible: true }] }))} className="rounded-lg bg-[var(--editor-soft)] px-3 py-2 text-xs font-medium text-[var(--editor-ink)]">+ 添加实验</button></div>
        <div className="space-y-3">
          {draft.labs.map((lab, index) => (
            <div key={`${index}-${lab.id}`} className={cardClass}>
              <div className="grid gap-3 sm:grid-cols-2">
                <input className={inputClass} placeholder="内部 ID" value={lab.id} onChange={(event) => updateLab(index, { id: event.target.value })} />
                <input className={inputClass} placeholder="名称" value={lab.title} onChange={(event) => updateLab(index, { title: event.target.value })} />
                <input className={inputClass} placeholder="类型，例如 tool / skill" value={lab.type} onChange={(event) => updateLab(index, { type: event.target.value })} />
                <input className={inputClass} placeholder="链接" value={lab.href} onChange={(event) => updateLab(index, { href: event.target.value })} />
                <textarea className={`${inputClass} min-h-20 resize-y sm:col-span-2`} placeholder="实验说明" value={lab.description} onChange={(event) => updateLab(index, { description: event.target.value })} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--editor-muted)]">
                <label className="flex items-center gap-2"><input type="checkbox" checked={lab.visible} onChange={(event) => updateLab(index, { visible: event.target.checked })} />公开显示</label>
                <button type="button" onClick={() => setDraft((current) => ({ ...current, labs: moveAt(current.labs, index, -1) }))} className="hover:text-[var(--editor-ink)]">上移</button>
                <button type="button" onClick={() => setDraft((current) => ({ ...current, labs: moveAt(current.labs, index, 1) }))} className="hover:text-[var(--editor-ink)]">下移</button>
                <button type="button" onClick={() => removeLab(index)} className="text-rose-500 hover:underline">删除</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3"><h2 className="font-semibold">联系链接</h2>{draft.profile.contactLinks.map((link,index) => <div key={index} className="flex gap-3"><input aria-label="链接名称" className={inputClass} value={link.label} onChange={e=>setDraft(c=>({...c,profile:{...c.profile,contactLinks:updateAt(c.profile.contactLinks,index,{label:e.target.value})}}))}/><input aria-label="链接地址" className={inputClass} value={link.url} onChange={e=>setDraft(c=>({...c,profile:{...c.profile,contactLinks:updateAt(c.profile.contactLinks,index,{url:e.target.value})}}))}/><button onClick={()=>setDraft(c=>({...c,profile:{...c.profile,contactLinks:c.profile.contactLinks.filter((_,i)=>i!==index)}}))}>移除</button></div>)}<button className="brain-secondary" onClick={()=>setDraft(c=>({...c,profile:{...c.profile,contactLinks:[...c.profile.contactLinks,{label:'',url:'',openInNewTab:true}]}}))}>添加链接</button></section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--editor-ink)]">精选文章</h2>
        <FeaturedPostPicker selected={draft.featuredPostSlugs} onChange={slugs=>setDraft(current=>({...current,featuredPostSlugs:slugs}))} />
      </section>
    </div>
  )
}

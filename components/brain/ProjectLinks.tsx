'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ProjectLink } from '@/lib/repositories/project-links'

const names = { note: '笔记', post: '文章', tool: '工具', prompt: '提示词' }

export function ProjectLinks({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false)
  const [links, setLinks] = useState<ProjectLink[]>([])
  const [choices, setChoices] = useState<ProjectLink[]>([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load(search?: string) {
    const response = await fetch(
      `/api/admin/brain/projects?project=${encodeURIComponent(projectId)}${search !== undefined ? `&q=${encodeURIComponent(search)}` : ''}`,
    )
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || '资料加载失败')
    if (search !== undefined) setChoices(data.items)
    else setLinks(data.items)
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  async function change(item: ProjectLink, remove = false) {
    const response = await fetch('/api/admin/brain/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'link',
        id: projectId,
        kind: item.kind,
        target_id: item.id,
        remove,
      }),
    })
    if (!response.ok) throw new Error((await response.json()).error || '关联失败')
    await load()
  }

  return (
    <div className="mt-4 border-t border-[var(--editor-line)] pt-3 text-xs">
      <button
        className="min-h-11 min-w-11 font-medium text-[var(--atelier-vermilion)] hover:underline"
        onClick={() => {
          setOpen(!open)
          if (!open) void run(() => load())
        }}
        aria-expanded={open}
      >
        相关资料 {open ? '−' : '+'}
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-[var(--stone-gray)]">
            关联仅用于私人项目，不会随公开摘要展示。
          </p>
          {links.map((item) => (
            <div className="flex items-center justify-between gap-3" key={`${item.kind}:${item.id}`}>
              <Link
                className="min-h-11 min-w-11 inline-flex items-center truncate text-[var(--editor-ink)] hover:text-[var(--atelier-vermilion)]"
                href={item.href}
              >
                {names[item.kind]} · {item.title}
              </Link>
              <button
                disabled={busy}
                onClick={() => void run(() => change(item, true))}
                className="min-h-11 min-w-11 shrink-0 text-xs text-[var(--stone-gray)] hover:text-[var(--danger)]"
              >
                取消关联
              </button>
            </div>
          ))}
          {!links.length && <p className="text-xs text-[var(--stone-gray)]">还没有关联资料。</p>}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void run(() => load(query))
            }}
          >
            <input
              className="min-h-11 min-w-11 brain-input"
              placeholder="按标题查找资料"
              aria-label="按标题查找资料"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button disabled={busy} className="min-h-11 min-w-11 brain-secondary shrink-0">
              查找
            </button>
          </form>
          {choices
            .filter((item) => !links.some((link) => link.kind === item.kind && link.id === item.id))
            .map((item) => (
              <div
                className="flex items-center justify-between gap-3"
                key={`${item.kind}:${item.id}`}
              >
                <span className="min-w-0 truncate text-[var(--editor-ink)]">
                  {names[item.kind]} · {item.title}
                </span>
                <button
                  disabled={busy}
                  className="min-h-11 min-w-11 shrink-0 font-medium text-[var(--atelier-vermilion)] hover:underline"
                  onClick={() => void run(() => change(item))}
                >
                  关联
                </button>
              </div>
            ))}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  )
}

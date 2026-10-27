'use client'

import { ProjectLinks } from './ProjectLinks'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, ArrowUpRight, Archive, BookOpen, FilePenLine, X, LockKeyhole } from 'lucide-react'
import type { BrainItem, BrainKind } from '@/lib/repositories/brain'

const labels = {
  inbox: ['收件箱', '先收下来，稍后再整理。', '收集一条想法'],
  notes: ['知识笔记', '把值得留下的内容整理成自己的知识。', '新建笔记'],
  projects: ['我的项目', '记录下一步，让重要的事情持续向前。', '新建项目'],
}
const blank = {
  title: '',
  content: '',
  description: '',
  next_action: '',
  source_url: '',
  status: 'active',
}
export function BrainCollection({
  kind,
  items,
  total,
  page,
  archived,
  query,
}: {
  kind: BrainKind
  items: BrainItem[]
  total: number
  page: number
  archived: boolean
  query: string
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<string | null | undefined>(undefined)
  const [form, setForm] = useState(blank)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [title, description, action] = labels[kind]
  const set = (key: keyof typeof blank, value: string) => setForm((f) => ({ ...f, [key]: value }))
  const open = (item?: BrainItem) => {
    setEditing(item?.id ?? null)
    setForm(
      item
        ? {
            title: item.title,
            content: item.content ?? '',
            description: item.description ?? '',
            next_action: item.next_action ?? '',
            source_url: item.source_url ?? '',
            status: item.status ?? 'active',
          }
        : blank,
    )
    setFeedback('')
  }
  async function mutate(body: Record<string, unknown>) {
    setBusy(true)
    setFeedback('')
    try {
      const response = await fetch(`/api/admin/brain/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '保存失败')
      setFeedback('已保存。')
      setEditing(undefined)
      router.refresh()
      if (data.target?.kind === 'post')
        router.push(`/editor?edit=${encodeURIComponent(data.target.id)}`)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }
  const base = `/admin/${kind}`
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="brain-kicker">Personal workspace</p>
          <h1 className="font-serif font-medium mt-3 text-3xl tracking-tight">{title}</h1>
          <p className="mt-3 text-sm text-[var(--editor-muted)]">{description}</p>
        </div>
        <button className="min-h-11 min-w-11 brain-button brain-cta" onClick={() => open()}>
          <Plus size={16} />
          {action}
        </button>
      </header>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <form className="flex gap-2" action={base}>
          <input
            className="min-h-11 min-w-11 brain-input"
            name="q"
            defaultValue={query}
            placeholder="搜索标题"
            aria-label="搜索标题"
          />
          {archived && <input type="hidden" name="archived" value="1" />}
          <button className="min-h-11 min-w-11 brain-secondary">搜索</button>
        </form>
        <div className="flex items-center gap-4 text-sm">
          <Link className={`min-h-11 min-w-11 inline-flex items-center ${!archived ? 'text-[var(--editor-accent)]' : ''}`} href={base}>
            当前
          </Link>
          <Link
            className={`min-h-11 min-w-11 inline-flex items-center ${archived ? 'text-[var(--editor-accent)]' : ''}`}
            href={`${base}?archived=1`}
          >
            已归档
          </Link>
          <span className="text-[var(--editor-muted)]">{total} 项</span>
        </div>
      </div>
      {feedback && (
        <p role="status" className="rounded-xl border border-[var(--editor-line)] p-4 text-sm">
          {feedback}
        </p>
      )}
      {editing !== undefined && (
        <form
          className="brain-panel space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void mutate({ ...form, id: editing ?? undefined, action: 'save' })
          }}
        >
          <div className="flex justify-between">
            <h2 className="font-serif font-medium">{editing ? '编辑' : action}</h2>
            <button type="button" aria-label="关闭编辑" onClick={() => setEditing(undefined)} className="min-h-11 min-w-11">
              <X size={18} />
            </button>
          </div>
          <label className="block text-sm">
            标题
            <input
              autoFocus
              required
              maxLength={200}
              className="min-h-11 min-w-11 brain-input mt-2"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </label>
          {kind === 'projects' ? (
            <>
              <label className="block text-sm">
                私人项目说明
                <textarea
                  className="min-h-11 min-w-11 brain-input mt-2 min-h-32"
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                />
              </label>
              <label className="block text-sm">
                下一步
                <input
                  className="min-h-11 min-w-11 brain-input mt-2"
                  value={form.next_action}
                  onChange={(e) => set('next_action', e.target.value)}
                  placeholder="写下一件可以行动的小事"
                />
              </label>
              <label className="block text-sm">
                状态
                <select
                  className="min-h-11 min-w-11 brain-input mt-2"
                  value={form.status}
                  onChange={(e) => set('status', e.target.value)}
                >
                  <option value="active">进行中</option>
                  <option value="paused">暂缓</option>
                  <option value="done">完成</option>
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="block text-sm">
                内容
                <textarea
                  className="min-h-11 min-w-11 brain-input mt-2 min-h-48"
                  value={form.content}
                  onChange={(e) => set('content', e.target.value)}
                />
              </label>
              <label className="block text-sm">
                来源链接（可选）
                <input
                  type="url"
                  className="min-h-11 min-w-11 brain-input mt-2"
                  value={form.source_url}
                  onChange={(e) => set('source_url', e.target.value)}
                />
              </label>
            </>
          )}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs text-[var(--editor-muted)]">
              <LockKeyhole size={14} />
              仅自己可见
            </span>
            <button className="min-h-11 min-w-11 brain-button" disabled={busy}>
              保存
            </button>
          </div>
        </form>
      )}
      <div className={kind === 'projects' ? 'grid gap-4 lg:grid-cols-2' : 'space-y-3'}>
        {items.length === 0 && (
          <div className="brain-panel col-span-full py-14 text-center">
            <BookOpen className="mx-auto mb-4 text-[var(--editor-muted)]" size={28} />
            <h2 className="font-serif font-medium">
              {query
                ? '没有找到匹配内容'
                : archived
                  ? '还没有归档内容'
                  : '从一条值得留下的内容开始'}
            </h2>
            <p className="mt-2 text-sm text-[var(--editor-muted)]">
              {query ? '试试其他关键词。' : '不必一次整理完，先保存下来就好。'}
            </p>
          </div>
        )}
        {items.map((item) => (
          <article id={item.id} className="brain-panel scroll-mt-24" key={item.id}>
            <div className="flex justify-between gap-4">
              <h2 className="font-serif font-medium">{item.title}</h2>
              <span className="shrink-0 text-xs text-[var(--editor-muted)]">
                {item.status === 'organized'
                    ? '已整理'
                    : '私密'}
              </span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--editor-muted)]">
              {item.description || item.content || '暂时只有一个标题。'}
            </p>
            {item.next_action && (
              <p className="mt-5 rounded-lg bg-[var(--editor-soft)] p-3 text-sm">
                下一步 · {item.next_action}
              </p>
            )}
            {item.source_url && (
              <a
                className="min-h-11 min-w-11 mt-3 inline-flex items-center gap-1 text-sm text-[var(--editor-accent)]"
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                查看来源
                <ArrowUpRight size={14} />
              </a>
            )}
            {item.target_id && (
              <Link
                className="min-h-11 min-w-11 mt-3 block text-sm text-[var(--editor-accent)]"
                href={
                  item.target_type === 'post'
                    ? `/editor?edit=${encodeURIComponent(item.target_id)}`
                    : '/admin/notes'
                }
              >
                打开整理后的内容 →
              </Link>
            )}
            <div className="mt-6 flex flex-wrap gap-4 text-xs text-[var(--editor-muted)]">
              <button disabled={busy} onClick={() => open(item)} className="min-h-11 min-w-11">
                编辑
              </button>
              {kind === 'inbox' && item.status === 'inbox' && (
                <>
                  <button
                    disabled={busy}
                    onClick={() => void mutate({ id: item.id, action: 'convert', target: 'note' })} className="min-h-11 min-w-11"
                  >
                    整理为笔记
                  </button>
                  <button
                    disabled={busy}
                    className="min-h-11 min-w-11 inline-flex items-center gap-1"
                    onClick={() => void mutate({ id: item.id, action: 'convert', target: 'post' })}
                  >
                    <FilePenLine size={13} />
                    转为文章草稿
                  </button>
                </>
              )}
              {kind === 'notes' && !archived && (
                <button
                  disabled={busy}
                  onClick={() => void mutate({ id: item.id, action: 'draft' })} className="min-h-11 min-w-11"
                >
                  转为文章草稿
                </button>
              )}
              <button
                disabled={busy}
                className="min-h-11 min-w-11 ml-auto inline-flex items-center gap-1"
                onClick={() =>
                  void mutate({ id: item.id, action: archived ? 'restore' : 'archive' })
                }
              >
                <Archive size={13} />
                {archived ? '恢复' : '归档'}
              </button>
            </div>
            {kind === 'projects' && <ProjectLinks projectId={item.id} />}
          </article>
        ))}
      </div>
      {total > 30 && (
        <nav className="flex justify-between text-sm">
          {page > 1 ? (
            <Link
              href={`${base}?page=${page - 1}&q=${encodeURIComponent(query)}&archived=${archived ? '1' : '0'}`} className="min-h-11 min-w-11 inline-flex items-center"
            >
              上一页
            </Link>
          ) : (
            <span />
          )}
          <span>
            {page} / {Math.ceil(total / 30)}
          </span>
          {page * 30 < total && (
            <Link
              href={`${base}?page=${page + 1}&q=${encodeURIComponent(query)}&archived=${archived ? '1' : '0'}`} className="min-h-11 min-w-11 inline-flex items-center"
            >
              下一页
            </Link>
          )}
        </nav>
      )}
    </div>
  )
}

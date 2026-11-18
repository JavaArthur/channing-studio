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
    <div className="atelier-surface-page space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--editor-line)] pb-5">
        <div>
          <p className="atelier-kicker">
            <span className="atelier-beacon" data-tone="vermilion" aria-hidden="true" />
            WORKBENCH // PRIVATE VAULT
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--editor-ink)]">
            {title}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--editor-muted)]">{description}</p>
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
        <div className="flex items-center gap-4 text-xs">
          <Link
            className={`min-h-11 min-w-11 inline-flex items-center ${
              !archived
                ? 'font-semibold text-[var(--atelier-vermilion)]'
                : 'text-[var(--editor-muted)]'
            }`}
            href={base}
          >
            当前
          </Link>
          <Link
            className={`min-h-11 min-w-11 inline-flex items-center ${
              archived
                ? 'font-semibold text-[var(--atelier-vermilion)]'
                : 'text-[var(--editor-muted)]'
            }`}
            href={`${base}?archived=1`}
          >
            已归档
          </Link>
          <span className="atelier-mono text-[var(--stone-gray)]">{total} 项</span>
        </div>
      </div>

      {feedback && (
        <p
          role="status"
          className="rounded-[var(--radius-sm)] border border-[var(--editor-line)] bg-[var(--editor-soft)] px-4 py-3 text-xs text-[var(--editor-ink)]"
        >
          {feedback}
        </p>
      )}

      {editing !== undefined && (
        <form
          className="atelier-dossier space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault()
            void mutate({ ...form, id: editing ?? undefined, action: 'save' })
          }}
        >
          <div className="flex items-center justify-between border-b border-[var(--editor-line)] pb-3">
            <h2 className="text-sm font-semibold text-[var(--editor-ink)]">
              {editing ? '编辑' : action}
            </h2>
            <button
              type="button"
              aria-label="关闭编辑"
              onClick={() => setEditing(undefined)}
              className="min-h-11 min-w-11 inline-flex items-center justify-center text-[var(--stone-gray)] hover:text-[var(--editor-ink)]"
            >
              <X size={18} />
            </button>
          </div>
          <label className="block text-xs text-[var(--editor-muted)]">
            标题
            <input
              autoFocus
              required
              maxLength={200}
              className="min-h-11 min-w-11 brain-input mt-1.5"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
            />
          </label>
          {kind === 'projects' ? (
            <>
              <label className="block text-xs text-[var(--editor-muted)]">
                私人项目说明
                <textarea
                  className="min-h-11 min-w-11 brain-input mt-1.5 min-h-32"
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                />
              </label>
              <label className="block text-xs text-[var(--editor-muted)]">
                下一步
                <input
                  className="min-h-11 min-w-11 brain-input mt-1.5"
                  value={form.next_action}
                  onChange={(e) => set('next_action', e.target.value)}
                  placeholder="写下一件可以行动的小事"
                />
              </label>
              <label className="block text-xs text-[var(--editor-muted)]">
                状态
                <select
                  className="min-h-11 min-w-11 brain-input mt-1.5"
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
              <label className="block text-xs text-[var(--editor-muted)]">
                内容
                <textarea
                  className="min-h-11 min-w-11 brain-input mt-1.5 min-h-48"
                  value={form.content}
                  onChange={(e) => set('content', e.target.value)}
                />
              </label>
              <label className="block text-xs text-[var(--editor-muted)]">
                来源链接（可选）
                <input
                  type="url"
                  className="min-h-11 min-w-11 brain-input mt-1.5"
                  value={form.source_url}
                  onChange={(e) => set('source_url', e.target.value)}
                />
              </label>
            </>
          )}
          <div className="flex items-center justify-between border-t border-[var(--editor-line)] pt-3">
            <span className="flex items-center gap-1.5 text-xs text-[var(--stone-gray)]">
              <LockKeyhole size={13} />
              仅自己可见
            </span>
            <button className="min-h-11 min-w-11 brain-button brain-cta" disabled={busy}>
              保存
            </button>
          </div>
        </form>
      )}

      <div className={kind === 'projects' ? 'grid gap-4 lg:grid-cols-2' : 'space-y-3'}>
        {items.length === 0 && (
          <div className="atelier-dossier atelier-crosshair col-span-full py-14 text-center">
            <BookOpen className="mx-auto mb-4 text-[var(--stone-gray)]" size={26} />
            <h2 className="font-medium text-[var(--editor-ink)]">
              {query
                ? '没有找到匹配内容'
                : archived
                  ? '还没有归档内容'
                  : '从一条值得留下的内容开始'}
            </h2>
            <p className="mt-2 text-xs text-[var(--editor-muted)]">
              {query ? '试试其他关键词。' : '不必一次整理完，先保存下来就好。'}
            </p>
          </div>
        )}
        {items.map((item) => (
          <article id={item.id} className="atelier-dossier scroll-mt-24 p-5" key={item.id}>
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-semibold text-[var(--editor-ink)]">{item.title}</h2>
              <span className="atelier-badge shrink-0">
                {item.status === 'organized' ? '已整理' : '私密'}
              </span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--editor-muted)]">
              {item.description || item.content || '暂时只有一个标题。'}
            </p>
            {item.next_action && (
              <p className="mt-4 rounded-[var(--radius-sm)] border border-[var(--editor-line)] bg-[var(--editor-soft)] p-3 text-xs text-[var(--editor-ink)]">
                下一步 · {item.next_action}
              </p>
            )}
            {item.source_url && (
              <a
                className="min-h-11 min-w-11 mt-3 inline-flex items-center gap-1 text-xs text-[var(--atelier-vermilion)] hover:underline"
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                查看来源
                <ArrowUpRight size={13} />
              </a>
            )}
            {item.target_id && (
              <Link
                className="min-h-11 min-w-11 mt-3 block text-xs text-[var(--atelier-vermilion)] hover:underline"
                href={
                  item.target_type === 'post'
                    ? `/editor?edit=${encodeURIComponent(item.target_id)}`
                    : '/admin/notes'
                }
              >
                打开整理后的内容 →
              </Link>
            )}
            <div className="mt-5 flex flex-wrap gap-3 border-t border-[var(--editor-line)] pt-3 text-xs text-[var(--editor-muted)]">
              <button
                disabled={busy}
                onClick={() => open(item)}
                className="min-h-11 min-w-11 hover:text-[var(--editor-ink)]"
              >
                编辑
              </button>
              {kind === 'inbox' && item.status === 'inbox' && (
                <>
                  <button
                    disabled={busy}
                    onClick={() => void mutate({ id: item.id, action: 'convert', target: 'note' })}
                    className="min-h-11 min-w-11 hover:text-[var(--editor-ink)]"
                  >
                    整理为笔记
                  </button>
                  <button
                    disabled={busy}
                    className="min-h-11 min-w-11 inline-flex items-center gap-1 hover:text-[var(--editor-ink)]"
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
                  onClick={() => void mutate({ id: item.id, action: 'draft' })}
                  className="min-h-11 min-w-11 hover:text-[var(--editor-ink)]"
                >
                  转为文章草稿
                </button>
              )}
              <button
                disabled={busy}
                className="min-h-11 min-w-11 ml-auto inline-flex items-center gap-1 hover:text-[var(--editor-ink)]"
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
        <nav className="flex items-center justify-between text-xs">
          {page > 1 ? (
            <Link
              href={`${base}?page=${page - 1}&q=${encodeURIComponent(query)}&archived=${archived ? '1' : '0'}`}
              className="min-h-11 min-w-11 inline-flex items-center text-[var(--atelier-vermilion)]"
            >
              上一页
            </Link>
          ) : (
            <span />
          )}
          <span className="atelier-mono text-[var(--stone-gray)]">
            {page} / {Math.ceil(total / 30)}
          </span>
          {page * 30 < total && (
            <Link
              href={`${base}?page=${page + 1}&q=${encodeURIComponent(query)}&archived=${archived ? '1' : '0'}`}
              className="min-h-11 min-w-11 inline-flex items-center text-[var(--atelier-vermilion)]"
            >
              下一页
            </Link>
          )}
        </nav>
      )}
    </div>
  )
}

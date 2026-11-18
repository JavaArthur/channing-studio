'use client'

import Link from 'next/link'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight } from 'lucide-react'
import { useToast } from '@/components/Toast'
import type { XDraft } from '@/lib/repositories/x-drafts'
import { countXChars, isHttpUrl, SOURCE_TYPES, X_CHAR_LIMIT } from '@/lib/x-drafts/text'

const statuses = { pending: '待发', posted: '已发', discarded: '放弃', all: '全部' }
const ranges = [
  ['today', '今天'],
  ['7', '近 7 天'],
  ['30', '近 30 天'],
  ['all', '全部'],
] as const

const inputClass =
  'w-full min-w-0 rounded-[var(--radius-sm)] border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--editor-ink)] outline-none focus:border-[var(--focus-ring)]'
const tabClass = (selected: boolean) =>
  `brain-secondary min-h-[44px] ${
    selected
      ? 'bg-[var(--editor-accent)]! text-[var(--editor-accent-ink)]! border-[var(--editor-accent)]! font-medium'
      : ''
  }`

function CharacterCount({ count }: { count: number }) {
  return (
    <p
      aria-live="polite"
      className={`atelier-mono text-xs ${count > X_CHAR_LIMIT ? 'text-[var(--danger)]' : 'text-[var(--editor-muted)]'}`}
    >
      {count} / {X_CHAR_LIMIT}
      {count > X_CHAR_LIMIT &&
        ` · 超出 ${count - X_CHAR_LIMIT} · 按 X 规则计数（中文算 2，链接算 23）`}
    </p>
  )
}

async function save(url: string, method: string, body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (response.status === 412) throw new Error('草稿已被修改，请刷新页面后重试。')
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || '操作失败')
  return data.draft as XDraft
}

async function copyContent(content: string) {
  try {
    await navigator.clipboard.writeText(content)
  } catch {
    const previous = document.activeElement as HTMLElement | null
    const textarea = document.createElement('textarea')
    textarea.value = content
    textarea.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none'
    textarea.setAttribute('aria-hidden', 'true')
    document.body.appendChild(textarea)
    try {
      textarea.focus()
      textarea.select()
      if (!document.execCommand('copy')) throw new Error('复制失败，请手动复制正文。')
    } finally {
      textarea.remove()
      previous?.focus()
    }
  }
}

function DraftCard({ draft }: { draft: XDraft }) {
  const router = useRouter()
  const toast = useToast()
  const urlErrorId = useId()
  const [posting, setPosting] = useState(false)
  const [postedUrl, setPostedUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const [urlError, setUrlError] = useState('')

  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(''), 2500)
    return () => clearTimeout(timer)
  }, [feedback])

  async function update(changes: { status: XDraft['status']; posted_url?: string | null }) {
    setBusy(true)
    setError('')
    setFeedback('')
    try {
      const url = `/api/admin/x-drafts/${encodeURIComponent(draft.id)}`
      const previous = { status: draft.status, posted_url: draft.posted_url }
      const updated = await save(url, 'PATCH', { expected_revision: draft.revision, changes })
      toast.success(
        changes.status === 'posted'
          ? '已标记已发'
          : changes.status === 'discarded'
            ? '已放弃'
            : '已恢复待发',
        6000,
        {
          label: '撤销',
          onClick: () => {
            void save(url, 'PATCH', { expected_revision: updated.revision, changes: previous })
              .then(() => {
                router.refresh()
                toast.info('已撤销', 2500)
              })
              .catch((err) => toast.error(err instanceof Error ? err.message : '撤销失败'))
          },
        },
      )
      setPosting(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  const beaconTone =
    draft.status === 'posted' ? 'healthy' : draft.status === 'pending' ? 'warning' : undefined

  return (
    <article
      className="atelier-dossier min-w-0 space-y-4 p-5"
      style={{ overflowWrap: 'anywhere' }}
    >
      <div className="flex flex-wrap items-center gap-2.5 text-xs text-[var(--editor-muted)]">
        <span
          className="atelier-badge"
          data-tone={draft.status === 'pending' ? 'vermilion' : undefined}
        >
          <span className="atelier-beacon" data-tone={beaconTone} aria-hidden="true" />
          {statuses[draft.status]}
        </span>
        <span className="atelier-badge">
          {Object.hasOwn(SOURCE_TYPES, draft.source_type)
            ? SOURCE_TYPES[draft.source_type as keyof typeof SOURCE_TYPES]
            : draft.source_type}
        </span>
        <time
          className="atelier-mono"
          dateTime={new Date(draft.created_at * 1000).toISOString()}
        >
          {new Intl.DateTimeFormat('zh-CN', {
            timeZone: 'Asia/Shanghai',
            dateStyle: 'medium',
            timeStyle: 'short',
            hour12: false,
          }).format(draft.created_at * 1000)}
        </time>
        {isHttpUrl(draft.source_url) && (
          <a
            href={draft.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-1 px-2 text-[var(--atelier-vermilion)] hover:underline"
          >
            来源链接
            <ArrowUpRight size={13} />
          </a>
        )}
      </div>
      <p className="text-sm leading-7 text-[var(--editor-ink)]" style={{ whiteSpace: 'pre-wrap' }}>
        {draft.content}
      </p>
      <CharacterCount count={draft.char_count} />
      {draft.status === 'posted' && isHttpUrl(draft.posted_url) && (
        <a
          className="inline-flex min-h-[44px] items-center gap-1 px-2 text-xs text-[var(--atelier-vermilion)] hover:underline"
          href={draft.posted_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          已发帖子：{draft.posted_url}
          <ArrowUpRight size={13} />
        </a>
      )}
      <div className="flex flex-wrap gap-2 border-t border-[var(--editor-line)] pt-3">
        <button
          className="brain-secondary min-h-[44px]"
          onClick={async () => {
            setError('')
            setFeedback('')
            try {
              await copyContent(draft.content)
              setFeedback('已复制到剪贴板')
            } catch (err) {
              setError(err instanceof Error ? err.message : '复制失败')
            }
          }}
        >
          一键复制
        </button>
        {draft.status === 'pending' ? (
          <button
            className="brain-secondary min-h-[44px]"
            disabled={busy}
            onClick={() => {
              setUrlError('')
              setPosting(!posting)
            }}
          >
            标记已发
          </button>
        ) : (
          <button
            className="brain-secondary min-h-[44px]"
            disabled={busy}
            onClick={() => update({ status: 'pending' })}
          >
            恢复待发
          </button>
        )}
        {draft.status !== 'discarded' && (
          <button
            className="brain-secondary min-h-[44px]"
            disabled={busy}
            onClick={() => update({ status: 'discarded' })}
          >
            放弃
          </button>
        )}
      </div>
      {posting && (
        <form
          noValidate
          className="space-y-3 border-t border-[var(--editor-line)] pt-3"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              setPosting(false)
              setUrlError('')
            }
          }}
          onSubmit={(event) => {
            event.preventDefault()
            const url = postedUrl.trim()
            if (url && (!isHttpUrl(url) || url.length > 2000)) {
              setUrlError('请输入有效的 HTTP(S) 链接（最多 2000 字符），或留空。')
              return
            }
            setUrlError('')
            void update({ status: 'posted', posted_url: url || null })
          }}
        >
          <label className="block space-y-2 text-xs text-[var(--editor-muted)]">
            <span>帖子链接（可选）</span>
            <input
              autoFocus
              className={inputClass}
              type="url"
              value={postedUrl}
              aria-invalid={!!urlError}
              aria-describedby={urlError ? urlErrorId : undefined}
              onChange={(event) => {
                setPostedUrl(event.target.value)
                setUrlError('')
              }}
              placeholder="https://x.com/…"
            />
          </label>
          {urlError && (
            <p id={urlErrorId} role="alert" className="text-sm text-[var(--danger)]">
              {urlError}
            </p>
          )}
          <button className="brain-button brain-cta min-h-[44px]" disabled={busy}>
            确认已发
          </button>
        </form>
      )}
      {feedback && (
        <p role="status" className="text-xs text-[var(--success)]">
          {feedback}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-[var(--danger)]">
          {error}
        </p>
      )}
    </article>
  )
}

export function XDraftBoard({
  items,
  total,
  page,
  has_more,
  status,
  range,
  query,
}: {
  items: XDraft[]
  total: number
  page: number
  has_more: boolean
  status: keyof typeof statuses
  range: string
  query: string
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [content, setContent] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceType, setSourceType] = useState('other')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function href(changes: Record<string, string>) {
    return `/admin/x-drafts?${new URLSearchParams({ status, range, q: query, page: '1', ...changes })}`
  }

  async function create(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await save('/api/admin/x-drafts', 'POST', {
        content,
        source_url: sourceUrl || null,
        source_type: sourceType,
      })
      setCreating(false)
      setContent('')
      setSourceUrl('')
      setSourceType('other')
      router.push('/admin/x-drafts')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败')
    } finally {
      setBusy(false)
    }
  }

  const count = countXChars(content)

  return (
    <div className="atelier-surface-page min-w-0 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--editor-line)] pb-5">
        <div>
          <p className="atelier-kicker">
            <span className="atelier-beacon" data-tone="vermilion" aria-hidden="true" />
            DISPATCH // X DRAFTS
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--editor-ink)]">
            X 短帖草稿
          </h1>
          <p className="mt-1.5 text-sm text-[var(--editor-muted)]">
            收集短帖灵感，复制后发布，记录每一次分享。
          </p>
        </div>
        <button
          className={`min-h-[44px] ${creating ? 'brain-secondary' : 'brain-button brain-cta'}`}
          onClick={() => setCreating(!creating)}
        >
          {creating ? '取消新建' : '新建草稿'}
        </button>
      </header>

      {creating && (
        <form onSubmit={create} className="atelier-dossier min-w-0 space-y-4 p-5">
          <label className="block space-y-2 text-xs text-[var(--editor-muted)]">
            <span>正文</span>
            <textarea
              className={inputClass}
              rows={6}
              required
              maxLength={10000}
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </label>
          <CharacterCount count={count} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 text-xs text-[var(--editor-muted)]">
              <span>来源链接</span>
              <input
                className={inputClass}
                type="url"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
              />
            </label>
            <label className="block space-y-2 text-xs text-[var(--editor-muted)]">
              <span>来源类型</span>
              <select
                className={inputClass}
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value)}
              >
                {Object.entries(SOURCE_TYPES).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button className="brain-button brain-cta min-h-[44px]" disabled={busy}>
            保存草稿
          </button>
          {error && (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {error}
            </p>
          )}
        </form>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="草稿状态" className="flex flex-wrap gap-2">
          {Object.entries(statuses).map(([value, label]) => (
            <Link
              key={value}
              href={href({ status: value })}
              aria-current={status === value ? 'page' : undefined}
              className={tabClass(status === value)}
            >
              {label}
            </Link>
          ))}
        </nav>
        <nav aria-label="创建时间" className="flex flex-wrap gap-2">
          {ranges.map(([value, label]) => (
            <Link
              key={value}
              href={href({ range: value })}
              aria-current={range === value ? 'page' : undefined}
              className={tabClass(range === value)}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <form action="/admin/x-drafts" className="flex min-w-0 flex-wrap gap-2">
        <input type="hidden" name="status" value={status} />
        <input type="hidden" name="range" value={range} />
        <input
          aria-label="搜索草稿"
          name="q"
          defaultValue={query}
          maxLength={200}
          className={`${inputClass} flex-1`}
          placeholder="搜索正文"
        />
        <button className="brain-secondary min-h-[44px]">搜索</button>
      </form>

      <p className="atelier-mono text-xs text-[var(--editor-muted)]">共 {total} 条草稿</p>

      <div className="min-w-0 space-y-4">
        {items.map((draft) => (
          <DraftCard key={`${draft.id}-${draft.revision}`} draft={draft} />
        ))}
        {!items.length && (
          <div className="atelier-dossier atelier-crosshair space-y-3 p-8 text-center text-[var(--editor-muted)]">
            <p className="text-sm">
              {query.trim() || range !== 'all' || page > 1
                ? '没有符合条件的草稿'
                : status === 'pending'
                  ? '还没有待发草稿'
                  : status === 'posted'
                    ? '还没有已发的草稿'
                    : status === 'discarded'
                      ? '还没有放弃的草稿'
                      : '还没有草稿'}
            </p>
            {!query.trim() && range === 'all' && page === 1 && status === 'pending' ? (
              <button className="brain-button brain-cta min-h-[44px]" onClick={() => setCreating(true)}>
                新建草稿
              </button>
            ) : (
              <Link
                className="inline-flex min-h-[44px] items-center px-2 text-sm text-[var(--atelier-vermilion)] underline"
                href="/admin/x-drafts"
              >
                清除筛选
              </Link>
            )}
          </div>
        )}
      </div>

      <nav aria-label="分页" className="flex flex-wrap items-center gap-3">
        {page > 1 && (
          <Link className="brain-secondary min-h-[44px]" href={href({ page: String(page - 1) })}>
            上一页
          </Link>
        )}
        <span className="atelier-mono text-xs text-[var(--editor-muted)]">第 {page} 页</span>
        {has_more && (
          <Link className="brain-secondary min-h-[44px]" href={href({ page: String(page + 1) })}>
            下一页
          </Link>
        )}
      </nav>
    </div>
  )
}

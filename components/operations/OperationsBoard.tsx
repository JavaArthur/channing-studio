'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Check, Copy, MessageCircle, PenLine, Sparkles } from 'lucide-react'
import { useToast } from '@/components/Toast'
import { Button, Input } from '@/components/admin/ui'
import { useUnsavedChanges } from '@/components/admin/UnsavedChanges'
import { copyText } from '@/components/library/client'
import type { XDraft } from '@/lib/repositories/x-drafts'
import {
  X_ACCOUNTS,
  OPERATION_STATUSES,
  polishPrompt,
  type XAccountId,
} from '@/lib/x-drafts/accounts'
import { countXChars, isHttpUrl, SOURCE_TYPES, X_CHAR_LIMIT } from '@/lib/x-drafts/text'

type Status = keyof typeof OPERATION_STATUSES
function receivedAt(time: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(time * 1000)
}
function sourceLabel(type: string) {
  return Object.hasOwn(SOURCE_TYPES, type) ? SOURCE_TYPES[type as keyof typeof SOURCE_TYPES] : type
}
function DraftEditor({ draft, backHref }: { draft: XDraft; backHref: string }) {
  const router = useRouter()
  const toast = useToast()
  const [current, setCurrent] = useState(draft)
  const [text, setText] = useState(draft.edited_content ?? draft.content)
  const [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')
  const [extra, setExtra] = useState('')
  const [preview, setPreview] = useState('')
  const [polishing, setPolishing] = useState(false)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  const dirty = text !== (current.edited_content ?? current.content)
  const count = countXChars(text)
  const valid = !!text.trim() && text.length <= 10000
  async function save(status?: Status): Promise<boolean> {
    if (saving.current || !valid) return false
    saving.current = true
    setBusy(true)
    setError('')
    setFeedback('')
    try {
      const response = await fetch(`/api/admin/x-drafts/${encodeURIComponent(current.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expected_revision: current.revision,
          changes: {
            edited_content: text === current.content ? null : text,
            ...(status ? { status } : {}),
          },
        }),
      })
      if (response.status === 412)
        throw new Error('这条内容已被其他人或 Agent 修改。请先复制保留当前文案，再刷新核对。')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '保存失败，请重试。')
      setCurrent(data.draft)
      toast.success(status ? `已标记为${OPERATION_STATUSES[status]}` : '文案已保存')
      router.refresh()
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
      return false
    } finally {
      saving.current = false
      setBusy(false)
    }
  }
  useUnsavedChanges(
    dirty,
    () => save(),
    () => setText(current.edited_content ?? current.content),
  )
  async function polish() {
    if (controller.current || !valid) return
    const abort = new AbortController()
    controller.current = abort
    setPolishing(true)
    setPreview('')
    setError('')
    setFeedback('')
    try {
      const response = await fetch('/api/editor/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abort.signal,
        body: JSON.stringify({
          action: 'custom',
          text,
          customPrompt: polishPrompt(current.account_id, extra),
        }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || '润色失败，请重试或检查设置中的文本模型。')
      }
      const result = await response.text()
      if (!result.trim()) throw new Error('模型返回了空文案，请重试。')
      if (result.length > 10000) throw new Error('润色结果超过 10000 字符，请缩短要求后重试。')
      setPreview(result)
    } catch (e) {
      if (!abort.signal.aborted) setError(e instanceof Error ? e.message : '润色失败，原稿已保留。')
    } finally {
      if (!abort.signal.aborted) setPolishing(false)
      controller.current = null
    }
  }
  const accountLabel = X_ACCOUNTS[current.account_id]
  return (
    <section className="operations-editor" aria-label="文案编辑区">
      <header className="operations-editor-heading">
        <Link href={backHref} className="admin-button operations-back">
          返回列表
        </Link>
        <div>
          <h2>准备这条文案</h2>
          <p>
            {sourceLabel(current.source_type)} · {receivedAt(current.created_at)}
          </p>
        </div>
        <span className="operations-status">{OPERATION_STATUSES[current.status]}</span>
      </header>
      <section className="operations-handoff" aria-label="前往 X">
        <h3>用「{accountLabel}」去互动</h3>
        <p>跳转后请核对 X 当前登录账号，再回复或发帖。</p>
        <div className="operations-actions">
          <Button
            disabled={!valid}
            onClick={async () => {
              setError('')
              setFeedback('')
              try {
                await copyText(text)
                setFeedback('已复制文案')
              } catch {
                setError('复制失败，请手动选择文案复制。')
              }
            }}
          >
            <Copy size={15} />
            复制文案
          </Button>
          {isHttpUrl(current.source_url) ? (
            <a
              className="admin-button"
              href={current.source_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle size={15} />
              去原帖回复
              <ArrowUpRight size={14} />
            </a>
          ) : (
            <Button disabled>去原帖回复</Button>
          )}
          <a
            className="admin-button"
            href="https://x.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <PenLine size={15} />
            自己发帖
            <ArrowUpRight size={14} />
          </a>
        </div>
        {!isHttpUrl(current.source_url) && <p>这条内容没有有效的来源链接，暂时无法跳转原帖。</p>}
        {isHttpUrl(current.posted_url) && (
          <a href={current.posted_url} target="_blank" rel="noopener noreferrer">
            查看已记录的帖子
          </a>
        )}
      </section>
      <details className="operations-original">
        <summary>查看 Agent 原稿</summary>
        <p>{current.content}</p>
      </details>
      <div className="operations-writing">
        <label htmlFor="operations-working-copy">工作文案</label>
        <textarea
          id="operations-working-copy"
          value={text}
          disabled={busy}
          maxLength={10000}
          rows={6}
          onChange={(e) => {
            setText(e.target.value)
            setFeedback('')
          }}
        />
      </div>
      {text.length > 10000 && (
        <p className="operations-error">
          工作文案最多 10000 字符，请缩短后保存。Agent 原稿会完整保留。
        </p>
      )}
      <div className="operations-writing-meta">
        <span className={count > X_CHAR_LIMIT ? 'operations-warning' : ''}>
          {count} / {X_CHAR_LIMIT} 加权字符{count > X_CHAR_LIMIT && ' · 超出常规短帖长度，仍可保存'}
        </span>
        <span>{dirty ? '未保存' : '已保存'}</span>
      </div>
      <div className="operations-actions">
        <Button variant="primary" disabled={busy || !valid || !dirty} onClick={() => void save()}>
          {busy ? '保存中…' : '保存文案'}
        </Button>
      </div>
      <div className="operations-polish">
        <label htmlFor="polish-instructions">AI 润色的补充要求（可选）</label>
        <div>
          <Input
            id="polish-instructions"
            value={extra}
            maxLength={1000}
            placeholder="例如：更口语一点，保留我的观点"
            onChange={(e) => setExtra(e.target.value)}
          />
          <Button disabled={polishing || busy || !valid} onClick={() => void polish()}>
            <Sparkles size={15} />
            {polishing ? '润色中…' : 'AI 润色'}
          </Button>
        </div>
        <p>使用已配置的文本模型，只发送当前文案和润色要求。</p>
        {polishing && <p role="status">正在润色，原稿会保留。</p>}
        {!!preview && (
          <section className="operations-preview" aria-label="润色预览">
            <h3>润色预览</h3>
            <p>{preview}</p>
            <div className="operations-actions">
              <Button
                disabled={busy}
                onClick={() => {
                  setText(preview)
                  setPreview('')
                  setFeedback('已采用润色，请保存文案')
                }}
              >
                采用润色
              </Button>
              <Button onClick={() => setPreview('')}>保留当前文案</Button>
            </div>
          </section>
        )}
      </div>

      <footer className="operations-complete">
        <span>完成互动后手动标记</span>
        <div className="operations-actions">
          {current.status !== 'posted' && (
            <Button disabled={busy || !valid} onClick={() => void save('posted')}>
              <Check size={15} />
              标记已处理
            </Button>
          )}
          {current.status !== 'discarded' && (
            <Button disabled={busy || !valid} onClick={() => void save('discarded')}>
              忽略
            </Button>
          )}
          {current.status !== 'pending' && (
            <Button disabled={busy || !valid} onClick={() => void save('pending')}>
              恢复待处理
            </Button>
          )}
        </div>
      </footer>
      {feedback && (
        <p role="status" className="operations-feedback">
          {feedback}
        </p>
      )}
      {error && (
        <p role="alert" className="operations-error">
          {error}
        </p>
      )}
    </section>
  )
}
export function OperationsBoard({
  items,
  total,
  page,
  has_more,
  account,
  status,
  query,
  selected,
}: {
  items: XDraft[]
  total: number
  page: number
  has_more: boolean
  account: XAccountId
  status: Status
  query: string
  selected: XDraft | null
}) {
  const router = useRouter()
  const guard = useUnsavedChanges(false, async () => true)
  function href(changes: Record<string, string> = {}) {
    const params = new URLSearchParams({
      account_id: account,
      status,
      q: query,
      page: String(page),
      ...changes,
    })
    for (const [key, value] of [...params]) if (!value) params.delete(key)
    return `/admin/operations?${params}`
  }
  return (
    <div className={`operations-workspace ${selected ? 'operations-has-selection' : ''}`}>
      <header className="workspace-page-heading">
        <div>
          <h1>运营</h1>
          <p>挑选文案，加入自己的表达，再去 X 参与讨论。</p>
        </div>
        <span className="operations-current">当前运营：{X_ACCOUNTS[account]}</span>
      </header>
      <nav className="operations-accounts" aria-label="运营账号">
        {Object.entries(X_ACCOUNTS).map(([id, name]) => (
          <Link
            key={id}
            href={href({ account_id: id, page: '1', q: '', status: 'pending' })}
            aria-current={id === account ? 'page' : undefined}
          >
            <span className="operations-account-mark">{id === 'ai' ? 'AI' : '聊'}</span>
            <span>
              <strong>{name}</strong>
              <small>{id === 'ai' ? '开发实践与技术交流' : '娱乐话题与日常闲聊'}</small>
            </span>
          </Link>
        ))}
      </nav>
      <div className="operations-columns">
        <aside className="operations-queue" aria-label="运营内容列表">
          <nav className="operations-filters" aria-label="处理状态">
            {Object.entries(OPERATION_STATUSES).map(([id, label]) => (
              <Link
                key={id}
                href={href({ status: id, page: '1' })}
                aria-current={id === status ? 'page' : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
          <form
            className="operations-search"
            onSubmit={(e) => {
              e.preventDefault()
              const data = new FormData(e.currentTarget)
              guard(() => router.push(href({ q: String(data.get('q') || ''), page: '1' })))
            }}
          >
            <Input
              key={query}
              name="q"
              aria-label="搜索运营文案"
              defaultValue={query}
              maxLength={200}
              placeholder="搜索原稿或工作文案"
            />
            <Button type="submit">搜索</Button>
          </form>
          <p className="operations-count">
            {OPERATION_STATUSES[status]} · {total} 条
          </p>
          <div className="operations-list">
            {items.map((item) => (
              <Link
                key={item.id}
                href={href({ item: item.id })}
                aria-current={selected?.id === item.id ? 'true' : undefined}
                className="operations-item"
              >
                <p>{item.edited_content ?? item.content}</p>
                <span>
                  <span>{sourceLabel(item.source_type)}</span>
                  <time dateTime={new Date(item.created_at * 1000).toISOString()}>
                    {receivedAt(item.created_at)}
                  </time>
                </span>
              </Link>
            ))}
          </div>
          {!items.length && (
            <div className="operations-empty">
              <h2>
                {query || page > 1 ? '没有匹配的内容' : `暂无${OPERATION_STATUSES[status]}内容`}
              </h2>
              <p>
                {query || page > 1
                  ? '换个关键词，或清除筛选再看看。'
                  : status === 'pending'
                    ? `Agent 送来的${X_ACCOUNTS[account]}文案会出现在这里。`
                    : '处理过的内容会保存在这里，随时可以恢复。'}
              </p>
              {(query || page > 1) && <Link href={href({ q: '', page: '1' })}>清除筛选</Link>}
            </div>
          )}
          <nav className="operations-pagination" aria-label="运营分页">
            {page > 1 && <Link href={href({ page: String(page - 1) })}>上一页</Link>}
            <span>第 {page} 页</span>
            {has_more && <Link href={href({ page: String(page + 1) })}>下一页</Link>}
          </nav>
        </aside>
        {selected ? (
          <DraftEditor
            key={`${selected.id}:${selected.revision}`}
            draft={selected}
            backHref={href()}
          />
        ) : (
          <div className="operations-placeholder">
            <MessageCircle size={28} />
            <h2>选一条，开始今天的互动</h2>
            <p>直接使用 Agent 的文案，或按自己的想法修改。</p>
            <p>回复与发帖都由你在 X 上完成。</p>
          </div>
        )}
      </div>
    </div>
  )
}

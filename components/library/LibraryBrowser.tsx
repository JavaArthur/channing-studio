'use client'
import { useUnsavedChanges } from '@/components/admin/UnsavedChanges'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Archive,
  BookOpen,
  FileText,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Star,
  Wrench,
  X,
  Pin,
  SlidersHorizontal,
} from 'lucide-react'
import {
  libraryKey,
  libraryLabels,
  sourceHost,
  type LibraryItem,
  type LibraryQuery,
} from '@/lib/library/types'
import { Button, Menu, Modal, Select } from '@/components/admin/ui'
import { LibraryDetail } from './LibraryDetail'
import { CaptureForm } from './CaptureForm'
import { libraryRequest, type Collection } from './client'
import { useWorkspace, type Selection } from './WorkspaceState'
import { HandoffDialog } from './HandoffDialog'
import { AddCollectionItems } from './AddCollectionItems'
export { libraryRequest, type Collection } from './client'
const icons = {
  note: BookOpen,
  article: FileText,
  tool: Wrench,
  prompt: MessageSquare,
  inspiration: Sparkles,
  inbox: BookOpen,
  artifact: BookOpen,
  post: FileText,
}
const kinds = ['all', 'article', 'note', 'tool', 'prompt'] as const
export function ItemIcon({ type, size = 16 }: { type: string; size?: number }) {
  const Icon = icons[type as keyof typeof icons] || BookOpen
  return <Icon size={size} aria-hidden="true" />
}
function Highlight({ text, terms = [] }: { text: string; terms?: string[] }) {
  if (!terms.length) return <>{text}</>
  const pattern = new RegExp(
    `(${terms
      .slice()
      .sort((a, b) => b.length - a.length)
      .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')})`,
    'ig',
  )
  return (
    <>
      {text
        .split(pattern)
        .map((part, i) =>
          terms.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
            <mark key={i}>{part}</mark>
          ) : (
            part
          ),
        )}
    </>
  )
}
export function LibraryBrowser({
  items,
  total,
  page,
  hasMore,
  query,
  selected,
  html,
  collections,
}: {
  items: LibraryItem[]
  total: number
  page: number
  hasMore: boolean
  query: LibraryQuery
  selected: LibraryItem | null
  html: string
  collections: Collection[]
}) {
  const router = useRouter(),
    flush = useRef<(() => Promise<boolean>) | null>(null),
    search = useRef<HTMLInputElement>(null)
  const { checked, setChecked, usage, sync } = useWorkspace()
  const guard = useUnsavedChanges(false, async () => true)
  const [handoff, setHandoff] = useState<Selection | null>(null),
    [creating, setCreating] = useState(false),
    [adding, setAdding] = useState(false)
  const [error, setError] = useState(''),
    [focus, setFocus] = useState(false),
    [filters, setFilters] = useState(false),
    [history, setHistory] = useState(false),
    [expanded, setExpanded] = useState(false)
  const collection = collections.find((c) => c.id === query.collection),
    selection = Object.values(checked)
  const title =
    collection?.title ||
    (query.recent
      ? '最近阅读'
      : query.favorite
        ? '收藏'
        : query.decisions
          ? '待决定'
          : '资料库')
  function url(changes: Record<string, string | number | undefined>) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query))
      if (value !== undefined && value !== false)
        params.set(key, value === true ? '1' : String(value))
    for (const [key, value] of Object.entries(changes))
      if (value === undefined || value === '') params.delete(key)
      else params.set(key, String(value))
    return `/admin/library?${params}`
  }
  async function navigate(href: string) {
    if (!flush.current || (await flush.current())) router.push(href, { scroll: false })
  }
  const selectedKey = selected ? libraryKey(selected) : ''
  const readRef = useRef(selected)
  useEffect(() => {
    readRef.current = selected
  }, [selected])
  useEffect(() => {
    const item = readRef.current
    if (selectedKey && item && !item.archived)
      void sync({ action: 'read', kind: item.kind, id: item.id })
  }, [selectedKey, sync])
  useEffect(() => {
    if (new URLSearchParams(location.search).get('focus') === 'search') search.current?.focus()
    const refresh = () => {
      if (query.recent) router.refresh()
    }
    window.addEventListener('studio:usage-focus', refresh)
    return () => window.removeEventListener('studio:usage-focus', refresh)
  }, [router, query.recent])
  const chips: [string, string][] = [
    ...(query.q ? [['q', `搜索：${query.q}`] as [string, string]] : []),
    ...(query.kind ? [['kind', libraryLabels[query.kind]] as [string, string]] : []),
    ...(query.topic ? [['topic', query.topic] as [string, string]] : []),
    ...(collection ? [['collection', collection.title] as [string, string]] : []),
    ...(query.favorite ? [['favorite', '仅收藏'] as [string, string]] : []),
  ]
  async function pin(item: LibraryItem) {
    if (
      await sync({
        action: 'pin',
        collection: query.collection,
        kind: item.kind,
        id: item.id,
        pinned: !item.collection_pinned,
      })
    )
      router.refresh()
  }
  return (
    <div className={`library-workspace ${selected && focus ? 'library-focus' : ''}`}>
      <header className="library-heading">
        <h1>{title}</h1>
        <div className="library-search-wrap">
          <form
            className="library-search"
            onSubmit={(e) => {
              e.preventDefault()
              const q = search.current?.value.trim() || ''
              const next = { ...query, q, sort: 'relevance' as const }
              if (q) void sync({ action: 'search', query: next })
              setHistory(false)
              void navigate(
                url({ q, sort: q ? 'relevance' : undefined, item: undefined, page: undefined }),
              )
            }}
          >
            <Search size={16} aria-hidden="true" />
            <input
              ref={search}
              key={query.q}
              name="q"
              aria-label="搜索资料内容"
              defaultValue={query.q}
              placeholder="搜索标题、正文、主题…"
              onFocus={() => setHistory(!search.current?.value)}
              onChange={() => setHistory(!search.current?.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setHistory(false)
              }}
            />
            <button aria-label="提交搜索">搜索</button>
          </form>
          {history && (
            <div className="search-history">
              <div>
                <strong>最近搜索</strong>
                <Button
                  variant="ghost"
                  onClick={() => void sync({ action: 'clear', history: 'searches' })}
                >
                  清空
                </Button>
                <Button variant="ghost" aria-label="关闭最近搜索" onClick={() => setHistory(false)}>
                  <X size={14} />
                </Button>
              </div>
              {usage.searches.map((q, i) => (
                <Button
                  key={i}
                  variant="ghost"
                  onClick={() => {
                    setHistory(false)
                    void sync({ action: 'search', query: q })
                    const params = new URLSearchParams()
                    for (const [k, v] of Object.entries(q))
                      if (v !== undefined) params.set(k, v === true ? '1' : String(v))
                    params.set('sort', 'relevance')
                    void navigate(`/admin/library?${params}`)
                  }}
                >
                  {q.q}
                  {q.kind ? ` · ${libraryLabels[q.kind]}` : ''}
                  {q.topic ? ` · ${q.topic}` : ''}
                </Button>
              ))}
              {!usage.searches.length && <p>还没有搜索记录</p>}
            </div>
          )}
        </div>
        {collection && <Button onClick={() => setAdding(true)}>添加已有资料</Button>}
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus size={15} />
          <span>手动收录</span>
        </Button>
      </header>
      <div className="library-filterbar">
        {selection.length ? (
          <div className="library-selection" role="region" aria-label="已选择资料">
            <Button variant="ghost" onClick={() => setExpanded(!expanded)}>
              已选 {selection.length} 条
            </Button>
            <Button onClick={() => setHandoff(checked)}>复制给助手</Button>
            <Button variant="ghost" aria-label="取消全部选择" onClick={() => setChecked({})}>
              <X size={16} />
            </Button>
            {selection.length === 20 && <span>最多选择 20 条</span>}
          </div>
        ) : (
          <nav className="library-tabs" aria-label="内容类型">
            {kinds.map((kind) => (
              <Link
                key={kind}
                aria-current={(query.kind || 'all') === kind ? 'page' : undefined}
                href={url({
                  kind: kind === 'all' ? undefined : kind,
                  item: undefined,
                  page: undefined,
                })}
                scroll={false}
              >
                {kind === 'all' ? '全部内容' : libraryLabels[kind]}
              </Link>
            ))}
          </nav>
        )}
        <div className="library-view-options">
          <span>{total} 条</span>
          <Button variant="ghost" aria-label="筛选资料" onClick={() => setFilters(true)}>
            <SlidersHorizontal size={15} />
          </Button>
          <Select
            aria-label="排序"
            value={query.sort || 'newest'}
            onChange={(e) =>
              void navigate(url({ sort: e.target.value, item: undefined, page: undefined }))
            }
          >
            {query.q && <option value="relevance">相关性</option>}
            <option value="newest">最近收录</option>
            <option value="updated">最近修改</option>
            <option value="title">标题排序</option>
          </Select>
          {query.recent ? (
            <Button
              variant="ghost"
              onClick={() =>
                void sync({ action: 'clear', history: 'reads' }).then((ok) => {
                  if (ok) router.refresh()
                })
              }
            >
              清空记录
            </Button>
          ) : (
            <Link
              title={query.archived ? '返回当前' : '归档内容'}
              aria-label={query.archived ? '返回当前' : '归档内容'}
              href={url({
                archived: query.archived ? undefined : 1,
                item: undefined,
                page: undefined,
              })}
            >
              <Archive size={16} />
            </Link>
          )}
        </div>
      </div>
      {!!chips.length && (
        <div className="library-filter-chips">
          {chips.map(([key, label]) => (
            <Link key={key} href={url({ [key]: undefined, item: undefined, page: undefined })}>
              {label}
              <X size={12} />
            </Link>
          ))}
          <Link
            href={url({
              q: undefined,
              kind: undefined,
              topic: undefined,
              collection: undefined,
              favorite: undefined,
              item: undefined,
              page: undefined,
            })}
          >
            清除筛选
          </Link>
        </div>
      )}
      {expanded && !!selection.length && (
        <div className="selected-items">
          {selection.map((ref) => (
            <Button
              key={libraryKey(ref)}
              variant="ghost"
              onClick={() =>
                setChecked((value) => {
                  const next = { ...value }
                  delete next[libraryKey(ref)]
                  return next
                })
              }
            >
              {ref.title}
              <X size={12} />
            </Button>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="library-feedback">
          {error}
        </p>
      )}
      <div className={`library-split ${selected ? 'has-detail' : ''}`}>
        <section className="library-list" aria-label="资料列表">
          {!items.length && (
            <div className="library-empty">
              <BookOpen size={28} />
              <h2>
                {query.q ? '没有找到匹配内容' : query.recent ? '还没有阅读记录' : '这里还没有内容'}
              </h2>
              <p>
                {query.q
                  ? '换几个关键词，或扩大搜索范围。'
                  : '把文章或工具交给助手，说「保存到 Studio」。'}
              </p>
              {query.q ? (
                <div>
                  <Button onClick={() => search.current?.focus()}>修改关键词</Button>
                  <Link
                    className="admin-button"
                    href={`/admin/library?q=${encodeURIComponent(query.q)}&sort=relevance`}
                  >
                    搜索全部资料
                  </Link>
                </div>
              ) : (
                <Button onClick={() => setCreating(true)}>收录第一条内容</Button>
              )}
            </div>
          )}
          {items.map((item) => (
            <div
              className={`library-row content-row ${query.kind ? 'single-type' : ''} ${selectedKey === libraryKey(item) ? 'is-selected' : ''}`}
              key={libraryKey(item)}
            >
              <label className="library-check">
                <input
                  type="checkbox"
                  aria-label={`选择 ${item.title}`}
                  disabled={selection.length >= 20 && !checked[libraryKey(item)]}
                  checked={!!checked[libraryKey(item)]}
                  onChange={() =>
                    setChecked((value) => {
                      const next = { ...value },
                        key = libraryKey(item)
                      if (next[key]) delete next[key]
                      else next[key] = { kind: item.kind, id: item.id, title: item.title }
                      return next
                    })
                  }
                />
              </label>
              <Link
                className="library-row-link"
                href={url({ item: libraryKey(item) })}
                scroll={false}
              >
                <span className="library-row-icon">
                  <ItemIcon type={item.content_type} />
                </span>
                <div className="library-row-text">
                  <h2 title={item.title}>
                    <Highlight text={item.title} terms={item.match?.terms} />
                    {item.favorite && <Star size={12} fill="currentColor" />}
                    {!!item.collection_pinned && <Pin size={12} />}
                  </h2>
                  <p>
                    {item.match && (
                      <span className="match-label">
                        {
                          {
                            title: '标题',
                            summary: '摘要',
                            topics: '主题',
                            saved_reason: '保存原因',
                            content: '正文',
                            source_url: '来源',
                          }[item.match.field]
                        }
                        ：
                      </span>
                    )}
                    <Highlight
                      text={
                        item.match?.text ||
                        (item.content_type === 'inspiration'
                          ? item.content
                          : item.summary || item.content
                        )
                          .replace(/[#*`>]/g, '')
                          .slice(0, 150) ||
                        '打开查看来源'
                      }
                      terms={item.match?.terms}
                    />
                  </p>
                </div>
              </Link>
              {!query.kind && (
                <span className="library-row-type">
                  {libraryLabels[item.content_type] || '资料'}
                </span>
              )}
              <button
                className="library-row-topic"
                title={item.topics.join('、')}
                disabled={!item.topics.length}
                onClick={() =>
                  void navigate(url({ topic: item.topics[0], item: undefined, page: undefined }))
                }
              >
                {item.topics[0] || '—'}
              </button>
              <span className="library-row-source">
                {item.source_status === 'unavailable'
                  ? '原文未读取'
                  : sourceHost(item.source_url) ||
                    (item.submitted_by === 'agent' ? 'Agent 提交' : 'Studio')}
              </span>
              <time dateTime={new Date(item.created_at * 1000).toISOString()}>
                {new Intl.DateTimeFormat('zh-CN', {
                  month: '2-digit',
                  day: '2-digit',
                  timeZone: 'Asia/Shanghai',
                }).format(item.created_at * 1000)}
              </time>
              <Menu
                label={`${item.title}的操作`}
                items={[
                  {
                    label: '打开内容',
                    onSelect: () => void navigate(url({ item: libraryKey(item) })),
                  },
                  ...(collection
                    ? [
                        {
                          label: item.collection_pinned ? '取消集合内置顶' : '置顶到集合顶部',
                          onSelect: () => void pin(item),
                        },
                      ]
                    : []),
                  {
                    label: item.archived ? '恢复内容' : '归档内容',
                    onSelect: () =>
                      void (async () => {
                        if (flush.current && !(await flush.current())) return
                        const current = (
                          await libraryRequest({ action: 'get', kind: item.kind, id: item.id })
                        ).item
                        await libraryRequest({
                          action: 'update',
                          kind: item.kind,
                          id: item.id,
                          expected_revision: current.revision,
                          changes: { archived: !current.archived },
                        })
                        router.refresh()
                      })().catch((e) => setError(e.message)),
                  },
                ]}
              />
            </div>
          ))}
          {(page > 1 || hasMore) && (
            <nav className="library-pagination" aria-label="资料分页">
              {page > 1 ? (
                <Link href={url({ page: page - 1, item: undefined })} scroll={false}>
                  上一页
                </Link>
              ) : (
                <span />
              )}
              <span>第 {page} 页</span>
              {hasMore ? (
                <Link href={url({ page: page + 1, item: undefined })} scroll={false}>
                  下一页
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>
        {selected && (
          <section className="library-reader" aria-label="内容详情" key={selectedKey}>
            <LibraryDetail
              item={selected}
              html={html}
              collections={collections}
              closeHref={url({ item: undefined })}
              focus={focus}
              onFocus={() => setFocus(!focus)}
              registerFlush={(fn) => {
                flush.current = fn
              }}
              onHandoff={() =>
                setHandoff({
                  [selectedKey]: { kind: selected.kind, id: selected.id, title: selected.title },
                })
              }
            />
          </section>
        )}
      </div>
      <Modal
        open={creating}
        onOpenChange={(open) => {
          if (open) setCreating(true)
          else guard(() => setCreating(false))
        }}
        title="收录内容"
      >
        <CaptureForm
          beforeSave={() => (flush.current ? flush.current() : Promise.resolve(true))}
          collection={collection?.id}
          onClose={() => setCreating(false)}
        />
      </Modal>
      {handoff && (
        <HandoffDialog
          refs={handoff}
          onClose={() => setHandoff(null)}
          flush={() => (flush.current ? flush.current() : Promise.resolve(true))}
        />
      )}
      {adding && collection && (
        <AddCollectionItems
          collection={collection}
          onClose={() => setAdding(false)}
          onSaved={() => router.refresh()}
        />
      )}
      <Modal open={filters} onOpenChange={setFilters} title="筛选资料">
        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault()
            const data = new FormData(e.currentTarget)
            setFilters(false)
            void navigate(
              url({
                kind: String(data.get('kind') || ''),
                collection: String(data.get('collection') || ''),
                topic: String(data.get('topic') || ''),
                favorite: data.get('favorite') ? '1' : undefined,
                item: undefined,
                page: undefined,
              }),
            )
          }}
        >
          <label>
            类型
            <Select name="kind" defaultValue={query.kind || ''}>
              <option value="">全部类型</option>
              {kinds
                .filter((k) => k !== 'all')
                .map((k) => (
                  <option key={k} value={k}>
                    {libraryLabels[k]}
                  </option>
                ))}
            </Select>
          </label>
          <label>
            资料集
            <Select name="collection" defaultValue={query.collection || ''}>
              <option value="">全部资料集</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </label>
          <label>
            主题
            <input className="admin-input" name="topic" defaultValue={query.topic || ''} />
          </label>
          <label>
            <input type="checkbox" name="favorite" defaultChecked={query.favorite} />
            仅收藏
          </label>
          <Button type="submit" variant="primary">
            应用筛选
          </Button>
        </form>
      </Modal>
    </div>
  )
}

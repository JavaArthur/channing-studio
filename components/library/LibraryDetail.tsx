'use client'
import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, Copy, Maximize2, Minimize2, PanelRight, Star } from 'lucide-react'
import { PropertyPanel } from './PropertyPanel'
import { PublicationEditor } from './PublicationEditor'
import { Button, Input, Menu, Modal } from '@/components/admin/ui'
import { libraryLabels, sourceHost, type LibraryItem } from '@/lib/library/types'
import { renderLibraryMarkdown } from '@/lib/library/markdown'
import { useLibrarySave } from './useLibrarySave'
import { copyText, fetchItem, libraryRequest, type Collection } from './client'
const DocumentEditor = dynamic(() => import('./DocumentEditor'), {
  ssr: false,
  loading: () => <p role="status">正在加载编辑器…</p>,
})
const statusLabels = {
  saved: '已保存',
  pending: '等待保存',
  saving: '保存中…',
  error: '保存失败',
  conflict: '版本冲突',
}
export function LibraryDetail({
  item: original,
  html,
  collections,
  closeHref,
  focus,
  onFocus,
  onHandoff,
  registerFlush,
}: {
  item: LibraryItem
  html: string
  collections: Collection[]
  closeHref: string
  focus: boolean
  onFocus: () => void
  onHandoff: () => void
  registerFlush: (fn: (() => Promise<boolean>) | null) => void
}) {
  const router = useRouter()
  const { item, status, error: saveError, queue } = useLibrarySave(original)
  const [editing, setEditing] = useState(false)
  const [properties, setProperties] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [remote, setRemote] = useState<LibraryItem | null>(null)
  const [collectionOptions, setCollectionOptions] = useState(collections)
  const readOnly = ['artifact', 'post'].includes(item.kind)
  const exact = ['prompt', 'inspiration'].includes(item.kind)
  const rendered = useMemo(
    () =>
      editing ? '' : item.content === original.content ? html : renderLibraryMarkdown(item.content),
    [editing, item.content, original.content, html],
  )
  useEffect(() => {
    registerFlush(() => queue.flush())
    return () => registerFlush(null)
  }, [queue, registerFlush])
  async function act(action: () => Promise<void>) {
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
  async function ready() {
    if (!(await queue.flush())) throw new Error('请先处理未保存的修改')
    return queue.getSnapshot().item
  }
  return (
    <>
      <div className="reader-topline">
        <Link
          className="admin-button admin-button-ghost reader-back"
          aria-label="返回列表"
          href={closeHref}
          scroll={false}
        >
          <ArrowLeft size={17} />
        </Link>
        <span className="reader-kind">{libraryLabels[item.content_type] || '资料'}</span>
        <span className={`save-state save-${status}`} role="status" aria-live="polite">
          {statusLabels[status]}
        </span>
        <div className="reader-controls">
          <Button onClick={onHandoff}>复制给助手</Button>
          <Button
            variant="ghost"
            aria-label={item.favorite ? '取消收藏' : '收藏内容'}
            aria-pressed={item.favorite}
            onClick={() => queue.patch({ favorite: !item.favorite })}
          >
            <Star size={16} fill={item.favorite ? 'currentColor' : 'none'} />
          </Button>
          <Button
            variant="ghost"
            aria-label="复制正文"
            onClick={() =>
              void act(async () => {
                await copyText(item.content)
                setMessage('已复制正文。')
              })
            }
          >
            <Copy size={16} />
            {exact && <span>复制正文</span>}
          </Button>
          <Button
            variant="ghost"
            aria-label="属性"
            aria-expanded={properties}
            onClick={() => setProperties(true)}
          >
            <PanelRight size={16} />
          </Button>
          <Button variant="ghost" aria-label={focus ? '退出全屏' : '全屏阅读'} onClick={onFocus}>
            {focus ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </Button>
          <Menu
            items={[
              { label: '加入资料集', onSelect: () => setProperties(true) },
              ...(['tool', 'prompt'].includes(item.kind)
                ? [
                    {
                      label: '编辑公开版本',
                      onSelect: () =>
                        void act(async () => {
                          await ready()
                          setPublishing(true)
                        }),
                    },
                  ]
                : !['post', 'inspiration', 'artifact'].includes(item.kind)
                  ? [
                      {
                        label: '转为文章草稿',
                        onSelect: () =>
                          void act(async () => {
                            const current = await ready()
                            const data = await libraryRequest({
                              action: 'draft',
                              kind: item.kind,
                              id: item.id,
                              expected_revision: current.revision,
                            })
                            router.push(data.href)
                          }),
                      },
                    ]
                  : []),
              {
                label: item.archived ? '恢复内容' : '归档',
                onSelect: () =>
                  void act(async () => {
                    queue.patch({ archived: !item.archived })
                    await ready()
                    router.refresh()
                  }),
              },
            ]}
          />
          {!readOnly && (
            <Button
              onClick={() =>
                void act(async () => {
                  if (editing) await ready()
                  setEditing(!editing)
                })
              }
            >
              {editing ? '完成编辑' : '编辑'}
            </Button>
          )}
        </div>
      </div>
      <div className="reader-scroll">
        {(message || error) && (
          <p role={error ? 'alert' : 'status'} className="library-feedback">
            {error || message}
          </p>
        )}
        {['error', 'conflict'].includes(status) && (
          <div className="save-problem" role="alert">
            <strong>{statusLabels[status]} · 本地修改已保留</strong>
            <p>{saveError}</p>
            <div>
              <Button onClick={() => void act(() => copyText(item.content))}>复制本地正文</Button>
              {status === 'error' ? (
                <Button onClick={() => void queue.retry()}>重试保存</Button>
              ) : (
                <Button
                  onClick={() => void act(async () => setRemote((await fetchItem(item)).item))}
                >
                  对照服务端版本
                </Button>
              )}
            </div>
          </div>
        )}
        <div className="reader-document">
          {editing ? (
            <input
              className="reader-title-input"
              aria-label="标题"
              maxLength={200}
              value={item.title}
              onChange={(e) => queue.patch({ title: e.target.value })}
              onCompositionStart={() => queue.composition(true)}
              onCompositionEnd={() => queue.composition(false)}
            />
          ) : (
            <h2 className="reader-title">{item.title}</h2>
          )}
          <div className="reader-byline">
            <span>{item.submitted_by === 'agent' ? 'Agent 提交' : '私人资料'}</span>
            {item.source_url && (
              <a href={item.source_url} target="_blank" rel="noopener noreferrer">
                {sourceHost(item.source_url)}
                <ArrowUpRight size={12} />
              </a>
            )}
          </div>
          {item.source_status === 'unavailable' && (
            <p className="reader-warning">原文尚未成功读取。当前仅保留已知信息与来源链接。</p>
          )}
          {item.decision_question && (
            <div className="reader-decision">
              <strong>需要你的决定</strong>
              <p>{item.decision_question}</p>
              <Button onClick={onHandoff}>带着上下文回复助手</Button>
              <Button variant="ghost" onClick={() => queue.patch({ decision_question: '' })}>
                不再需要决定
              </Button>
            </div>
          )}
          {/* Editing stays mounted across saves, focus changes and property edits. */}
          {editing ? (
            exact ? (
              <textarea
                className="exact-editor"
                aria-label="正文（精确文本）"
                maxLength={50000}
                value={item.content}
                onCompositionStart={() => queue.composition(true)}
                onCompositionEnd={() => queue.composition(false)}
                onChange={(e) => queue.patch({ content: e.target.value })}
              />
            ) : (
              <DocumentEditor
                initial={item.content}
                onChange={(content) => queue.patch({ content })}
                onComposition={(active) => queue.composition(active)}
              />
            )
          ) : exact ? (
            <pre className="exact-reading">{item.content}</pre>
          ) : (
            <div className="library-prose" dangerouslySetInnerHTML={{ __html: rendered }} />
          )}
          {!editing && !item.content && (
            <p className="reader-empty-body">暂无正文，点击编辑补充内容。</p>
          )}
          {item.kind === 'post' && (
            <Link className="admin-button" href={`/editor?edit=${encodeURIComponent(item.id)}`}>
              打开文章编辑器
            </Link>
          )}
        </div>
      </div>
      <PropertyPanel open={properties} onOpenChange={setProperties}>
        <div className="admin-form reader-properties">
          <span className={`save-state save-${status}`} role="status">
            {statusLabels[status]}
          </span>
          {saveError && (
            <div role="alert">
              <p>{saveError}</p>
              {status === 'error' && <Button onClick={() => void queue.retry()}>重试保存</Button>}
            </div>
          )}
          <label>
            摘要
            <textarea
              aria-label="摘要"
              className="admin-input"
              rows={4}
              maxLength={1000}
              value={item.summary}
              onChange={(e) => queue.patch({ summary: e.target.value })}
            />
          </label>
          <label>
            原始链接
            <Input
              type="url"
              disabled={readOnly}
              value={item.source_url || ''}
              onChange={(e) => queue.patch({ source_url: e.target.value || null })}
            />
          </label>
          <label>
            保存原因
            <textarea
              aria-label="保存原因"
              className="admin-input"
              rows={3}
              maxLength={2000}
              value={item.saved_reason}
              onChange={(e) => queue.patch({ saved_reason: e.target.value })}
            />
          </label>
          <TopicsInput initial={item.topics} onChange={(topics) => queue.patch({ topics })} />
          <div className="property-meta">
            <span>收录时间</span>
            <time>
              {new Date(item.created_at * 1000).toLocaleString('zh-CN', {
                timeZone: 'Asia/Shanghai',
              })}
            </time>
            <span>类型</span>
            <span>{libraryLabels[item.content_type]}</span>
          </div>
          <fieldset>
            <legend>所属资料集</legend>
            <div className="collection-options">
              {collectionOptions.map((c) => (
                <label key={c.id}>
                  <input
                    type="checkbox"
                    checked={!!item.collections?.some((x) => x.id === c.id)}
                    disabled={busy}
                    onChange={() =>
                      void act(async () => {
                        await ready()
                        const data = await libraryRequest({
                          action: 'link',
                          kind: item.kind,
                          id: item.id,
                          collection_id: c.id,
                          collection_revision: c.revision,
                          remove: !!item.collections?.some((x) => x.id === c.id),
                        })
                        queue.accept(data.item)
                        setCollectionOptions(data.collections)
                      })
                    }
                  />
                  {c.title}
                </label>
              ))}
              {!collectionOptions.length && <Link href="/admin/collections">创建主题资料集</Link>}
            </div>
          </fieldset>
          {error && <p role="alert">{error}</p>}
        </div>
      </PropertyPanel>
      <Modal
        open={!!remote}
        onOpenChange={(open) => {
          if (!open) setRemote(null)
        }}
        title="版本冲突"
        description="本地修改不会覆盖服务端。先复制需要保留的内容，再重新载入。"
      >
        {remote && (
          <div className="admin-form">
            <div className="conflict-columns">
              <section>
                <h3>本地版本</h3>
                <pre>
                  {JSON.stringify(
                    {
                      title: item.title,
                      content: item.content,
                      summary: item.summary,
                      topics: item.topics,
                      source_url: item.source_url,
                      saved_reason: item.saved_reason,
                    },
                    null,
                    2,
                  )}
                </pre>
              </section>
              <section>
                <h3>服务端版本</h3>
                <pre>
                  {JSON.stringify(
                    {
                      title: remote.title,
                      content: remote.content,
                      summary: remote.summary,
                      topics: remote.topics,
                      source_url: remote.source_url,
                      saved_reason: remote.saved_reason,
                    },
                    null,
                    2,
                  )}
                </pre>
              </section>
            </div>
            <Button onClick={() => void act(() => copyText(JSON.stringify(item, null, 2)))}>
              复制本地完整版本
            </Button>
            <Button
              onClick={() => {
                queue.discard(remote)
                setEditing(false)
                setRemote(null)
              }}
            >
              放弃本地修改并重新载入
            </Button>
          </div>
        )}
      </Modal>
      {publishing && (item.kind === 'tool' || item.kind === 'prompt') && (
        <PublicationEditor
          kind={item.kind}
          id={item.id}
          onClose={() => setPublishing(false)}
          onSaved={(updated) => {
            queue.accept(updated)
            setMessage('公开版本已更新。')
          }}
        />
      )}
    </>
  )
}
function TopicsInput({
  initial,
  onChange,
}: {
  initial: string[]
  onChange: (topics: string[]) => void
}) {
  const [text, setText] = useState(initial.join('、'))
  return (
    <label>
      主题（用顿号分隔）
      <Input
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          onChange(
            e.target.value
              .split(/[、,，]/)
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }}
      />
    </label>
  )
}

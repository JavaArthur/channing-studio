'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState, useTransition } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Folder, PenLine, RotateCcw, Search } from 'lucide-react'
import { Button, Input, Select } from '@/components/admin/ui'
import { journalDate, journalKind, journalTopics, type JournalFilter, type JournalKind } from '@/lib/library/journal'
import { buildHandoff, type LibraryItem } from '@/lib/library/types'
import { LibraryDetail } from './LibraryDetail'
import { JournalCapture } from './JournalCapture'
import { copyText, type Collection } from './client'

type Props = {
  items: LibraryItem[]; total: number; page: number; hasMore: boolean; filter: JournalFilter;
  query: string; collection: string; collections: Collection[]; selected: LibraryItem | null;
  html: string; create?: JournalKind; loadError?: boolean
}
export function JournalWorkbench(props: Props) {
  const router = useRouter()
  const [transitioning, startTransition] = useTransition()
  const [create, setCreate] = useState<JournalKind | null>(props.create || null)
  const [query, setQuery] = useState(props.query)
  const [focus, setFocus] = useState(false)
  const [notice, setNotice] = useState('')
  const flush = useRef<(() => Promise<boolean>) | null>(null)
  const registerFlush = useCallback((fn: (() => Promise<boolean>) | null) => { flush.current = fn }, [])
  const href = (changes: Record<string, string> = {}) => {
    const params = new URLSearchParams({ type: props.filter })
    if (props.query) params.set('q', props.query)
    if (props.collection) params.set('collection', props.collection)
    if (props.page > 1) params.set('page', String(props.page))
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    return `/admin/learning?${params}`
  }
  async function newRecord(kind: JournalKind) {
    if (flush.current && !(await flush.current())) return
    setCreate(kind)
  }
  function navigate(changes: Record<string, string>) {
    startTransition(() => router.push(href(changes), { scroll: false }))
  }
  const groups = new Map<string, LibraryItem[]>()
  for (const item of props.items) {
    const date = journalDate(new Date(item.created_at * 1000))
    groups.set(date, [...(groups.get(date) || []), item])
  }
  const filtered = props.filter !== 'all' || !!props.query || !!props.collection
  return <div className={`journal-workbench ${props.selected ? 'journal-has-detail' : ''} ${focus ? 'journal-focus' : ''}`}>
    <header className="journal-header">
      <div><span className="journal-eyebrow">私人学习记录</span><h1>学习与复盘</h1><p>记下所学，留下实践的线索。</p></div>
      <div className="journal-actions"><Button variant="primary" onClick={() => void newRecord('learning')}><PenLine size={16} />新建学习记录</Button><Button onClick={() => void newRecord('reflection')}><RotateCcw size={16} />写日复盘</Button></div>
    </header>
    {notice && <p role="status" className="library-feedback">{notice}</p>}
    {props.selected ? <section className="journal-reader library-reader" aria-label="学习记录详情">
      <LibraryDetail key={props.selected.id} item={props.selected} html={props.html} collections={props.collections} closeHref={href()} focus={focus} onFocus={() => setFocus(!focus)} registerFlush={registerFlush} onHandoff={() => {
        void (async () => {
          if (flush.current && !(await flush.current())) return
          // Fetch the latest saved body rather than a stale server prop after editing.
          const { fetchItem } = await import('./client')
          const { item } = await fetchItem(props.selected!)
          await copyText(buildHandoff([item], '', location.origin))
          setNotice('已复制给助手。')
        })().catch(() => setNotice('复制失败，请重试。'))
      }} />
    </section> : <div className="journal-layout">
      <section className="journal-review" aria-labelledby="journal-review-title" aria-busy={transitioning}>
        <div className="journal-section-heading"><h2 id="journal-review-title">回顾记录</h2>{!props.loadError && <span>{props.total} 条{filtered ? '符合筛选' : '记录'}</span>}</div>
        <nav className="journal-tabs" aria-label="记录类型">{(['all', 'learning', 'reflection'] as const).map((kind) => <Link key={kind} href={href({ type: kind, page: '' })} scroll={false} aria-current={props.filter === kind ? 'page' : undefined}>{kind === 'all' ? '全部记录' : journalTopics[kind]}</Link>)}</nav>
        <form className="journal-search" onSubmit={(event) => { event.preventDefault(); navigate({ q: query, page: '' }) }}>
          <div><Search size={16} aria-hidden="true" /><Input disabled={transitioning} aria-label="查找学习记录" placeholder="查找标题、正文或标签" maxLength={200} value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <Button type="submit" disabled={transitioning}>查找</Button>
          <Select disabled={transitioning} aria-label="筛选资料集" value={props.collection} onChange={(event) => navigate({ collection: event.target.value, page: '' })}><option value="">全部资料集</option>{props.collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.title}</option>)}</Select>
        </form>
        {transitioning && <p className="journal-inline-status" role="status">正在查找记录…</p>}
        {props.loadError ? <div className="journal-empty" role="alert"><h3>记录暂时没有载入</h3><p>你的记录没有被改动，请重试连接。</p><Button onClick={() => startTransition(() => router.refresh())} disabled={transitioning}>重新载入</Button></div>
          : props.items.length ? <div className="journal-timeline">{[...groups].map(([date, items]) => <section className="journal-day" key={date} aria-label={`${date} 的记录`}><time dateTime={date}>{date}<small>北京时间</small></time><div>{items.map((item) => <Link className="journal-entry" key={item.id} href={href({ item: item.id })} scroll={false}>
            <div className="journal-entry-meta"><span>{journalTopics[journalKind(item.topics) || 'learning']}</span>{item.topics.filter((topic) => !Object.values(journalTopics).includes(topic as typeof journalTopics[JournalKind])).slice(0, 2).map((topic) => <span key={topic}>#{topic}</span>)}</div>
            <h3>{item.title}</h3><p>{item.summary || item.content.replace(/[#*_`>\[\]]/g, '').replace(/\s+/g, ' ').slice(0, 160) || '打开记录继续整理'}</p><ArrowRight className="journal-entry-arrow" size={17} aria-hidden="true" />
          </Link>)}</div></section>)}</div>
          : <div className="journal-empty"><BookOpen size={28} aria-hidden="true" /><h3>{filtered ? '没有找到这样的记录' : '从今天的一点收获开始'}</h3><p>{filtered ? '换个关键词，或清除筛选再看看。' : '学习、实践和复盘，都可以从几句话开始。保存后会在这里按日期回顾。'}</p>{filtered ? <Link href="/admin/learning" className="admin-button admin-button-secondary">清除筛选</Link> : <Button variant="primary" onClick={() => void newRecord('learning')}>记下第一条学习记录</Button>}</div>}
        {(props.page > 1 || props.hasMore) && <nav className="journal-pagination" aria-label="记录分页">{props.page > 1 ? <Link href={href({ page: String(props.page - 1) })} scroll={false}><ArrowLeft size={16} />上一页</Link> : <span />}<span>第 {props.page} 页</span>{props.hasMore ? <Link href={href({ page: String(props.page + 1) })} scroll={false}>下一页<ArrowRight size={16} /></Link> : <span />}</nav>}
      </section>
      <aside className="journal-context" aria-label="整理与回顾"><span className="journal-eyebrow">让记录接着生长</span><h2>把今天的所学，<br />连到正在做的事。</h2><p>记录可以关联到已有资料集或项目，和参考资料一起阅读。</p><Link href="/admin/collections"><Folder size={16} />整理资料集<ArrowRight size={15} /></Link><Link href="/admin/library"><BookOpen size={16} />打开全部资料库<ArrowRight size={15} /></Link><div className="journal-context-note"><strong>属于你的私人空间</strong><p>使用「学习记录」或「日复盘」标签的笔记会出现在这里。已有同名标签继续保留，公开发布由你另外决定。</p></div></aside>
    </div>}
    {create && <JournalCapture key={create} kind={create} collections={props.collections} onClose={() => { setCreate(null); if (props.create) router.replace(href()) }} onSaved={(id) => { setCreate(null); router.push(href({ item: id })); router.refresh() }} />}
  </div>
}

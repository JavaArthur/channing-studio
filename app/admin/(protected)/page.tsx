import Link from 'next/link'
import {
  ArrowUpRight,
  BookOpen,
  CircleAlert,
  FilePenLine,
  FileText,
  FolderKanban,
  Globe,
  Layers,
  NotebookPen,
  Send,
  Sparkles,
  Terminal,
  Wrench,
} from 'lucide-react'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getAdminPostPage } from '@/lib/repositories/admin-posts'
import { searchLibrary } from '@/lib/repositories/library'
import { listPortfolioProjects } from '@/lib/repositories/portfolio'
import { getTools } from '@/lib/repositories/tools'
import { getPrompts } from '@/lib/repositories/prompts'
import { listXDrafts } from '@/lib/repositories/x-drafts'
import { libraryLabels } from '@/lib/library/types'

export const dynamic = 'force-dynamic'
export const metadata = { title: '总控台 · Channing Atelier' }

function formatDeskDate(epoch?: number | null): string {
  if (!epoch || !Number.isFinite(epoch) || epoch <= 0) return '—'
  const ms = epoch < 1e12 ? epoch * 1000 : epoch
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: '2-digit',
      day: '2-digit',
    })
      .format(new Date(ms))
      .replace('/', '.')
  } catch {
    return '—'
  }
}

function formatMastheadStamp(): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
    }).formatToParts(new Date())
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
    return `${get('year')}.${get('month')}.${get('day')} · ${get('weekday').toUpperCase()} · UTC+8`
  } catch {
    return 'UTC+8 · ATELIER'
  }
}

export default async function WorkbenchCommandPage() {
  const env = await getAppCloudflareEnv().catch(() => ({ DB: undefined }))
  const db = env?.DB
  const dbReady = Boolean(db)

  const [postPage, libraryRecent, decisionResult, portfolioProjects, tools, prompts, xDrafts] = db
    ? await Promise.all([
        getAdminPostPage(db, { page: 1 }).catch(() => null),
        searchLibrary(db, { limit: 6, sort: 'updated' }).catch(() => null),
        searchLibrary(db, { decisions: true, limit: 3, sort: 'updated' }).catch(() => null),
        listPortfolioProjects(db).catch(() => null),
        getTools(db, { includeHidden: true }).catch(() => null),
        getPrompts(db, { includeHidden: true }).catch(() => null),
        listXDrafts(db, { account_id: 'all', status: 'pending', limit: 1 }).catch(() => null),
      ])
    : [null, null, null, null, null, null, null]

  const publishedPosts = postPage?.stats?.published ?? 0
  const draftPosts = postPage?.stats?.draft ?? 0
  const privatePosts = (postPage?.stats?.encrypted ?? 0) + (postPage?.stats?.unlisted ?? 0)
  const recentPosts = (postPage?.posts ?? []).filter((post) => !post.deleted_at).slice(0, 5)

  const libraryTotal = libraryRecent?.total ?? 0
  const libraryItems = libraryRecent?.items ?? []
  const pendingDecisions = decisionResult?.total ?? 0
  const decisionItems = decisionResult?.items ?? []

  const portfolioList = portfolioProjects ?? []
  const portfolioTotal = portfolioList.length
  const portfolioActive = portfolioList.filter((project) => project.status === 'active').length
  const portfolioPublished = portfolioList.filter((project) => Boolean(project.published)).length

  const toolsCount = tools?.length ?? 0
  const promptsCount = prompts?.length ?? 0
  const arsenalTotal = toolsCount + promptsCount
  const pendingXDrafts = xDrafts?.total ?? 0

  const quickActions = [
    {
      code: '01 // MANUSCRIPT',
      title: '写新文章',
      desc: '起草技术深潜、工程手记与公众号双端排版手稿。',
      href: '/editor?new=1',
      Icon: FilePenLine,
      primary: true,
    },
    {
      code: '02 // JOURNAL',
      title: '学习与复盘',
      desc: '沉淀每日工程判断、架构复盘与阅读摘录。',
      href: '/admin/learning?new=learning',
      Icon: NotebookPen,
      primary: false,
    },
    {
      code: '03 // ARCHIVE',
      title: '录入知识库',
      desc: '检索并串联私人笔记、外部信源、工具与提示词上下文。',
      href: '/admin/library',
      Icon: BookOpen,
      primary: false,
    },
    {
      code: '04 // PUBLISH',
      title: '管理公开站',
      desc: '审校草稿与脱敏快照，显式更新公开作品集与文章站。',
      href: '/admin/publish',
      Icon: Globe,
      primary: false,
    },
  ]

  const surfaceMatrix = [
    {
      code: 'S1',
      title: '首页与工作室',
      desc: 'Hero 叙事、实践支柱与档案设置',
      href: '/admin/studio',
      Icon: Layers,
    },
    {
      code: 'S2',
      title: '文章归档',
      desc: `${publishedPosts} 已发 · ${draftPosts} 草稿`,
      href: '/admin/posts',
      Icon: FileText,
    },
    {
      code: 'S3',
      title: '工具收藏',
      desc: `${toolsCount} 项工程工具与桌面利器`,
      href: '/admin/tools',
      Icon: Wrench,
    },
    {
      code: 'S4',
      title: '提示词库',
      desc: `${promptsCount} 份结构化 Prompt 标本`,
      href: '/admin/prompts',
      Icon: Terminal,
    },
    {
      code: 'S5',
      title: 'Hermes 运营',
      desc: '自动化运行态势与灵感收件箱',
      href: '/admin/operations',
      Icon: Sparkles,
    },
    {
      code: 'S6',
      title: 'X 动态草稿',
      desc: pendingXDrafts > 0 ? `${pendingXDrafts} 条待审校推文` : '多账号推文起草与分发队列',
      href: '/admin/x-drafts',
      Icon: Send,
      badge: pendingXDrafts > 0 ? pendingXDrafts : undefined,
    },
  ]

  return (
    <div className="command-desk">
      {/* ── 01. Command Masthead ── */}
      <header className="command-masthead">
        <div className="command-masthead-topline">
          <span className="atelier-kicker">
            <span
              className="atelier-beacon"
              data-tone={dbReady ? 'healthy' : 'warning'}
              aria-hidden="true"
            />
            <span>WORKBENCH // COMMAND DESK</span>
          </span>
          <span className="command-masthead-stamp">{formatMastheadStamp()}</span>
        </div>

        <div className="command-masthead-hero">
          <div>
            <h1>私人工程与知识总控台</h1>
            <p>
              面向写作手稿、知识闭环、项目交付与公开出版的统一调度席。
              {!dbReady && '（当前未绑定本地 D1，计数与流处于待机状态）'}
            </p>
          </div>
          <div className="command-masthead-links">
            <Link href="/admin/portfolio" className="admin-button">
              <FolderKanban size={14} aria-hidden="true" />
              <span>项目导航</span>
            </Link>
            <Link href="/editor?new=1" className="admin-button admin-button-cta">
              <FilePenLine size={14} aria-hidden="true" />
              <span>新建文章</span>
            </Link>
          </div>
        </div>

        <div className="command-actions-grid" aria-label="核心快捷操作">
          {quickActions.map(({ code, title, desc, href, Icon, primary }) => (
            <Link
              key={href}
              href={href}
              className={`command-action-card atelier-crosshair ${primary ? 'is-primary' : ''}`}
            >
              <div className="command-action-head">
                <span className="command-action-code">{code}</span>
                <span className="command-action-icon" aria-hidden="true">
                  <Icon size={15} />
                </span>
              </div>
              <h2>
                <span>{title}</span>
                <ArrowUpRight size={14} aria-hidden="true" />
              </h2>
              <p>{desc}</p>
            </Link>
          ))}
        </div>
      </header>

      {/* ── 02. Real Telemetry Strip ── */}
      <section className="command-telemetry" aria-label="工作台核心指标">
        <Link href="/admin/posts" className="command-metric-cell">
          <div className="command-metric-top">
            <span>01 // ARTICLES</span>
            <ArrowUpRight size={13} aria-hidden="true" />
          </div>
          <div className="command-metric-value">
            <strong>{publishedPosts}</strong>
            <span>篇已发布</span>
          </div>
          <div className="command-metric-sub">
            <span>{draftPosts} 草稿</span>
            <span aria-hidden="true">·</span>
            <span>{privatePosts} 私密/隐藏</span>
          </div>
        </Link>

        <Link href="/admin/library" className="command-metric-cell">
          <div className="command-metric-top">
            <span>02 // KNOWLEDGE</span>
            <ArrowUpRight size={13} aria-hidden="true" />
          </div>
          <div className="command-metric-value">
            <strong>{libraryTotal}</strong>
            <span>条资料收录</span>
          </div>
          <div className="command-metric-sub">
            {pendingDecisions > 0 ? (
              <span className="command-metric-alert">{pendingDecisions} 项待决定</span>
            ) : (
              <span>0 项待决定</span>
            )}
            <span aria-hidden="true">·</span>
            <span>私人上下文</span>
          </div>
        </Link>

        <Link href="/admin/portfolio" className="command-metric-cell">
          <div className="command-metric-top">
            <span>03 // SYSTEMS</span>
            <ArrowUpRight size={13} aria-hidden="true" />
          </div>
          <div className="command-metric-value">
            <strong>{portfolioTotal}</strong>
            <span>个工程系统</span>
          </div>
          <div className="command-metric-sub">
            <span>{portfolioPublished} 已公开</span>
            <span aria-hidden="true">·</span>
            <span>{portfolioActive} 活跃演进</span>
          </div>
        </Link>

        <Link href="/admin/tools" className="command-metric-cell">
          <div className="command-metric-top">
            <span>04 // ARSENAL</span>
            <ArrowUpRight size={13} aria-hidden="true" />
          </div>
          <div className="command-metric-value">
            <strong>{arsenalTotal}</strong>
            <span>项工具与提示词</span>
          </div>
          <div className="command-metric-sub">
            <span>{toolsCount} 工具</span>
            <span aria-hidden="true">·</span>
            <span>{promptsCount} 提示词</span>
          </div>
        </Link>
      </section>

      {/* ── 03. Two-Column Active Desk ── */}
      <div className="command-desk-columns">
        {/* Left Column: Decisions Alert + Recent Knowledge & Learning Stream */}
        <div className="command-desk-col">
          {pendingDecisions > 0 && (
            <section className="command-decision-banner" aria-label="待决定提醒">
              <div className="command-decision-head">
                <div className="command-decision-title">
                  <CircleAlert size={15} aria-hidden="true" />
                  <strong>{pendingDecisions} 项技术或产品判断等待拍板</strong>
                </div>
                <Link href="/admin/library?decisions=1">
                  <span>集中处理</span>
                  <ArrowUpRight size={13} aria-hidden="true" />
                </Link>
              </div>
              {decisionItems.length > 0 && (
                <ul className="command-decision-list">
                  {decisionItems.map((item) => (
                    <li key={`${item.kind}:${item.id}`}>
                      <Link href={item.href}>
                        <span className="command-decision-q">
                          {item.decision_question || item.title}
                        </span>
                        <span className="command-decision-meta">{item.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="command-panel" aria-labelledby="command-stream-heading">
            <header className="command-panel-header">
              <div>
                <span className="command-panel-code">STREAM // 01</span>
                <h2 id="command-stream-heading">最近知识与复盘流</h2>
              </div>
              <Link href="/admin/library" className="command-panel-more">
                <span>全部资料</span>
                <ArrowUpRight size={13} aria-hidden="true" />
              </Link>
            </header>

            {libraryItems.length > 0 ? (
              <ul className="command-stream-list">
                {libraryItems.map((item) => {
                  const kindLabel =
                    libraryLabels[item.content_type] || libraryLabels[item.kind] || item.kind
                  return (
                    <li key={`${item.kind}:${item.id}`}>
                      <Link href={item.href} className="command-stream-row">
                        <span className="atelier-badge">{kindLabel}</span>
                        <div className="command-stream-body">
                          <h3>{item.title}</h3>
                          {(item.summary || item.topics.length > 0) && (
                            <p>
                              {item.topics.length > 0
                                ? `${item.topics.slice(0, 2).map((t) => `#${t}`).join(' ')}${item.summary ? ` · ${item.summary}` : ''}`
                                : item.summary}
                            </p>
                          )}
                        </div>
                        <time className="command-stream-time">
                          {formatDeskDate(item.updated_at || item.created_at)}
                        </time>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="command-empty">
                <p>知识库尚无收录记录。从一条日常复盘或外部技术摘录开始构建私人上下文。</p>
                <div className="command-empty-actions">
                  <Link href="/admin/learning?new=learning" className="admin-button admin-button-primary">
                    记一条复盘
                  </Link>
                  <Link href="/admin/library" className="admin-button">
                    打开知识库
                  </Link>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Recent Writing Pipeline + Studio Surface Matrix */}
        <div className="command-desk-col">
          <section className="command-panel" aria-labelledby="command-pipeline-heading">
            <header className="command-panel-header">
              <div>
                <span className="command-panel-code">PIPELINE // 02</span>
                <h2 id="command-pipeline-heading">最近写作与发布管线</h2>
              </div>
              <Link href="/admin/posts" className="command-panel-more">
                <span>文章管理</span>
                <ArrowUpRight size={13} aria-hidden="true" />
              </Link>
            </header>

            {recentPosts.length > 0 ? (
              <ul className="command-pipeline-list">
                {recentPosts.map((post) => {
                  const statusTone =
                    post.status === 'draft'
                      ? 'warning'
                      : post.password || post.is_hidden
                        ? 'muted'
                        : 'healthy'
                  const statusLabel =
                    post.status === 'draft'
                      ? '草稿'
                      : post.password
                        ? '加密'
                        : post.is_hidden
                          ? '隐藏'
                          : '已发布'

                  return (
                    <li key={post.slug}>
                      <Link
                        href={`/editor?slug=${encodeURIComponent(post.slug)}`}
                        className="command-pipeline-row"
                      >
                        <span className="command-status-pill" data-tone={statusTone}>
                          {statusLabel}
                        </span>
                        <div className="command-pipeline-body">
                          <h3>{post.title || '无标题手稿'}</h3>
                          <span>
                            {post.category || '未分类'} · /{post.slug}
                          </span>
                        </div>
                        <span className="command-pipeline-edit">
                          <time>{formatDeskDate(post.published_at)}</time>
                          <ArrowUpRight size={13} aria-hidden="true" />
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="command-empty">
                <p>暂无文章或工作草稿。随时开启一篇新的工程文章或笔记手稿。</p>
                <div className="command-empty-actions">
                  <Link href="/editor?new=1" className="admin-button admin-button-cta">
                    新建第一篇手稿
                  </Link>
                </div>
              </div>
            )}
          </section>

          <section className="command-panel" aria-labelledby="command-matrix-heading">
            <header className="command-panel-header">
              <div>
                <span className="command-panel-code">MATRIX // 03</span>
                <h2 id="command-matrix-heading">工作台表面矩阵</h2>
              </div>
              <Link href="/admin/publish" className="command-panel-more">
                <span>公开总览</span>
                <ArrowUpRight size={13} aria-hidden="true" />
              </Link>
            </header>

            <div className="command-surface-matrix">
              {surfaceMatrix.map(({ code, title, desc, href, Icon, badge }) => (
                <Link key={href} href={href} className="command-surface-cell">
                  <div className="command-surface-top">
                    <span className="command-surface-code">{code}</span>
                    {badge !== undefined ? (
                      <span className="atelier-badge" data-tone="vermilion">
                        {badge}
                      </span>
                    ) : (
                      <Icon size={14} aria-hidden="true" />
                    )}
                  </div>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

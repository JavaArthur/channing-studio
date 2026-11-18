import Link from 'next/link'
import { Activity, ArrowUpRight } from 'lucide-react'
import type { KnowledgeDashboard as DashboardModel } from '@/lib/agent-knowledge/dashboard'

const labels = {
  knowledge: '知识沉淀',
  topic: '选题候选',
  draft: '写作中',
  published: '已发布',
} as const

const tones: Record<keyof typeof labels, 'healthy' | 'warning' | 'vermilion' | undefined> = {
  knowledge: undefined,
  topic: 'warning',
  draft: 'vermilion',
  published: 'healthy',
}

export function KnowledgeDashboard({ model }: { model: DashboardModel }) {
  const items = [
    ...new Map(
      [...(model.featuredArtifact ? [model.featuredArtifact] : []), ...model.pipeline].map(
        (item) => [item.artifactKey, item],
      ),
    ).values(),
  ]

  const syncTone = model.blocked ? 'alert' : model.latestRun?.finishedAt ? 'healthy' : 'warning'
  const syncLabel = model.blocked
    ? '同步受阻'
    : model.latestRun?.finishedAt
      ? '同步正常'
      : '等待首次同步'

  return (
    <section className="atelier-surface-page hermes-board">
      <header className="workspace-page-heading">
        <div>
          <span className="atelier-eyebrow">
            <span className="atelier-beacon" data-tone={syncTone} aria-hidden="true" />
            TELEMETRY // HERMES PIPELINE
          </span>
          <h1>连接记录</h1>
          <p>Hermes 历史同步 · 仅保存脱敏成果与运行状态</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="atelier-badge" data-tone={model.blocked ? 'vermilion' : undefined}>
            <span className="atelier-beacon" data-tone={syncTone} aria-hidden="true" />
            {syncLabel}
          </span>
          <Link href="/admin/settings?section=connections" className="admin-button">
            管理连接
          </Link>
        </div>
      </header>

      {model.blocked && (
        <div className="hermes-alert atelier-crosshair" role="alert">
          <div className="hermes-alert-head">
            <strong>
              <span className="atelier-beacon" data-tone="alert" aria-hidden="true" />
              最近一次同步未完成
            </strong>
            <code>{model.blocked.code}</code>
          </div>
          <p>{model.blocked.message}</p>
          {model.blocked.nextAction && <p className="hermes-alert-next">{model.blocked.nextAction}</p>}
        </div>
      )}

      <div className="sync-stats">
        {[
          ['01 // CHECKED', '本周检查', model.checkedCount],
          ['02 // SYNTHESIZED', '知识沉淀', model.knowledgeCount],
          ['03 // PUBLISHED', '公开输出', model.publishedCount],
        ].map(([code, label, value]) => (
          <div key={label} className="sync-stat-cell">
            <small className="atelier-mono">{code}</small>
            <div>
              <strong className="atelier-mono">{value}</strong>
              <span>{label}</span>
            </div>
          </div>
        ))}
      </div>

      {!!items.length && (
        <div className="resource-list hermes-pipeline-list">
          {items.map((item) => (
            <div className="resource-row" key={item.artifactKey}>
              <div>
                <h2>{item.title}</h2>
                <p>{item.summary}</p>
              </div>
              <span className="atelier-badge">
                <span
                  className="atelier-beacon"
                  data-tone={tones[item.type]}
                  aria-hidden="true"
                />
                {labels[item.type]}
              </span>
              <Link
                className="admin-button admin-button-ghost"
                href={`/admin/library/artifact/${encodeURIComponent(item.artifactKey)}`}
              >
                查看内容
                <ArrowUpRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      )}

      {!items.length && (
        <div className="library-empty atelier-crosshair">
          <span className="library-empty-emblem" aria-hidden="true">
            <Activity size={24} />
          </span>
          <h2>暂无历史同步记录</h2>
          <p>新内容可以通过任意 Agent 保存到资料库。</p>
          <Link className="admin-button" href="/admin/library">
            打开资料库
          </Link>
        </div>
      )}

      <footer className="hermes-sync-footer atelier-mono">
        <span>
          最近同步：
          {model.latestRun?.finishedAt
            ? new Date(model.latestRun.finishedAt * 1000).toLocaleString('zh-CN', {
                timeZone: 'Asia/Shanghai',
                hour12: false,
              })
            : '暂无'}
        </span>
        <span>HERMES SYNC · SANITIZED PROJECTION ONLY</span>
      </footer>
    </section>
  )
}

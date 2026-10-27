import Link from 'next/link'
import type { KnowledgeDashboard as DashboardModel } from '@/lib/agent-knowledge/dashboard'
const labels = { knowledge: '知识沉淀', topic: '选题候选', draft: '写作中', published: '已发布' }
export function KnowledgeDashboard({ model }: { model: DashboardModel }) {
  const items = [
    ...new Map(
      [...(model.featuredArtifact ? [model.featuredArtifact] : []), ...model.pipeline].map(
        (item) => [item.artifactKey, item],
      ),
    ).values(),
  ]
  return (
    <section>
      <header className="workspace-page-heading">
        <div>
          <h1>连接记录</h1>
          <p>Hermes 历史同步 · 仅保存脱敏成果与运行状态</p>
        </div>
        <Link href="/admin/settings?section=connections" className="admin-button">
          管理连接
        </Link>
      </header>
      {model.blocked && (
        <div className="reader-warning">
          <strong>最近一次同步未完成</strong>
          <p>{model.blocked.message}</p>
          {model.blocked.nextAction && <p>{model.blocked.nextAction}</p>}
          <code>{model.blocked.code}</code>
        </div>
      )}
      <div className="sync-stats">
        {[
          ['本周检查', model.checkedCount],
          ['知识沉淀', model.knowledgeCount],
          ['公开输出', model.publishedCount],
        ].map(([label, value]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="resource-list">
        {items.map((item) => (
          <div className="resource-row" key={item.artifactKey}>
            <div>
              <h2>{item.title}</h2>
              <p>{item.summary}</p>
            </div>
            <span>{labels[item.type]}</span>
            <Link
              className="admin-button admin-button-ghost"
              href={`/admin/library/artifact/${encodeURIComponent(item.artifactKey)}`}
            >
              查看内容
            </Link>
          </div>
        ))}
      </div>
      {!items.length && (
        <div className="library-empty">
          <h2>暂无历史同步记录</h2>
          <p>新内容可以通过任意 Agent 保存到资料库。</p>
          <Link className="admin-button" href="/admin/library">
            打开资料库
          </Link>
        </div>
      )}
      <p className="mt-5 text-xs text-[var(--editor-muted)]">
        最近同步：
        {model.latestRun?.finishedAt
          ? new Date(model.latestRun.finishedAt * 1000).toLocaleString('zh-CN', {
              timeZone: 'Asia/Shanghai',
            })
          : '暂无'}
      </p>
    </section>
  )
}

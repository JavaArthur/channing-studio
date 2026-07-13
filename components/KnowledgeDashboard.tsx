import Link from 'next/link'
import type { KnowledgeDashboard as DashboardModel } from '@/lib/agent-knowledge/dashboard'

const domainLabels = {
  work: '工作',
  investing: '投资',
  knowledge: '知识',
  content: '内容',
} as const

const typeLabels = {
  knowledge: '知识沉淀',
  topic: '选题候选',
  draft: '写作中',
  published: '已发布',
} as const

function formatSyncTime(timestamp: number | null) {
  if (!timestamp) return '尚未完成首次同步'
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp * 1000))
}

export function KnowledgeDashboard({ model }: { model: DashboardModel }) {
  const snapshot = model.latestRun?.snapshot
  const narrative = snapshot?.narrative || (
    model.state === 'empty'
      ? 'Flomo 是唯一输入端。Hermes 完成首次扫描后，这里会出现想法如何长成知识与内容的轨迹。'
      : `本周 Hermes 检查了 ${model.checkedCount} 条想法，留下 ${model.knowledgeCount} 条知识沉淀，并推动 ${model.publishedCount} 项内容发布。`
  )
  const featured = model.featuredArtifact
  const artifactsByType = ['draft', 'topic', 'knowledge'] as const

  return (
    <section className="mx-auto max-w-5xl space-y-10 pb-10 text-[var(--editor-ink)]">
      <header className="max-w-3xl pt-3 sm:pt-8">
        <p className="mb-4 text-xs font-semibold tracking-[0.22em] text-[var(--editor-accent)] uppercase">
          Personal knowledge desk
        </p>
        <h1 className="text-3xl font-medium leading-tight tracking-[-0.03em] sm:text-5xl">
          这一周，你的想法正在变成资产
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--editor-muted)] sm:text-lg">
          {narrative}
        </p>
      </header>

      {model.blocked && (
        <div className="rounded-2xl border border-amber-500/35 bg-amber-500/8 px-5 py-4">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">最近一次同步没有完成</p>
          <p className="mt-1 text-sm leading-6 text-[var(--editor-muted)]">{model.blocked.message}</p>
          {model.blocked.nextAction && <p className="mt-2 text-sm leading-6 text-[var(--editor-muted)]">下一步：{model.blocked.nextAction}</p>}
          <p className="mt-2 font-mono text-xs text-[var(--stone-gray)]">{model.blocked.code}</p>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.55fr_1fr]">
        <article className="rounded-3xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs tracking-[0.18em] text-[var(--stone-gray)] uppercase">一条完整成长轨迹</p>
            {featured && <span className="rounded-full bg-[var(--editor-soft)] px-3 py-1 text-xs text-[var(--editor-muted)]">{typeLabels[featured.type]}</span>}
          </div>
          {featured ? (
            <div className="mt-8">
              <div className="flex items-center gap-3 text-xs text-[var(--stone-gray)]">
                <span>Flomo × {featured.sourceIds.length}</span><span>→</span>
                <span>Hermes 筛选</span><span>→</span>
                <span>{featured.stage}</span>
              </div>
              <h2 className="mt-5 text-2xl font-medium leading-snug tracking-[-0.02em] sm:text-3xl">{featured.title}</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--editor-muted)]">{featured.summary}</p>
              <p className="mt-7 text-xs text-[var(--stone-gray)]">归属：{domainLabels[featured.domain]} · 最近更新 {formatSyncTime(featured.updatedAt)}</p>
              {featured.publicUrl && (
                <Link className="mt-4 inline-block text-sm text-[var(--editor-accent)] hover:underline" href={featured.publicUrl}>查看公开成果</Link>
              )}
            </div>
          ) : (
            <div className="mt-8 min-h-48 rounded-2xl border border-dashed border-[var(--editor-line)] p-6">
              <h2 className="text-xl font-medium">等待第一条高价值想法</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--editor-muted)]">不需要在这里填写任何内容。继续使用 Flomo，Hermes 会严格筛选；没有达到门槛时，合法结果就是暂时不沉淀。</p>
            </div>
          )}
        </article>

        <aside className="grid grid-cols-3 gap-3 lg:grid-cols-1">
          {[
            ['已检查', model.checkedCount, 'Hermes 本周实际扫描'],
            ['已沉淀', model.knowledgeCount, '进入长期知识库'],
            ['已发布', model.publishedCount, '形成公开输出'],
          ].map(([label, value, detail]) => (
            <div key={label} className="rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-4 sm:p-5">
              <p className="text-xs text-[var(--stone-gray)]">{label}</p>
              <p className="mt-3 text-3xl font-medium tabular-nums">{value}</p>
              <p className="mt-2 hidden text-xs leading-5 text-[var(--editor-muted)] sm:block">{detail}</p>
            </div>
          ))}
        </aside>
      </div>

      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-xs tracking-[0.18em] text-[var(--stone-gray)] uppercase">Pipeline</p>
            <h2 className="mt-2 text-2xl font-medium">正在生长的内容</h2>
          </div>
          <p className="text-xs text-[var(--stone-gray)]">只展示成果，不在这里派任务</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {artifactsByType.map((type) => {
            const artifact = model.pipeline.find((item) => item.type === type)
            return (
              <div key={type} className="min-h-48 rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-5">
                <p className="text-xs font-semibold text-[var(--editor-accent)]">{typeLabels[type]}</p>
                {artifact ? (
                  <>
                    <h3 className="mt-5 text-lg font-medium leading-7">{artifact.title}</h3>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--editor-muted)]">{artifact.summary}</p>
                    <p className="mt-5 text-xs text-[var(--stone-gray)]">{domainLabels[artifact.domain]} · {artifact.stage}</p>
                  </>
                ) : (
                  <p className="mt-5 text-sm leading-6 text-[var(--stone-gray)]">当前没有符合门槛的项目。</p>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-6 sm:p-8">
        <div className="grid gap-8 md:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="text-xs tracking-[0.18em] text-[var(--stone-gray)] uppercase">Overview</p>
            <h2 className="mt-3 text-2xl font-medium">全局概览</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--editor-muted)]">工作、投资、知识与内容，不追求每一栏都热闹，只显示真实进展。</p>
          </div>
          <div className="grid gap-x-7 gap-y-6 sm:grid-cols-2">
            {(Object.keys(domainLabels) as Array<keyof typeof domainLabels>).map((domain) => {
              const item = snapshot?.domains[domain]
              return (
                <div key={domain} className="border-t border-[var(--editor-line)] pt-4">
                  <p className="text-sm font-medium">{domainLabels[domain]}</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--editor-muted)]">{item?.detail || '本周期暂无需要突出展示的变化'}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <footer className="flex flex-col justify-between gap-2 border-t border-[var(--editor-line)] pt-5 text-xs text-[var(--stone-gray)] sm:flex-row">
        <span>Hermes 最近同步：{formatSyncTime(model.latestRun?.finishedAt ?? null)}</span>
        <span>Flomo 输入 · chen-notes 沉淀 · D1 只存状态投影</span>
      </footer>
    </section>
  )
}

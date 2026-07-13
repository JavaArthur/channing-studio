import type {
  AgentSourceItem,
  AgentSyncRun,
  KnowledgeArtifact,
  WeeklyDashboardMetrics,
} from '@/lib/agent-knowledge/types'

export interface KnowledgeDashboard {
  state: 'empty' | 'ready' | 'blocked'
  checkedCount: number
  knowledgeCount: number
  publishedCount: number
  latestRun: AgentSyncRun | null
  blocked: { code: string; message: string; nextAction: string | null } | null
  featuredArtifact: KnowledgeArtifact | null
  pipeline: KnowledgeArtifact[]
}

export function buildKnowledgeDashboard(input: {
  latestRun: AgentSyncRun | null
  sourceItems: AgentSourceItem[]
  artifacts: KnowledgeArtifact[]
  weeklyMetrics?: WeeklyDashboardMetrics
}): KnowledgeDashboard {
  const blocked = input.latestRun && ['blocked', 'failed'].includes(input.latestRun.status)
    ? {
        code: input.latestRun.errorCode || 'UNKNOWN',
        message: input.latestRun.errorMessage || '最近一次同步未完成',
        nextAction: input.latestRun.failure?.nextAction || null,
      }
    : null
  const published = input.artifacts.filter((artifact) => artifact.type === 'published' && artifact.status === 'active')
  const pipeline = (['draft', 'topic', 'knowledge'] as const)
    .map((type) => input.artifacts.find((artifact) => artifact.type === type && artifact.status === 'active'))
    .filter((artifact): artifact is KnowledgeArtifact => Boolean(artifact))
  return {
    state: blocked ? 'blocked' : input.latestRun ? 'ready' : 'empty',
    checkedCount: input.weeklyMetrics?.checkedCount ?? input.sourceItems.length,
    knowledgeCount: input.weeklyMetrics?.knowledgeCount
      ?? input.artifacts.filter((artifact) => artifact.type === 'knowledge').length,
    publishedCount: input.weeklyMetrics?.publishedCount ?? published.length,
    latestRun: input.latestRun,
    blocked,
    featuredArtifact: published[0] || input.artifacts[0] || null,
    pipeline,
  }
}

export const AGENT_RUN_MODES = ['hourly', 'nightly', 'reconcile'] as const
export const AGENT_RUN_STATUSES = ['running', 'succeeded', 'blocked', 'failed'] as const
export const SOURCE_DECISIONS = ['ignored', 'candidate', 'processed', 'blocked'] as const
export const KNOWLEDGE_DOMAINS = ['work', 'investing', 'knowledge', 'content'] as const
export const ARTIFACT_TYPES = ['knowledge', 'topic', 'draft', 'published'] as const
export const AGENT_ERROR_CODES = [
  'FLOMO_AUTH_FAILED',
  'FLOMO_MCP_UNAVAILABLE',
  'FLOMO_WINDOW_SATURATED',
  'CHEN_NOTES_DIRTY',
  'CHEN_NOTES_PULL_FAILED',
  'CHEN_NOTES_PUSH_FAILED',
  'DASHBOARD_API_REJECTED',
] as const

export type AgentRunMode = typeof AGENT_RUN_MODES[number]
export type AgentRunStatus = typeof AGENT_RUN_STATUSES[number]
export type SourceDecision = typeof SOURCE_DECISIONS[number]
export type KnowledgeDomain = typeof KNOWLEDGE_DOMAINS[number]
export type KnowledgeArtifactType = typeof ARTIFACT_TYPES[number]
export type AgentErrorCode = typeof AGENT_ERROR_CODES[number]

export interface AgentRunStartInput {
  source: 'flomo'
  mode: AgentRunMode
  windowStart: string
  windowEnd: string
}

export interface AgentSourceItemInput {
  sourceId: string
  sourceUpdatedAt: string
  contentHash: string
  decision: SourceDecision
  domain: KnowledgeDomain
  decisionReason: string
}

export interface KnowledgeArtifactInput {
  artifactKey: string
  type: KnowledgeArtifactType
  domain: KnowledgeDomain
  stage: string
  title: string
  summary: string
  sourceIds: string[]
  targetPath?: string | null
  publicUrl?: string | null
  status?: 'active' | 'archived' | 'blocked'
}

export interface DashboardDomainSnapshot {
  label: string
  detail: string
  status: 'active' | 'done' | 'blocked' | 'quiet'
}

export interface DashboardSnapshot {
  periodLabel: string
  narrative: string
  domains: Partial<Record<KnowledgeDomain, DashboardDomainSnapshot>>
}

export interface CompleteAgentRunInput {
  discoveredCount: number
  sourceItems: AgentSourceItemInput[]
  artifacts: KnowledgeArtifactInput[]
  snapshot?: DashboardSnapshot | null
}

export interface FailAgentRunInput {
  code: AgentErrorCode
  message: string
  retryable: boolean
  nextAction: string
}

export interface AgentSyncRun {
  id: string
  source: 'flomo'
  mode: AgentRunMode
  status: AgentRunStatus
  windowStart: string
  windowEnd: string
  discoveredCount: number
  selectedCount: number
  artifactCount: number
  errorCode: string | null
  errorMessage: string | null
  snapshot: DashboardSnapshot | null
  failure: { retryable: boolean; nextAction: string } | null
  startedAt: number
  finishedAt: number | null
}

export interface AgentSourceItem extends AgentSourceItemInput {
  firstSeenAt: number
  lastSeenAt: number
  processedAt: number | null
  lastRunId: string
}

export interface KnowledgeArtifact extends KnowledgeArtifactInput {
  status: 'active' | 'archived' | 'blocked'
  firstSeenAt: number
  updatedAt: number
}

export interface WeeklyDashboardMetrics {
  checkedCount: number
  knowledgeCount: number
  publishedCount: number
}

import {
  AGENT_RUN_MODES,
  AGENT_ERROR_CODES,
  ARTIFACT_TYPES,
  KNOWLEDGE_DOMAINS,
  SOURCE_DECISIONS,
  type AgentRunStartInput,
  type AgentSourceItemInput,
  type CompleteAgentRunInput,
  type DashboardSnapshot,
  type FailAgentRunInput,
  type KnowledgeArtifactInput,
} from '@/lib/agent-knowledge/types'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/
const URL_RE = /https?:\/\//i
const CREDENTIAL_RE = /(?:fmcp_|authorization\s*:|bearer\s+|x-amz-(?:signature|credential)|x-goog-signature)/i
const SIGNED_QUERY_KEYS = new Set([
  'token', 'access_token', 'signature', 'sig', 'expires',
  'x-amz-signature', 'x-amz-credential', 'x-goog-signature',
])

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} 必须是对象`)
  }
}

function assertAllowedKeys(value: Record<string, unknown>, allowed: readonly string[], label: string) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) {
    throw new Error(`${label} 包含不允许的字段`)
  }
}

function requiredString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} 不能为空`)
  const normalized = value.trim()
  if (normalized.length > maxLength) throw new Error(`${label} 过长`)
  return normalized
}

function optionalString(value: unknown, label: string, maxLength: number): string | null {
  if (value == null || value === '') return null
  return requiredString(value, label, maxLength)
}

function requiredProjectionString(value: unknown, label: string, maxLength: number): string {
  const normalized = requiredString(value, label, maxLength)
  if (URL_RE.test(normalized) || CREDENTIAL_RE.test(normalized)) {
    throw new Error(`${label} 不能包含 URL 或凭据`)
  }
  return normalized
}

function optionalTargetPath(value: unknown): string | null {
  const path = optionalString(value, 'targetPath', 500)
  if (path && (path.includes('://') || CREDENTIAL_RE.test(path))) {
    throw new Error('targetPath 必须是脱敏后的仓库路径')
  }
  return path
}

function optionalPublicUrl(value: unknown): string | null {
  const raw = optionalString(value, 'publicUrl', 1000)
  if (!raw) return null
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error('publicUrl 必须是有效的公开 URL')
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('publicUrl 必须使用公开的 HTTP(S) 地址')
  }
  if (CREDENTIAL_RE.test(raw) || [...parsed.searchParams.keys()].some((key) => SIGNED_QUERY_KEYS.has(key.toLowerCase()))) {
    throw new Error('publicUrl 不能包含签名或凭据参数')
  }
  return raw
}

function parseSourceItem(value: unknown): AgentSourceItemInput {
  assertObject(value, 'sourceItems')
  assertAllowedKeys(value, [
    'sourceId', 'sourceUpdatedAt', 'contentHash', 'decision', 'domain', 'decisionReason',
  ], 'sourceItems')
  const sourceUpdatedAt = requiredString(value.sourceUpdatedAt, 'sourceUpdatedAt', 40)
  if (!ISO_DATE_RE.test(sourceUpdatedAt)) throw new Error('sourceUpdatedAt 必须是 UTC ISO8601 时间')
  const decision = requiredString(value.decision, 'decision', 20)
  if (!SOURCE_DECISIONS.includes(decision as never)) throw new Error('decision 不合法')
  const domain = requiredString(value.domain, 'domain', 20)
  if (!KNOWLEDGE_DOMAINS.includes(domain as never)) throw new Error('domain 不合法')
  return {
    sourceId: requiredString(value.sourceId, 'sourceId', 128),
    sourceUpdatedAt,
    contentHash: requiredString(value.contentHash, 'contentHash', 128),
    decision: decision as AgentSourceItemInput['decision'],
    domain: domain as AgentSourceItemInput['domain'],
    decisionReason: requiredProjectionString(value.decisionReason, 'decisionReason', 300),
  }
}

function parseArtifact(value: unknown): KnowledgeArtifactInput {
  assertObject(value, 'artifacts')
  assertAllowedKeys(value, [
    'artifactKey', 'type', 'domain', 'stage', 'title', 'summary', 'sourceIds',
    'targetPath', 'publicUrl', 'status',
  ], 'artifacts')
  const type = requiredString(value.type, 'type', 20)
  if (!ARTIFACT_TYPES.includes(type as never)) throw new Error('type 不合法')
  const domain = requiredString(value.domain, 'domain', 20)
  if (!KNOWLEDGE_DOMAINS.includes(domain as never)) throw new Error('domain 不合法')
  if (!Array.isArray(value.sourceIds) || value.sourceIds.length === 0 || value.sourceIds.length > 20) {
    throw new Error('sourceIds 必须包含 1-20 个来源')
  }
  const sourceIds = value.sourceIds.map((id) => requiredString(id, 'sourceId', 128))
  const status = value.status == null ? 'active' : requiredString(value.status, 'status', 20)
  if (!['active', 'archived', 'blocked'].includes(status)) throw new Error('status 不合法')
  return {
    artifactKey: requiredString(value.artifactKey, 'artifactKey', 180),
    type: type as KnowledgeArtifactInput['type'],
    domain: domain as KnowledgeArtifactInput['domain'],
    stage: requiredString(value.stage, 'stage', 80),
    title: requiredString(value.title, 'title', 200),
    summary: requiredProjectionString(value.summary, 'summary', 500),
    sourceIds,
    targetPath: optionalTargetPath(value.targetPath),
    publicUrl: optionalPublicUrl(value.publicUrl),
    status: status as KnowledgeArtifactInput['status'],
  }
}

function parseSnapshot(value: unknown): DashboardSnapshot | null {
  if (value == null) return null
  assertObject(value, 'snapshot')
  assertAllowedKeys(value, ['periodLabel', 'narrative', 'domains'], 'snapshot')
  assertObject(value.domains, 'snapshot.domains')
  const domains: DashboardSnapshot['domains'] = {}
  for (const [key, domainValue] of Object.entries(value.domains)) {
    if (!KNOWLEDGE_DOMAINS.includes(key as never)) throw new Error('snapshot domain 不合法')
    assertObject(domainValue, 'snapshot domain')
    assertAllowedKeys(domainValue, ['label', 'detail', 'status'], 'snapshot domain')
    const status = requiredString(domainValue.status, 'snapshot status', 20)
    if (!['active', 'done', 'blocked', 'quiet'].includes(status)) throw new Error('snapshot status 不合法')
    domains[key as keyof DashboardSnapshot['domains']] = {
      label: requiredString(domainValue.label, 'snapshot label', 40),
      detail: requiredProjectionString(domainValue.detail, 'snapshot detail', 200),
      status: status as 'active' | 'done' | 'blocked' | 'quiet',
    }
  }
  return {
    periodLabel: requiredString(value.periodLabel, 'periodLabel', 80),
    narrative: requiredProjectionString(value.narrative, 'narrative', 500),
    domains,
  }
}

export function parseRunStartPayload(value: unknown): AgentRunStartInput {
  assertObject(value, '请求体')
  assertAllowedKeys(value, ['source', 'mode', 'windowStart', 'windowEnd'], '请求体')
  if (value.source !== 'flomo') throw new Error('source 只支持 flomo')
  const mode = requiredString(value.mode, 'mode', 20)
  if (!AGENT_RUN_MODES.includes(mode as never)) throw new Error('mode 不合法')
  const windowStart = requiredString(value.windowStart, 'windowStart', 10)
  const windowEnd = requiredString(value.windowEnd, 'windowEnd', 10)
  if (!DATE_RE.test(windowStart) || !DATE_RE.test(windowEnd) || windowStart > windowEnd) {
    throw new Error('时间窗口不合法')
  }
  return { source: 'flomo', mode: mode as AgentRunStartInput['mode'], windowStart, windowEnd }
}

export function parseCompleteRunPayload(value: unknown): CompleteAgentRunInput {
  assertObject(value, '请求体')
  assertAllowedKeys(value, ['discoveredCount', 'sourceItems', 'artifacts', 'snapshot'], '请求体')
  if (!Number.isSafeInteger(value.discoveredCount) || Number(value.discoveredCount) < 0) {
    throw new Error('discoveredCount 必须是非负整数')
  }
  if (!Array.isArray(value.sourceItems) || !Array.isArray(value.artifacts)) {
    throw new Error('sourceItems 和 artifacts 必须是数组')
  }
  if (value.sourceItems.length > 50) throw new Error('sourceItems 单批最多 50 条')
  if (value.artifacts.length > 50) throw new Error('artifacts 单批最多 50 条')
  if (Number(value.discoveredCount) < value.sourceItems.length) {
    throw new Error('discoveredCount 不能小于 sourceItems 数量')
  }
  const sourceItems = value.sourceItems.map(parseSourceItem)
  const artifacts = value.artifacts.map(parseArtifact)
  if (new Set(sourceItems.map((item) => item.sourceId)).size !== sourceItems.length) {
    throw new Error('sourceItems 不能包含重复 sourceId')
  }
  if (new Set(artifacts.map((artifact) => artifact.artifactKey)).size !== artifacts.length) {
    throw new Error('artifacts 不能包含重复 artifactKey')
  }
  const batchSourceIds = new Set(sourceItems.map((item) => item.sourceId))
  if (artifacts.some((artifact) => artifact.sourceIds.some((id) => !batchSourceIds.has(id)))) {
    throw new Error('artifact 的 sourceIds 必须出现在同批 sourceItems 中')
  }
  return {
    discoveredCount: Number(value.discoveredCount),
    sourceItems,
    artifacts,
    snapshot: parseSnapshot(value.snapshot),
  }
}

export function parseFailRunPayload(value: unknown): FailAgentRunInput {
  assertObject(value, '请求体')
  assertAllowedKeys(value, ['code', 'message', 'retryable', 'nextAction'], '请求体')
  const code = requiredString(value.code, 'code', 60)
  if (!AGENT_ERROR_CODES.includes(code as never)) throw new Error('code 不合法')
  if (typeof value.retryable !== 'boolean') throw new Error('retryable 必须是布尔值')
  return {
    code: code as FailAgentRunInput['code'],
    message: requiredProjectionString(value.message, 'message', 500),
    retryable: value.retryable,
    nextAction: requiredProjectionString(value.nextAction, 'nextAction', 300),
  }
}

export function isIncomingSourceItemNewer(
  current: Pick<AgentSourceItemInput, 'sourceUpdatedAt' | 'contentHash'>,
  incoming: Pick<AgentSourceItemInput, 'sourceUpdatedAt' | 'contentHash'>,
): boolean {
  return incoming.sourceUpdatedAt > current.sourceUpdatedAt || (
    incoming.sourceUpdatedAt === current.sourceUpdatedAt && incoming.contentHash !== current.contentHash
  )
}

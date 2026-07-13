import { describe, expect, it } from 'vitest'
import {
  isIncomingSourceItemNewer,
  parseCompleteRunPayload,
  parseRunStartPayload,
} from '@/lib/agent-knowledge/validation'
import { buildKnowledgeDashboard } from '@/lib/agent-knowledge/dashboard'

describe('agent knowledge validation', () => {
  it('accepts a bounded hourly run window', () => {
    expect(parseRunStartPayload({
      source: 'flomo',
      mode: 'hourly',
      windowStart: '2026-07-12',
      windowEnd: '2026-07-13',
    })).toEqual({
      source: 'flomo',
      mode: 'hourly',
      windowStart: '2026-07-12',
      windowEnd: '2026-07-13',
    })
  })

  it('rejects completion batches above the flomo search limit', () => {
    const sourceItems = Array.from({ length: 51 }, (_, index) => ({
      sourceId: `memo-${index}`,
      sourceUpdatedAt: '2026-07-13T08:00:00Z',
      contentHash: `hash-${index}`,
      decision: 'ignored',
      domain: 'knowledge',
      decisionReason: '没有达到长期沉淀门槛',
    }))

    expect(() => parseCompleteRunPayload({ discoveredCount: 51, sourceItems, artifacts: [] }))
      .toThrow('sourceItems 单批最多 50 条')
  })

  it('rejects raw flomo content and attachment fields', () => {
    expect(() => parseCompleteRunPayload({
      discoveredCount: 1,
      sourceItems: [{
        sourceId: 'memo-1',
        sourceUpdatedAt: '2026-07-13T08:00:00Z',
        contentHash: 'hash-1',
        decision: 'candidate',
        domain: 'content',
        decisionReason: '存在明确观点和真实案例',
        content: '不应进入网站的 Flomo 原文',
      }],
      artifacts: [],
    })).toThrow('sourceItems 包含不允许的字段')

    expect(() => parseCompleteRunPayload({
      discoveredCount: 0,
      sourceItems: [],
      artifacts: [{
        artifactKey: 'draft:agent-boundary',
        type: 'draft',
        domain: 'content',
        stage: 'writing',
        title: 'Agent 安全边界',
        summary: '从两条记录中整理出的写作方向',
        sourceIds: ['memo-1'],
        attachments: ['https://example.com/signed'],
      }],
    })).toThrow('artifacts 包含不允许的字段')
  })

  it('rejects signed URLs and URLs hidden inside projection summaries', () => {
    const sourceItem = {
      sourceId: 'memo-1',
      sourceUpdatedAt: '2026-07-13T08:00:00Z',
      contentHash: 'a'.repeat(64),
      decision: 'processed',
      domain: 'content',
      decisionReason: '有明确判断和真实案例',
    }
    const artifact = {
      artifactKey: 'published:agent-boundary',
      type: 'published',
      domain: 'content',
      stage: 'published',
      title: 'Agent 安全边界',
      summary: '从两条记录中整理出的公开结论',
      sourceIds: ['memo-1'],
      publicUrl: 'https://example.com/file?X-Amz-Signature=secret',
    }

    expect(() => parseCompleteRunPayload({ discoveredCount: 1, sourceItems: [sourceItem], artifacts: [artifact] }))
      .toThrow('publicUrl 不能包含签名或凭据参数')
    expect(() => parseCompleteRunPayload({
      discoveredCount: 1,
      sourceItems: [sourceItem],
      artifacts: [{ ...artifact, publicUrl: 'https://example.com/post', summary: '附件见 https://example.com/file' }],
    })).toThrow('summary 不能包含 URL 或凭据')
  })

  it('requires every artifact source to be versioned in the same completion batch', () => {
    expect(() => parseCompleteRunPayload({
      discoveredCount: 0,
      sourceItems: [],
      artifacts: [{
        artifactKey: 'topic:orphan',
        type: 'topic',
        domain: 'content',
        stage: 'candidate',
        title: '缺少来源版本',
        summary: '这条成果没有随批次提交来源版本。',
        sourceIds: ['memo-missing'],
      }],
    })).toThrow('artifact 的 sourceIds 必须出现在同批 sourceItems 中')
  })

  it('requires an accurate discovered count for unchanged memo scans', () => {
    expect(() => parseCompleteRunPayload({ sourceItems: [], artifacts: [] }))
      .toThrow('discoveredCount 必须是非负整数')
    expect(() => parseCompleteRunPayload({
      discoveredCount: Number.MAX_SAFE_INTEGER + 1,
      sourceItems: [],
      artifacts: [],
    })).toThrow('discoveredCount 必须是非负整数')
    expect(() => parseCompleteRunPayload({
      discoveredCount: 0,
      sourceItems: [{
        sourceId: 'memo-1',
        sourceUpdatedAt: '2026-07-13T08:00:00Z',
        contentHash: 'hash-1',
        decision: 'ignored',
        domain: 'knowledge',
        decisionReason: '未达到筛选门槛',
      }],
      artifacts: [],
    })).toThrow('discoveredCount 不能小于 sourceItems 数量')
  })

  it('only treats a changed or later source version as newer', () => {
    const current = {
      sourceUpdatedAt: '2026-07-13T08:00:00Z',
      contentHash: 'hash-a',
    }

    expect(isIncomingSourceItemNewer(current, {
      sourceUpdatedAt: '2026-07-13T07:59:59Z',
      contentHash: 'hash-b',
    })).toBe(false)
    expect(isIncomingSourceItemNewer(current, {
      sourceUpdatedAt: '2026-07-13T08:00:00Z',
      contentHash: 'hash-a',
    })).toBe(false)
    expect(isIncomingSourceItemNewer(current, {
      sourceUpdatedAt: '2026-07-13T08:00:00Z',
      contentHash: 'hash-b',
    })).toBe(true)
  })
})

describe('knowledge dashboard model', () => {
  it('returns a first-sync state without inventing metrics', () => {
    expect(buildKnowledgeDashboard({ latestRun: null, sourceItems: [], artifacts: [] }))
      .toMatchObject({ state: 'empty', checkedCount: 0, knowledgeCount: 0, publishedCount: 0 })
  })

  it('surfaces a blocked run instead of presenting stale data as current', () => {
    const dashboard = buildKnowledgeDashboard({
      latestRun: {
        id: 'run-1',
        source: 'flomo',
        mode: 'nightly',
        status: 'blocked',
        windowStart: '2026-07-13',
        windowEnd: '2026-07-13',
        discoveredCount: 2,
        selectedCount: 1,
        artifactCount: 0,
        errorCode: 'CHEN_NOTES_PULL_FAILED',
        errorMessage: '远端同步失败',
        snapshot: null,
        failure: { retryable: true, nextAction: '修复 GitHub 凭据后重试' },
        startedAt: 1,
        finishedAt: 2,
      },
      sourceItems: [],
      artifacts: [],
    })

    expect(dashboard).toMatchObject({
      state: 'blocked',
      blocked: {
        code: 'CHEN_NOTES_PULL_FAILED',
        message: '远端同步失败',
        nextAction: '修复 GitHub 凭据后重试',
      },
    })
  })

  it('uses explicit weekly aggregates instead of the truncated artifact list', () => {
    const dashboard = buildKnowledgeDashboard({
      latestRun: null,
      sourceItems: [],
      artifacts: [],
      weeklyMetrics: { checkedCount: 42, knowledgeCount: 7, publishedCount: 3 },
    })
    expect(dashboard).toMatchObject({ checkedCount: 42, knowledgeCount: 7, publishedCount: 3 })
  })
})

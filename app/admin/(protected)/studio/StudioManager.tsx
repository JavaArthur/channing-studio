'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { FeaturedPostPicker } from '@/components/FeaturedPostPicker'
import * as Tabs from '@radix-ui/react-tabs'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/admin/ui'
import { useUnsavedChanges } from '@/components/admin/UnsavedChanges'
import { useState } from 'react'
import {
  DEFAULT_HOME_MODULES,
  type HomeModulesConfig,
  type StudioCapability,
  type StudioContent,
  type StudioLab,
} from '@/lib/studio-content'

interface StudioManagerProps {
  initialRevision: number
  initialContent: StudioContent
}

const inputClass =
  'w-full rounded-[var(--radius-sm)] border border-[var(--editor-line)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--editor-ink)] outline-none transition-colors focus:border-[var(--focus-ring)]'
const cardClass =
  'rounded-[var(--radius-md)] border border-[var(--editor-line)] bg-[var(--editor-panel)] p-4 sm:p-5'

const WRITING_LIMIT_OPTIONS = [3, 5, 8, 10] as const
const PROJECTS_LIMIT_OPTIONS = [2, 3, 4, 6] as const

function updateAt<T>(items: T[], index: number, patch: Partial<T>): T[] {
  return items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
}

function moveAt<T>(items: T[], index: number, offset: -1 | 1): T[] {
  const target = index + offset
  if (target < 0 || target >= items.length) return items
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

function normalizeContent(content: StudioContent): StudioContent {
  return {
    ...content,
    homeModules: {
      ...DEFAULT_HOME_MODULES,
      ...(content.homeModules ?? {}),
    },
  }
}

function ModuleSwitch({
  checked,
  label,
  onToggle,
}: {
  checked: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className="min-h-11 min-w-11 inline-flex shrink-0 items-center justify-end focus:outline-none"
    >
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
          checked
            ? 'border-transparent bg-[var(--cta-bg)]'
            : 'border-[var(--editor-line-strong)] bg-[var(--editor-sand)]'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-[var(--cta-ink)] shadow-xs transition-transform ${
            checked ? 'translate-x-5.5' : 'translate-x-1'
          }`}
        />
      </span>
    </button>
  )
}

export function StudioManager({ initialContent, initialRevision }: StudioManagerProps) {
  const router = useRouter()
  const search = useSearchParams()
  const tabs = [
    { id: 'modules', label: '首页模块插拔' },
    { id: 'profile', label: '个人名片' },
    { id: 'capabilities', label: '关注方向' },
    { id: 'labs', label: '实验室' },
    { id: 'contacts', label: '联系链接' },
    { id: 'writing', label: '精选置顶文章' },
  ]
  const tab = tabs.some((t) => t.id === search.get('section'))
    ? search.get('section')!
    : 'modules'

  const [draft, setDraft] = useState<StudioContent>(() => normalizeContent(initialContent))
  const [savedDraft, setSavedDraft] = useState(() =>
    JSON.stringify(normalizeContent(initialContent)),
  )
  const [revision, setRevision] = useState(initialRevision)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const modules = draft.homeModules ?? DEFAULT_HOME_MODULES
  const isDirty = JSON.stringify(draft) !== savedDraft

  const selectTab = (nextTab: string) => {
    router.replace(
      nextTab === 'modules' ? '/admin/studio' : `/admin/studio?section=${nextTab}`,
      { scroll: false },
    )
  }

  const updateModules = (patch: Partial<HomeModulesConfig>) => {
    setDraft((current) => ({
      ...current,
      homeModules: {
        ...(current.homeModules ?? DEFAULT_HOME_MODULES),
        ...patch,
      },
    }))
  }

  const updateProfile = (key: keyof StudioContent['profile'], value: string) => {
    setDraft((current) => ({ ...current, profile: { ...current.profile, [key]: value } }))
  }

  const updateCapability = (index: number, patch: Partial<StudioCapability>) => {
    setDraft((current) => ({
      ...current,
      profile: {
        ...current.profile,
        capabilities: updateAt(current.profile.capabilities, index, patch),
      },
    }))
  }

  const updateLab = (index: number, patch: Partial<StudioLab>) => {
    setDraft((current) => ({ ...current, labs: updateAt(current.labs, index, patch) }))
  }

  const removeCapability = (index: number) =>
    setDraft((current) => ({
      ...current,
      profile: {
        ...current.profile,
        capabilities: current.profile.capabilities.filter((_, itemIndex) => itemIndex !== index),
      },
    }))

  const removeLab = (index: number) =>
    setDraft((current) => ({
      ...current,
      labs: current.labs.filter((_, itemIndex) => itemIndex !== index),
    }))

  const save = async () => {
    if (saving) return false
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/admin/studio', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft, revision }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || '保存失败')
      setRevision(result.revision)
      setMessage('已保存，公开页面刷新后生效。')
      setSavedDraft(JSON.stringify(draft))
      return true
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败，请稍后重试')
      return false
    } finally {
      setSaving(false)
    }
  }

  useUnsavedChanges(isDirty, save, () => setDraft(JSON.parse(savedDraft)))

  const activeModuleCount = [
    modules.featuredEssay,
    modules.writing,
    modules.focusAreas,
    modules.projects,
    modules.tools,
    modules.prompts,
  ].filter(Boolean).length

  const moduleCards: Array<{
    key: keyof Pick<
      HomeModulesConfig,
      'featuredEssay' | 'writing' | 'focusAreas' | 'projects' | 'tools' | 'prompts'
    >
    code: string
    title: string
    description: string
    enabled: boolean
    limitType?: 'writing' | 'projects'
    jumpLabel: string
    jumpHref?: string
    jumpSection?: string
  }> = [
    {
      key: 'featuredEssay',
      code: '01 // HERO ESSAY',
      title: '首屏精选长文',
      description: '在博客首屏右侧以手稿标本卡吐出第 1 篇精选或最新文章；关闭后首屏收敛为单栏导语。',
      enabled: modules.featuredEssay,
      jumpLabel: '管理文章列表',
      jumpHref: '/admin/posts',
    },
    {
      key: 'writing',
      code: '02 // BLOG STREAM',
      title: '最新文章流',
      description: '晨启AI博客核心阅读流，按精选置顶与发布时间顺序向首页吐出已发布文章。',
      enabled: modules.writing,
      limitType: 'writing',
      jumpLabel: '去写文章 / 管理手稿',
      jumpHref: '/admin/posts',
    },
    {
      key: 'focusAreas',
      code: '03 // FOCUS RAIL',
      title: '关注方向侧栏',
      description: '在最新文章流旁侧展示当前专注的 AI 工程命题与技术方向，强化个人技术博客脉络。',
      enabled: modules.focusAreas,
      jumpLabel: '编辑关注方向',
      jumpSection: 'capabilities',
    },
    {
      key: 'projects',
      code: '04 // SIDE PROJECTS',
      title: '开源与实践项目',
      description: '将项目导航中已标记公开的项目吐出到文章流下方；拔除后首页不留空白并自动重排编号。',
      enabled: modules.projects,
      limitType: 'projects',
      jumpLabel: '管理项目导航',
      jumpHref: '/admin/portfolio',
    },
    {
      key: 'tools',
      code: '05 // TOOLKIT',
      title: '工具收藏吐出',
      description: '将工作台中已审校公开的开发利器吐出至首页百宝箱区；私人工作版本始终隔离保存。',
      enabled: modules.tools,
      jumpLabel: '管理工具收藏',
      jumpHref: '/admin/tools',
    },
    {
      key: 'prompts',
      code: '06 // PROMPTS',
      title: '提示词吐出',
      description: '将已脱敏审校的提示词标本吐出至首页；与工具同关时整个百宝箱板块自动从首页收起。',
      enabled: modules.prompts,
      jumpLabel: '管理提示词库',
      jumpHref: '/admin/prompts',
    },
  ]

  return (
    <div className="studio-settings atelier-surface-page">
      <div className="workspace-page-heading">
        <div>
          <span className="atelier-eyebrow">
            <span className="atelier-beacon" data-tone="vermilion" aria-hidden="true" />
            PUBLICATION // HOMEPAGE PROJECTION
          </span>
          <h1 className="text-xl font-semibold text-[var(--editor-ink)]">
            博客首页编排 · 可插拔吐出
          </h1>
          <p className="mt-1 text-sm text-[var(--editor-muted)]">
            在私人工作台决定哪些模块向「晨启AI」公开博客首页（/）吐出，保存后对访客生效。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/" target="_blank" className="admin-button">
            预览博客首页
            <ArrowUpRight size={14} />
          </Link>
          <Button
            variant="primary"
            className="atelier-cta-vermilion"
            onClick={save}
            disabled={saving}
          >
            {saving ? '保存中…' : '确认更新公开站点'}
          </Button>
        </div>
      </div>

      {message && (
        <p
          role="status"
          className="mb-4 rounded-[var(--radius-sm)] border border-[var(--success-line)] bg-[var(--success-soft-bg)] px-3.5 py-2.5 text-sm text-[var(--success)]"
        >
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-[var(--radius-sm)] border border-[var(--danger-line)] bg-[var(--danger-soft-bg)] px-3.5 py-2.5 text-sm text-[var(--danger)]"
        >
          {error}
        </p>
      )}

      <Tabs.Root value={tab} onValueChange={selectTab}>
        <Tabs.List className="studio-tabs" aria-label="公开内容设置">
          {tabs.map((item) => (
            <Tabs.Trigger key={item.id} value={item.id}>
              {item.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </Tabs.Root>

      {tab === 'modules' && (
        <div className="space-y-5">
          {/* 投影链路总览与一键预设 */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--editor-line)] bg-[var(--editor-panel)] px-4 py-3.5 sm:px-5">
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <span className="atelier-mono font-medium text-[var(--editor-ink)]">
                晨启 · 私人工作台
              </span>
              <span className="atelier-mono text-[var(--stone-gray)]">──▶</span>
              <span className="atelier-badge" data-tone="vermilion">
                <span
                  className="atelier-beacon"
                  data-tone={activeModuleCount > 0 ? 'healthy' : 'warning'}
                  aria-hidden="true"
                />
                已吐出 {activeModuleCount} / 6 个模块
              </span>
              <span className="atelier-mono text-[var(--stone-gray)]">──▶</span>
              <span className="atelier-mono font-medium text-[var(--editor-ink)]">
                晨启AI 博客首页 (/)
              </span>
              {isDirty && (
                <span className="atelier-badge">
                  <span className="atelier-beacon" data-tone="warning" aria-hidden="true" />
                  修改待确认更新
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  updateModules({
                    featuredEssay: true,
                    writing: true,
                    focusAreas: true,
                    projects: false,
                    tools: false,
                    prompts: false,
                  })
                }
                className="admin-button text-xs"
              >
                预设：纯净技术博客
              </button>
              <button
                type="button"
                onClick={() =>
                  updateModules({
                    featuredEssay: true,
                    writing: true,
                    focusAreas: true,
                    projects: true,
                    tools: true,
                    prompts: true,
                  })
                }
                className="admin-button text-xs"
              >
                预设：全量模块吐出
              </button>
            </div>
          </div>

          {/* 6 张可插拔开关卡 */}
          <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
            {moduleCards.map((card) => (
              <article
                key={card.key}
                className={`atelier-dossier flex flex-col justify-between p-4 transition-colors sm:p-5 ${
                  card.enabled
                    ? 'border-[var(--editor-line-strong)] bg-[var(--editor-panel)]'
                    : 'border-[var(--editor-line)] bg-[var(--background)]/75'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="atelier-mono block text-[11px] tracking-wider text-[var(--stone-gray)]">
                        {card.code}
                      </span>
                      <h2 className="mt-1 text-base font-semibold text-[var(--editor-ink)]">
                        {card.title}
                      </h2>
                    </div>
                    <ModuleSwitch
                      checked={card.enabled}
                      label={`${card.title}吐出开关`}
                      onToggle={() => updateModules({ [card.key]: !card.enabled })}
                    />
                  </div>

                  <div className="mt-2.5">
                    {card.enabled ? (
                      <span className="atelier-badge" data-tone="vermilion">
                        <span className="atelier-beacon" data-tone="healthy" aria-hidden="true" />
                        已吐出至首页
                      </span>
                    ) : (
                      <span className="atelier-badge">
                        <span className="atelier-beacon" aria-hidden="true" />
                        仅工作台内部保留
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-[var(--editor-muted)]">
                    {card.description}
                  </p>

                  {card.limitType === 'writing' && (
                    <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-dashed border-[var(--editor-line)] pt-3">
                      <span className="atelier-mono mr-1 text-[11px] text-[var(--stone-gray)]">
                        首页篇数
                      </span>
                      {WRITING_LIMIT_OPTIONS.map((n) => {
                        const selected = modules.writingLimit === n
                        return (
                          <button
                            key={n}
                            type="button"
                            disabled={!card.enabled}
                            aria-pressed={selected}
                            onClick={() => updateModules({ writingLimit: n })}
                            className={`atelier-mono min-h-8 min-w-9 rounded-[var(--radius-xs)] border px-2 py-1 text-xs transition-colors disabled:opacity-40 ${
                              selected
                                ? 'border-[var(--editor-accent)] bg-[var(--editor-accent)] font-semibold text-[var(--editor-accent-ink)]'
                                : 'border-[var(--editor-line)] bg-[var(--background)] text-[var(--editor-muted)] hover:text-[var(--editor-ink)]'
                            }`}
                          >
                            {n} 篇
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {card.limitType === 'projects' && (
                    <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-dashed border-[var(--editor-line)] pt-3">
                      <span className="atelier-mono mr-1 text-[11px] text-[var(--stone-gray)]">
                        展示上限
                      </span>
                      {PROJECTS_LIMIT_OPTIONS.map((n) => {
                        const selected = modules.projectsLimit === n
                        return (
                          <button
                            key={n}
                            type="button"
                            disabled={!card.enabled}
                            aria-pressed={selected}
                            onClick={() => updateModules({ projectsLimit: n })}
                            className={`atelier-mono min-h-8 min-w-9 rounded-[var(--radius-xs)] border px-2 py-1 text-xs transition-colors disabled:opacity-40 ${
                              selected
                                ? 'border-[var(--editor-accent)] bg-[var(--editor-accent)] font-semibold text-[var(--editor-accent-ink)]'
                                : 'border-[var(--editor-line)] bg-[var(--background)] text-[var(--editor-muted)] hover:text-[var(--editor-ink)]'
                            }`}
                          >
                            {n} 个
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-[var(--editor-line)] pt-3 text-xs">
                  {card.jumpHref ? (
                    <Link
                      href={card.jumpHref}
                      className="inline-flex items-center gap-1 font-medium text-[var(--atelier-vermilion)] hover:underline"
                    >
                      {card.jumpLabel} →
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => card.jumpSection && selectTab(card.jumpSection)}
                      className="inline-flex items-center gap-1 font-medium text-[var(--atelier-vermilion)] hover:underline"
                    >
                      {card.jumpLabel} →
                    </button>
                  )}
                  <span className="atelier-mono text-[11px] text-[var(--stone-gray)]">
                    {card.enabled ? 'PROJECTED' : 'PRIVATE'}
                  </span>
                </div>
              </article>
            ))}
          </div>

          {/* 快捷文章挑选 + 刊头标识速调 */}
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className={cardClass}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="atelier-mono text-[11px] text-[var(--stone-gray)]">
                    FEATURED PICKER //
                  </span>
                  <h2 className="text-sm font-semibold text-[var(--editor-ink)]">
                    首屏精选与置顶文章快捷编排
                  </h2>
                </div>
                <Link
                  href="/editor?new=1"
                  className="text-xs font-medium text-[var(--atelier-vermilion)] hover:underline"
                >
                  + 写新文章
                </Link>
              </div>
              <FeaturedPostPicker
                selected={draft.featuredPostSlugs}
                onChange={(slugs) =>
                  setDraft((current) => ({ ...current, featuredPostSlugs: slugs }))
                }
              />
            </div>

            <div className={`${cardClass} flex flex-col justify-between gap-4`}>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="atelier-mono text-[11px] text-[var(--stone-gray)]">
                      BLOG IDENTITY //
                    </span>
                    <h2 className="text-sm font-semibold text-[var(--editor-ink)]">
                      博客刊头与签名速调
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => selectTab('profile')}
                    className="text-xs font-medium text-[var(--atelier-vermilion)] hover:underline"
                  >
                    完整名片 →
                  </button>
                </div>
                <label className="block text-xs font-medium text-[var(--editor-muted)]">
                  眉题
                  <input
                    className={`min-h-11 min-w-11 ${inputClass} mt-1.5`}
                    value={draft.profile.eyebrow}
                    onChange={(event) => updateProfile('eyebrow', event.target.value)}
                  />
                </label>
                <label className="block text-xs font-medium text-[var(--editor-muted)]">
                  副标题
                  <input
                    className={`min-h-11 min-w-11 ${inputClass} mt-1.5`}
                    value={draft.profile.subtitle}
                    onChange={(event) => updateProfile('subtitle', event.target.value)}
                  />
                </label>
              </div>
              <p className="border-t border-[var(--editor-line)] pt-3 text-xs leading-relaxed text-[var(--stone-gray)]">
                对外品牌统一为「晨启AI」，访客侧不展示任何后台入口或工作台概念。
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === 'profile' && (
        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--editor-ink)]">个人与博客名片</h2>
            <p className="mt-1 text-xs text-[var(--editor-muted)]">
              用于晨启AI博客首屏导语与关于作者页面。
            </p>
          </div>
          <div className={`${cardClass} grid gap-4 sm:grid-cols-2`}>
            <label className="text-xs font-medium text-[var(--editor-muted)]">
              眉题
              <input
                className={`min-h-11 min-w-11 ${inputClass} mt-1.5`}
                value={draft.profile.eyebrow}
                onChange={(event) => updateProfile('eyebrow', event.target.value)}
              />
            </label>
            <label className="text-xs font-medium text-[var(--editor-muted)]">
              副标题
              <input
                className={`min-h-11 min-w-11 ${inputClass} mt-1.5`}
                value={draft.profile.subtitle}
                onChange={(event) => updateProfile('subtitle', event.target.value)}
              />
            </label>
            <label className="text-xs font-medium text-[var(--editor-muted)] sm:col-span-2">
              主标题
              <textarea
                className={`min-h-11 min-w-11 ${inputClass} mt-1.5 min-h-20 resize-y`}
                value={draft.profile.title}
                onChange={(event) => updateProfile('title', event.target.value)}
              />
            </label>
            <label className="text-xs font-medium text-[var(--editor-muted)] sm:col-span-2">
              主张
              <textarea
                className={`min-h-11 min-w-11 ${inputClass} mt-1.5 min-h-24 resize-y`}
                value={draft.profile.statement}
                onChange={(event) => updateProfile('statement', event.target.value)}
              />
            </label>
          </div>
        </section>
      )}

      {tab === 'capabilities' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--editor-ink)]">写作与技术关注方向</h2>
              <p className="mt-1 text-xs text-[var(--editor-muted)]">
                当「关注方向侧栏」开关启用时展示于博客首页，同时用于关于页。
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  profile: {
                    ...current.profile,
                    capabilities: [
                      ...current.profile.capabilities,
                      { title: '', description: '' },
                    ],
                  },
                }))
              }
              className="min-h-11 min-w-11 rounded-[var(--radius-sm)] border border-[var(--editor-line)] bg-[var(--editor-panel)] px-3 py-2 text-xs font-medium text-[var(--editor-ink)] hover:bg-[var(--editor-soft)]"
            >
              + 添加关注方向
            </button>
          </div>
          <div className="space-y-3">
            {draft.profile.capabilities.map((capability, index) => (
              <div
                key={index}
                className={`${cardClass} grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-start`}
              >
                <input
                  className={`min-h-11 min-w-11 ${inputClass}`}
                  placeholder="方向名称"
                  value={capability.title}
                  onChange={(event) => updateCapability(index, { title: event.target.value })}
                />
                <textarea
                  className={`min-h-11 min-w-11 ${inputClass} min-h-16 resize-y`}
                  placeholder="方向说明"
                  value={capability.description}
                  onChange={(event) =>
                    updateCapability(index, { description: event.target.value })
                  }
                />
                <button
                  type="button"
                  onClick={() => removeCapability(index)}
                  className="min-h-11 min-w-11 justify-self-end text-xs text-[var(--danger)] hover:underline sm:justify-self-auto"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'labs' && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--editor-ink)]">实验室</h2>
              <p className="mt-1 text-xs text-[var(--editor-muted)]">
                开源插件、Skill 与自动化写作工具链（展示于 /labs）。
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  labs: [
                    ...current.labs,
                    {
                      id: crypto.randomUUID(),
                      title: '',
                      description: '',
                      href: '/',
                      type: 'tool',
                      visible: true,
                    },
                  ],
                }))
              }
              className="min-h-11 min-w-11 rounded-[var(--radius-sm)] border border-[var(--editor-line)] bg-[var(--editor-panel)] px-3 py-2 text-xs font-medium text-[var(--editor-ink)] hover:bg-[var(--editor-soft)]"
            >
              + 添加实验
            </button>
          </div>
          <div className="space-y-3">
            {draft.labs.map((lab, index) => (
              <div key={`${index}-${lab.id}`} className={cardClass}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    className={`min-h-11 min-w-11 ${inputClass}`}
                    placeholder="内部 ID"
                    value={lab.id}
                    onChange={(event) => updateLab(index, { id: event.target.value })}
                  />
                  <input
                    className={`min-h-11 min-w-11 ${inputClass}`}
                    placeholder="名称"
                    value={lab.title}
                    onChange={(event) => updateLab(index, { title: event.target.value })}
                  />
                  <input
                    className={`min-h-11 min-w-11 ${inputClass}`}
                    placeholder="类型，例如 tool / skill"
                    value={lab.type}
                    onChange={(event) => updateLab(index, { type: event.target.value })}
                  />
                  <input
                    className={`min-h-11 min-w-11 ${inputClass}`}
                    placeholder="链接"
                    value={lab.href}
                    onChange={(event) => updateLab(index, { href: event.target.value })}
                  />
                  <textarea
                    className={`min-h-11 min-w-11 ${inputClass} min-h-20 resize-y sm:col-span-2`}
                    placeholder="实验说明"
                    value={lab.description}
                    onChange={(event) => updateLab(index, { description: event.target.value })}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--editor-line)] pt-3 text-xs text-[var(--editor-muted)]">
                  <label className="flex items-center gap-2 text-[var(--editor-ink)]">
                    <input
                      type="checkbox"
                      checked={lab.visible}
                      onChange={(event) => updateLab(index, { visible: event.target.checked })}
                      className="min-h-11 min-w-11"
                    />
                    公开显示
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        labs: moveAt(current.labs, index, -1),
                      }))
                    }
                    className="min-h-11 min-w-11 hover:text-[var(--editor-ink)]"
                  >
                    上移
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        labs: moveAt(current.labs, index, 1),
                      }))
                    }
                    className="min-h-11 min-w-11 hover:text-[var(--editor-ink)]"
                  >
                    下移
                  </button>
                  <button
                    type="button"
                    onClick={() => removeLab(index)}
                    className="min-h-11 min-w-11 text-[var(--danger)] hover:underline"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === 'contacts' && (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--editor-ink)]">联系链接</h2>
            <p className="mt-1 text-xs text-[var(--editor-muted)]">
              晨启AI博客页脚与关于页展示的联系方式。
            </p>
          </div>
          <div className="space-y-2.5">
            {draft.profile.contactLinks.map((link, index) => (
              <div
                key={index}
                className="grid gap-2.5 rounded-[var(--radius-sm)] border border-[var(--editor-line)] bg-[var(--editor-panel)] p-3 sm:grid-cols-[1fr_1.8fr_auto] sm:items-center"
              >
                <input
                  aria-label="链接名称"
                  placeholder="名称（如 GitHub）"
                  className={`min-h-11 min-w-11 ${inputClass}`}
                  value={link.label}
                  onChange={(e) =>
                    setDraft((c) => ({
                      ...c,
                      profile: {
                        ...c.profile,
                        contactLinks: updateAt(c.profile.contactLinks, index, {
                          label: e.target.value,
                        }),
                      },
                    }))
                  }
                />
                <input
                  aria-label="链接地址"
                  placeholder="https://…"
                  className={`min-h-11 min-w-11 ${inputClass}`}
                  value={link.url}
                  onChange={(e) =>
                    setDraft((c) => ({
                      ...c,
                      profile: {
                        ...c.profile,
                        contactLinks: updateAt(c.profile.contactLinks, index, {
                          url: e.target.value,
                        }),
                      },
                    }))
                  }
                />
                <button
                  type="button"
                  onClick={() =>
                    setDraft((c) => ({
                      ...c,
                      profile: {
                        ...c.profile,
                        contactLinks: c.profile.contactLinks.filter((_, i) => i !== index),
                      },
                    }))
                  }
                  className="min-h-11 min-w-11 justify-self-end px-2 text-xs text-[var(--danger)] hover:underline sm:justify-self-auto"
                >
                  移除
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="min-h-11 min-w-11 brain-secondary"
            onClick={() =>
              setDraft((c) => ({
                ...c,
                profile: {
                  ...c.profile,
                  contactLinks: [
                    ...c.profile.contactLinks,
                    { label: '', url: '', openInNewTab: true },
                  ],
                },
              }))
            }
          >
            添加链接
          </button>
        </section>
      )}

      {tab === 'writing' && (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--editor-ink)]">精选置顶文章</h2>
            <p className="mt-1 text-xs text-[var(--editor-muted)]">
              第 1 篇默认吐出至首屏精选长文卡，其余优先排在最新文章流前列。
            </p>
          </div>
          <div className={cardClass}>
            <FeaturedPostPicker
              selected={draft.featuredPostSlugs}
              onChange={(slugs) =>
                setDraft((current) => ({ ...current, featuredPostSlugs: slugs }))
              }
            />
          </div>
        </section>
      )}
    </div>
  )
}

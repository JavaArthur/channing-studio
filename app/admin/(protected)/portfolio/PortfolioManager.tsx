'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Copy, FolderOpen, Lock, Plus, Search, Trash2 } from 'lucide-react'
import { Button, Input, Menu, Select } from '@/components/admin/ui'
import { ManualSheet } from '@/components/admin/ManualSheet'
import { useToast } from '@/components/Toast'
import {
  portfolioHref,
  PORTFOLIO_STATUSES,
  PORTFOLIO_STATUS_LABELS,
  type PortfolioLink,
  type PortfolioProject,
  type PortfolioStatus,
} from '@/lib/portfolio'

interface FormState {
  id: number | null
  slug: string
  title: string
  summary: string
  status: PortfolioStatus
  tags: string
  site_url: string
  repo_url: string
  repo_public: boolean
  links: PortfolioLink[]
  local_path: string
  is_pinned: boolean
  sort_order: number
}

const EMPTY: FormState = {
  id: null,
  slug: '',
  title: '',
  summary: '',
  status: 'active',
  tags: '',
  site_url: '',
  repo_url: '',
  repo_public: false,
  links: [],
  local_path: '',
  is_pinned: false,
  sort_order: 0,
}

function toForm(project: PortfolioProject): FormState {
  return {
    id: project.id,
    slug: project.slug,
    title: project.title,
    summary: project.summary,
    status: project.status,
    tags: project.tags.join(', '),
    site_url: project.site_url ?? '',
    repo_url: project.repo_url ?? '',
    repo_public: project.repo_public,
    links: project.links.map((link) => ({ ...link })),
    local_path: project.local_path ?? '',
    is_pinned: project.is_pinned,
    sort_order: project.sort_order,
  }
}

function searchText(project: PortfolioProject) {
  return [
    project.title,
    project.slug,
    project.summary,
    ...project.tags,
    project.site_url,
    project.repo_url,
    project.local_path,
    ...project.links.flatMap((link) => [link.label, link.url]),
  ]
    .filter(Boolean)
    .join('\n')
    .toLowerCase()
}

function shortUrl(url: string) {
  if (url.startsWith('/')) return url
  const parsed = new URL(url)
  const path = parsed.pathname.replace(/\/$/, '')
  return parsed.hostname === 'github.com' ? path.slice(1) : parsed.host + path
}

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  )
}

export function PortfolioManager({ projects }: { projects: PortfolioProject[] }) {
  const router = useRouter()
  const toast = useToast()
  const searchRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<PortfolioStatus | 'all'>('all')
  const [form, setForm] = useState<FormState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || isTypingTarget(event.target)) return
      event.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  const indexed = useMemo(
    () => projects.map((project) => ({ project, text: searchText(project) })),
    [projects],
  )
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const visible = indexed
    .filter(({ project, text }) =>
      (status === 'all' ? project.status !== 'archived' : project.status === status) &&
      terms.every((term) => text.includes(term)),
    )
    .map(({ project }) => project)

  async function send(body: Record<string, unknown>, success: string) {
    setBusy(true)
    try {
      const response = await fetch('/api/admin/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        toast.error(data.error || '操作失败，请稍后重试')
        return false
      }
      toast.success(success)
      router.refresh()
      return true
    } catch {
      toast.error('网络异常，修改没有保存')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!form) return false
    const project = {
      slug: form.slug,
      title: form.title,
      summary: form.summary,
      status: form.status,
      tags: form.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
      site_url: form.site_url,
      repo_url: form.repo_url,
      repo_public: form.repo_public,
      links: form.links.filter((link) => link.label.trim() || link.url.trim()),
      local_path: form.local_path,
      is_pinned: form.is_pinned,
      sort_order: form.sort_order,
    }
    const saved = await send(
      form.id ? { action: 'update', id: form.id, project } : { action: 'create', project },
      form.id ? '项目已保存' : '项目已创建',
    )
    if (saved) setForm(null)
    return saved
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`已复制${label}`)
    } catch {
      toast.error('浏览器拒绝了剪贴板访问，请手动复制')
    }
  }

  function openFirstResult() {
    const first = visible[0]
    const href = first && (first.site_url ?? first.repo_url ?? first.links[0]?.url)
    if (href) window.open(href, '_blank', 'noopener,noreferrer')
  }

  const setLink = (index: number, patch: Partial<PortfolioLink>) =>
    setForm((current) =>
      current && {
        ...current,
        links: current.links.map((link, i) => (i === index ? { ...link, ...patch } : link)),
      },
    )

  return (
    <div>
      <div className="hub-toolbar">
        <label className="hub-search">
          <Search size={15} aria-hidden="true" />
          <span className="sr-only">搜索项目</span>
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder="搜索名称、域名、仓库或目录"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) openFirstResult()
            }}
          />
          <kbd aria-hidden="true">/</kbd>
        </label>
        <Select
          aria-label="按状态筛选"
          value={status}
          onChange={(event) => setStatus(event.target.value as PortfolioStatus | 'all')}
          className="hub-filter"
        >
          <option value="all">全部（不含归档）</option>
          {PORTFOLIO_STATUSES.map((value) => (
            <option key={value} value={value}>
              {PORTFOLIO_STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
        <Button variant="primary" onClick={() => setForm({ ...EMPTY })}>
          <Plus size={15} aria-hidden="true" />
          新建项目
        </Button>
      </div>
      {query && (
        <p className="hub-hint" aria-live="polite">
          {visible.length ? `找到 ${visible.length} 个项目，回车打开第一个的网址。` : '没有匹配的项目。'}
        </p>
      )}

      <ul className="hub-list">
        {visible.map((project) => {
          const publicHref = project.published && portfolioHref(project.published)
          return (
            <li key={project.id} className="hub-row" id={project.slug}>
              <div className="hub-main">
                <div className="hub-title">
                  <h2>{project.title}</h2>
                  <span className="hub-status" data-status={project.status}>
                    {PORTFOLIO_STATUS_LABELS[project.status]}
                  </span>
                </div>
                {project.summary && <p>{project.summary}</p>}
              </div>
              <div className="hub-links">
                {project.site_url && (
                  <HubLink label="网站" url={project.site_url} onCopy={copy} />
                )}
                {project.repo_url && (
                  <HubLink
                    label="仓库"
                    url={project.repo_url}
                    privateLink={!project.repo_public}
                    onCopy={copy}
                  />
                )}
                {project.links.map((link) => (
                  <HubLink key={link.url} label={link.label} url={link.url} onCopy={copy} />
                ))}
                {project.local_path && (
                  <span className="hub-link hub-path">
                    <FolderOpen size={13} aria-hidden="true" />
                    <code>{project.local_path}</code>
                    <button
                      type="button"
                      aria-label={`复制${project.title}的本地目录`}
                      title="复制本地目录"
                      onClick={() => void copy(project.local_path!, '本地目录')}
                    >
                      <Copy size={13} />
                    </button>
                  </span>
                )}
                {!project.site_url && !project.repo_url && !project.links.length && !project.local_path && (
                  <span className="hub-empty-links">还没有记录网址</span>
                )}
              </div>
              <div className="hub-publish" data-state={project.publish_stale ? 'stale' : project.published ? 'public' : 'private'}>
                {project.publish_stale ? '公开版本待更新' : project.published ? '作品集已公开' : '未公开'}
                {publicHref && (
                  <a href={`/work#${encodeURIComponent(project.slug)}`} target="_blank" rel="noreferrer">
                    查看
                  </a>
                )}
              </div>
              <div className="hub-actions">
                <Button onClick={() => setForm(toForm(project))}>编辑</Button>
                <Menu
                  label={`${project.title}的更多操作`}
                  items={[
                    project.published
                      ? {
                          label: project.publish_stale ? '更新公开版本' : '重新发布公开版本',
                          disabled: busy,
                          onSelect: () => void send({ action: 'publish', id: project.id, publish: true }, '公开版本已更新'),
                        }
                      : {
                          label: '公开到作品集',
                          disabled: busy,
                          onSelect: () => void send({ action: 'publish', id: project.id, publish: true }, '已公开到作品集'),
                        },
                    ...(project.published
                      ? [
                          {
                            label: '从作品集撤下',
                            disabled: busy,
                            onSelect: () => void send({ action: 'publish', id: project.id, publish: false }, '已从作品集撤下'),
                          },
                        ]
                      : []),
                    {
                      label: '删除项目',
                      danger: true,
                      disabled: busy,
                      onSelect: () => {
                        if (confirm(`删除「${project.title}」？公开版本会一起移除，无法恢复。`))
                          void send({ action: 'delete', id: project.id }, '项目已删除')
                      },
                    },
                  ]}
                />
              </div>
            </li>
          )
        })}
      </ul>
      {!projects.length && (
        <div className="library-empty">
          <h2>还没有项目</h2>
          <p>新建一个项目，把网站、仓库和本地目录放在一起。</p>
        </div>
      )}

      {form && (
        <ManualSheet
          title={form.id ? '编辑项目' : '新建项目'}
          value={form}
          onSave={save}
          onClose={() => setForm(null)}
        >
          <label>
            名称
            <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label>
            标识（作品页锚点）
            <Input
              required
              value={form.slug}
              placeholder="例如 c-foods"
              onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
            />
          </label>
          <label>
            简介（公开到作品集时必填）
            <textarea
              className="admin-input"
              rows={4}
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
          </label>
          <label>
            状态
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as PortfolioStatus })}>
              {PORTFOLIO_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {PORTFOLIO_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
          </label>
          <label>
            技术栈（逗号分隔）
            <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </label>
          <label>
            网站地址
            <Input
              value={form.site_url}
              placeholder="https://… 或站内路径"
              onChange={(e) => setForm({ ...form, site_url: e.target.value })}
            />
          </label>
          <label>
            仓库地址
            <Input type="url" value={form.repo_url} onChange={(e) => setForm({ ...form, repo_url: e.target.value })} />
          </label>
          <label className="hub-check">
            <input
              type="checkbox"
              checked={form.repo_public}
              onChange={(e) => setForm({ ...form, repo_public: e.target.checked })}
            />
            仓库是公开的，可以展示在作品集
          </label>
          <label>
            本地目录（仅后台可见）
            <Input
              value={form.local_path}
              placeholder="~/ai/30-projects/…"
              onChange={(e) => setForm({ ...form, local_path: e.target.value })}
            />
          </label>
          <fieldset className="hub-fieldset">
            <legend>快捷链接（仅后台可见）</legend>
            {form.links.map((link, index) => (
              <div className="hub-link-editor" key={index}>
                <Input
                  aria-label={`第 ${index + 1} 个链接名称`}
                  placeholder="名称，如 预发布"
                  value={link.label}
                  onChange={(e) => setLink(index, { label: e.target.value })}
                />
                <Input
                  aria-label={`第 ${index + 1} 个链接地址`}
                  placeholder="https://…"
                  type="url"
                  value={link.url}
                  onChange={(e) => setLink(index, { url: e.target.value })}
                />
                <Button
                  variant="ghost"
                  aria-label={`删除第 ${index + 1} 个链接`}
                  onClick={() => setForm({ ...form, links: form.links.filter((_, i) => i !== index) })}
                >
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
            <Button
              disabled={form.links.length >= 12}
              onClick={() => setForm({ ...form, links: [...form.links, { label: '', url: '' }] })}
            >
              <Plus size={15} aria-hidden="true" />
              添加链接
            </Button>
          </fieldset>
          <label className="hub-check">
            <input
              type="checkbox"
              checked={form.is_pinned}
              onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
            />
            置顶（首页优先展示）
          </label>
          <label>
            排序（数字小的在前）
            <Input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
            />
          </label>
          <p>保存只更新后台记录；作品集里的内容要通过「公开到作品集」或「更新公开版本」确认。</p>
          <div className="admin-form-actions">
            <Button variant="primary" disabled={busy} onClick={() => void save()}>
              {busy ? '保存中…' : '保存'}
            </Button>
          </div>
        </ManualSheet>
      )}
    </div>
  )
}

function HubLink({
  label,
  url,
  privateLink = false,
  onCopy,
}: {
  label: string
  url: string
  privateLink?: boolean
  onCopy: (text: string, label: string) => Promise<void>
}) {
  return (
    <span className="hub-link">
      <a href={url} target="_blank" rel="noopener noreferrer">
        <span className="hub-link-label">
          {privateLink && <Lock size={11} aria-label="仅后台可见" />}
          {label}
        </span>
        <span className="hub-link-url">{shortUrl(url)}</span>
        <ArrowUpRight size={13} aria-hidden="true" />
      </a>
      <button type="button" aria-label={`复制${label}地址`} title={`复制${label}地址`} onClick={() => void onCopy(url, `${label}地址`)}>
        <Copy size={13} />
      </button>
    </span>
  )
}

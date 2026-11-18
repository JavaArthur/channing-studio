'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PenLine, Search, X } from 'lucide-react'
import { Dropdown } from '@/components/Dropdown'
import { Tooltip } from '@/components/Tooltip'

interface FilterBarProps {
  currentStatus?: string
  currentCategory?: string
  categories: string[]
  initialQuery?: string
  counts: {
    all: number
    published: number
    draft: number
    deleted: number
    encrypted: number
    unlisted: number
    pinned: number
  }
  resultCount: number
}

export function FilterBar({
  currentStatus,
  currentCategory,
  categories,
  initialQuery = '',
  counts,
  resultCount,
}: FilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery)

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    if (value === 'all') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    const qs = params.toString()
    router.push(`/admin/posts${qs ? `?${qs}` : ''}`)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    if (trimmed) {
      params.set('q', trimmed)
    } else {
      params.delete('q')
    }
    const qs = params.toString()
    router.push(`/admin/posts${qs ? `?${qs}` : ''}`)
  }

  const handleClear = () => {
    setQuery('')
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    params.delete('q')
    const qs = params.toString()
    router.push(`/admin/posts${qs ? `?${qs}` : ''}`)
  }

  const activeStatus = currentStatus || 'all'
  const activeCategory = currentCategory || 'all'
  const hasActiveFilters = Boolean(
    query.trim() || activeStatus !== 'all' || activeCategory !== 'all',
  )

  const categoryOptions = [
    { value: 'all', label: '全部分类' },
    ...categories.map((cat) => ({ value: cat, label: cat })),
  ]

  const statusItems = [
    { value: 'all', label: '全部', count: counts.all },
    { value: 'published', label: '已发布', count: counts.published },
    { value: 'draft', label: '草稿', count: counts.draft },
    { value: 'deleted', label: '已删除', count: counts.deleted },
    { value: 'encrypted', label: '加密', count: counts.encrypted },
    { value: 'unlisted', label: '私密', count: counts.unlisted },
    { value: 'pinned', label: '置顶', count: counts.pinned },
  ] as const

  return (
    <div className="posts-filter">
      <header className="workspace-page-heading">
        <div>
          <span className="atelier-eyebrow">PUBLICATION // WRITING LEDGER</span>
          <h1>文章管理</h1>
          <p>管理工作草稿与已发布手稿，共 {counts.all} 篇记录。</p>
        </div>
        <Link
          className="admin-button admin-button-primary atelier-cta-vermilion"
          href="/editor?new=1"
        >
          <PenLine size={15} />
          新建文章
        </Link>
      </header>

      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <input
                aria-label="搜索文章"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索标题、摘要或正文…"
                className="min-h-11 min-w-11 w-full rounded-[var(--radius-sm)] border border-[var(--editor-line)] bg-[var(--editor-panel)] px-3 py-2 pr-9 pl-9 text-sm text-[var(--editor-ink)] placeholder:text-[var(--stone-gray)] transition-colors focus:border-[var(--focus-ring)] focus:outline-none"
              />
              <Search
                size={15}
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--stone-gray)]"
              />
              {query && (
                <Tooltip label="清除搜索">
                  <button
                    type="button"
                    onClick={handleClear}
                    className="min-h-11 min-w-11 absolute top-1/2 right-2 inline-flex -translate-y-1/2 items-center justify-center text-[var(--stone-gray)] transition-colors hover:text-[var(--editor-ink)]"
                    aria-label="清除搜索"
                  >
                    <X size={14} />
                  </button>
                </Tooltip>
              )}
            </div>
          </form>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="min-w-[168px] flex-1 sm:flex-initial">
              <Dropdown
                options={categoryOptions}
                value={activeCategory}
                onChange={(value) => updateFilter('category', value)}
                placeholder="全部分类"
                className="w-full [&_button]:whitespace-nowrap [&_button>span]:truncate [&_button>svg]:shrink-0"
              />
            </div>

            {hasActiveFilters ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  router.push('/admin/posts')
                }}
                className="min-h-11 min-w-11 shrink-0 rounded-[var(--radius-sm)] border border-[var(--editor-line)] bg-[var(--editor-panel)] px-3 py-2 text-xs text-[var(--editor-muted)] transition-colors hover:bg-[var(--editor-soft)] hover:text-[var(--editor-ink)]"
              >
                清空筛选
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-b border-[var(--editor-line)] pb-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {statusItems.map((item) => {
              const active = activeStatus === item.value
              return (
                <button
                  key={item.value}
                  onClick={() => updateFilter('status', item.value)}
                  className={`min-h-11 min-w-11 inline-flex items-center gap-2 rounded-[var(--radius-sm)] border px-3 py-1.5 text-xs transition-colors ${
                    active
                      ? 'border-[var(--editor-accent)] bg-[var(--editor-accent)] font-medium text-[var(--editor-accent-ink)]'
                      : 'border-[var(--editor-line)] bg-[var(--editor-panel)] text-[var(--editor-muted)] hover:bg-[var(--editor-soft)] hover:text-[var(--editor-ink)]'
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`atelier-mono rounded-[var(--radius-xs)] px-1.5 py-0.5 text-[11px] ${
                      active
                        ? 'bg-[var(--editor-panel)]/18 text-[var(--editor-accent-ink)]'
                        : 'bg-[var(--editor-soft)] text-[var(--stone-gray)]'
                    }`}
                  >
                    {item.count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="atelier-mono text-xs text-[var(--stone-gray)]">
            当前结果 {resultCount} 篇
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Tooltip } from '@/components/Tooltip'

interface AdminSearchProps {
  initialQuery?: string
}

export function AdminSearch({ initialQuery = '' }: AdminSearchProps) {
  const [query, setQuery] = useState(initialQuery)
  const router = useRouter()

  useEffect(() => {
    setQuery(initialQuery)
  }, [initialQuery])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed) {
      router.push(`/admin/posts?q=${encodeURIComponent(trimmed)}`)
    } else {
      router.push('/admin/posts')
    }
  }

  const handleClear = () => {
    setQuery('')
    router.push('/admin/posts')
  }

  return (
    <form onSubmit={handleSearch} className="mb-6">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索文章标题或内容..."
          className="min-h-11 min-w-11 w-full border border-[var(--editor-line)] bg-[var(--background)] px-4 py-2.5 pl-10 pr-20 text-sm text-[var(--editor-ink)] placeholder:text-[var(--editor-muted)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]/20 focus:border-[var(--focus-ring)] transition-all"
        />
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--stone-gray)]"
        >
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        {query && (
          <Tooltip label="清除搜索">
            <button
              type="button"
              onClick={handleClear}
              className="min-h-11 min-w-11 absolute right-12 top-1/2 -translate-y-1/2 text-[var(--stone-gray)] hover:text-[var(--editor-ink)] transition-colors"
              aria-label="清除搜索"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </Tooltip>
        )}
        <button
          type="submit"
          className="min-h-11 min-w-11 absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs font-medium text-[var(--editor-accent)] hover:bg-[var(--editor-accent)]/10 rounded-md transition-colors"
        >
          搜索
        </button>
      </div>
    </form>
  )
}

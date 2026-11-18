'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
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
          className="min-h-11 min-w-11 w-full rounded-[var(--radius-sm)] border border-[var(--editor-line)] bg-[var(--editor-panel)] px-4 py-2.5 pr-20 pl-10 text-sm text-[var(--editor-ink)] placeholder:text-[var(--stone-gray)] transition-colors focus:border-[var(--focus-ring)] focus:outline-none"
        />
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--stone-gray)]"
        />
        {query && (
          <Tooltip label="清除搜索">
            <button
              type="button"
              onClick={handleClear}
              className="min-h-11 min-w-11 absolute top-1/2 right-12 inline-flex -translate-y-1/2 items-center justify-center text-[var(--stone-gray)] transition-colors hover:text-[var(--editor-ink)]"
              aria-label="清除搜索"
            >
              <X size={15} />
            </button>
          </Tooltip>
        )}
        <button
          type="submit"
          className="min-h-11 min-w-11 absolute top-1/2 right-2 -translate-y-1/2 rounded-[var(--radius-xs)] px-3 py-1 text-xs font-medium text-[var(--atelier-vermilion)] transition-colors hover:bg-[var(--atelier-vermilion-soft)]"
        >
          搜索
        </button>
      </div>
    </form>
  )
}

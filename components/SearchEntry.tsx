'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Tooltip } from '@/components/Tooltip'

const SearchBar = dynamic(
  () => import('@/components/SearchBar').then((module) => module.SearchBar),
  {
    ssr: false,
    loading: () => (
      <Tooltip label="搜索">
        <Link
          href="/search"
          className="min-h-11 min-w-11 inline-flex p-2 text-[var(--editor-muted)] hover:text-[var(--editor-ink)] transition-colors"
          aria-label="搜索"
        >
          <Search className="w-[18px] h-[18px]" />
        </Link>
      </Tooltip>
    ),
  },
)

export function SearchEntry() {
  return <SearchBar />
}

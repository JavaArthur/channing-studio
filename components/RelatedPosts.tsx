'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/format-date'

interface RelatedPost {
  slug: string
  title: string
  description: string | null
  category: string | null
  published_at: number
}

interface RelatedPayload {
  source: 'vectorize' | 'fts' | 'rules'
  results: RelatedPost[]
}

export function RelatedPosts({ slug }: { slug: string }) {
  const [payload, setPayload] = useState<RelatedPayload | null>(null)

  useEffect(() => {
    let active = true

    fetch(`/api/posts/${encodeURIComponent(slug)}/related?limit=3`)
      .then(async (response) => {
        if (!response.ok) return null
        return await response.json() as { related?: RelatedPayload }
      })
      .then((data) => {
        if (active && data?.related?.results?.length) setPayload(data.related)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [slug])

  if (!payload?.results.length) return null

  return (
    <section className="mt-14 border-t border-[var(--editor-line)] pt-8 sm:mt-16 sm:pt-10">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--editor-ink)] sm:text-xl">继续阅读</h2>
          <p className="mt-1 text-xs text-[var(--stone-gray)]">
            {payload.source === 'vectorize' ? '基于向量召回' : '基于全文检索与主题相似度'}
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {payload.results.map((item) => (
          <Link
            key={item.slug}
            href={`/${item.slug}`}
            className="group rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)]/55 p-4 transition-colors hover:border-[var(--editor-accent)]/35 hover:bg-[var(--editor-panel)]"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--stone-gray)]">
              {item.category && (
                <span className="rounded-full border border-[var(--editor-accent)]/15 bg-[var(--editor-accent)]/8 px-2 py-0.5 text-[var(--editor-accent)]">
                  {item.category}
                </span>
              )}
              <time>{formatDate(item.published_at)}</time>
            </div>
            <h3 className="text-base font-semibold leading-snug text-[var(--editor-ink)] transition-colors group-hover:text-[var(--editor-accent)]">
              {item.title}
            </h3>
            {item.description && (
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[var(--editor-muted)]">{item.description}</p>
            )}
          </Link>
        ))}
      </div>
    </section>
  )
}

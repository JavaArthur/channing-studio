'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
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
        return (await response.json()) as { related?: RelatedPayload }
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
    <section
      aria-labelledby="related-posts-heading"
      className="mt-12 border-t border-[var(--editor-line)] pt-8 sm:mt-14 sm:pt-10"
    >
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--atelier-vermilion)]">
            FURTHER READING // 延伸检阅
          </p>
          <h2
            id="related-posts-heading"
            className="mt-1 text-xl font-semibold tracking-tight text-[var(--editor-ink)]"
          >
            继续阅读
          </h2>
        </div>
        <p className="font-mono text-xs text-[var(--stone-gray)]">
          {payload.source === 'vectorize' ? '基于向量召回' : '基于全文检索与主题相似度'}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {payload.results.map((item, index) => (
          <Link
            key={item.slug}
            href={`/${item.slug}`}
            className="group flex h-full min-h-11 min-w-0 flex-col items-start justify-start rounded-[var(--radius-sm)] border border-[var(--editor-line)] border-t-2 border-t-[var(--editor-ink)] bg-[var(--editor-panel)] p-4 no-underline transition-colors hover:border-[var(--atelier-vermilion-line)] hover:border-t-[var(--atelier-vermilion)] hover:bg-[var(--editor-soft)] sm:p-5"
          >
            <div className="mb-3 flex w-full flex-wrap items-center justify-between gap-2 font-mono text-[11.5px] tabular-nums text-[var(--stone-gray)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[var(--atelier-vermilion)]" aria-hidden="true">
                  0{index + 1}
                </span>
                {item.category && (
                  <span className="rounded-[var(--radius-xs)] border border-[var(--atelier-vermilion-line)] bg-[var(--atelier-vermilion-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--atelier-vermilion)]">
                    {item.category}
                  </span>
                )}
              </div>
              <time dateTime={new Date(item.published_at * 1000).toISOString()}>
                {formatDate(item.published_at)}
              </time>
            </div>

            <h3 className="w-full text-[15.5px] font-semibold leading-snug text-[var(--editor-ink)] transition-colors group-hover:text-[var(--atelier-vermilion)]">
              {item.title}
            </h3>

            {item.description && (
              <p className="mt-2.5 w-full line-clamp-3 text-[13.5px] leading-relaxed text-[var(--editor-muted)]">
                {item.description}
              </p>
            )}

            <span className="mt-auto inline-flex items-center gap-1 pt-4 font-mono text-[11.5px] text-[var(--stone-gray)] transition-colors group-hover:text-[var(--atelier-vermilion)]">
              阅读全文
              <ArrowUpRight size={13} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

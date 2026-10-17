'use client'
import { useState } from 'react'
export function FeaturedPostPicker({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (value: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<{ slug: string; title: string }[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function search() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/studio?q=${encodeURIComponent(query)}`)
      if (!response.ok) throw new Error('文章加载失败')
      setOptions((await response.json()).posts)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--editor-muted)]">
        最多选择 3 篇公开文章，按选择顺序展示。留空或不足时用最新文章补齐。
      </p>
      <div className="flex flex-wrap gap-2">
        {selected.map((slug, i) => (
          <button
            type="button"
            className="brain-secondary max-w-full"
            title="移出精选"
            key={slug}
            onClick={() => onChange(selected.filter((item) => item !== slug))}
          >
            <span className="truncate">
              {i + 1}. {options.find((item) => item.slug === slug)?.title || slug}
            </span>{' '}
            ×
          </button>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void search()
        }}
      >
        <input
          className="brain-input"
          aria-label="查找公开文章"
          placeholder="按标题查找公开文章"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button disabled={busy} className="brain-secondary">
          查找
        </button>
      </form>
      {options
        .filter((item) => !selected.includes(item.slug))
        .map((item) => (
          <button
            type="button"
            key={item.slug}
            disabled={selected.length >= 3}
            className="block text-left text-sm text-[var(--editor-accent)] disabled:opacity-40"
            onClick={() => onChange([...selected, item.slug])}
          >
            + {item.title}
          </button>
        ))}
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
    </div>
  )
}

import type { LibraryItem } from './types'
export function searchTerms(query: string): string[] {
  const value = query.trim().toLowerCase()
  const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' })
  // Keep URLs and Latin identifiers whole; split CJK with the runtime's dictionary.
  return [
    ...new Set(
      value
        .split(/\s+/u)
        .flatMap((part) =>
          /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(part)
            ? [...segmenter.segment(part)].filter((s) => s.isWordLike).map((s) => s.segment)
            : [part],
        )
        .filter(Boolean),
    ),
  ]
}
export function searchMatch(item: LibraryItem, terms: string[]) {
  const fields = [
    ['title', item.title],
    ['summary', item.summary],
    ['topics', item.topics.join('、')],
    ['saved_reason', item.saved_reason],
    ['content', item.content],
    ['source_url', item.source_url || ''],
  ] as const
  // Prefer a non-title excerpt so a match deep in the body is visible.
  const matching = fields.filter(([, value]) => terms.some((t) => value.toLowerCase().includes(t)))
  const unseen = terms.filter((t) => !item.title.toLowerCase().includes(t))
  const score = (value: string) =>
    unseen.filter((t) => value.toLowerCase().includes(t)).length * 10 +
    terms.filter((t) => value.toLowerCase().includes(t)).length
  const match =
    matching.filter(([key]) => key !== 'title').sort((a, b) => score(b[1]) - score(a[1]))[0] ||
    matching[0]
  if (!match) return undefined
  const [field, value] = match
  const excerptTerms = unseen.some((t) => value.toLowerCase().includes(t)) ? unseen : terms
  const at = Math.min(
    ...excerptTerms.map((t) => value.toLowerCase().indexOf(t)).filter((n) => n >= 0),
  )
  const start = Math.max(0, at - 48),
    end = Math.min(value.length, start + 180)
  return {
    field,
    text: `${start ? '…' : ''}${value.slice(start, end)}${end < value.length ? '…' : ''}`,
    terms,
  }
}

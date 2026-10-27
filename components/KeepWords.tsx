const OPENING_PUNCTUATION = /^[「『（(《〈“‘[【]+$/

/**
 * Lets a display heading wrap only between words. CSS has no word-aware breaking for Chinese,
 * so large headlines otherwise split words like 「变成」 across lines. Falls back to plain text
 * where Intl.Segmenter is unavailable.
 */
export function KeepWords({ text }: { text: string }) {
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return text
  const groups: string[] = []
  let prefix = ''
  for (const { segment, isWordLike } of new Intl.Segmenter('zh', { granularity: 'word' }).segment(text)) {
    if (OPENING_PUNCTUATION.test(segment)) prefix += segment
    else if (!isWordLike && segment.trim() && groups.length && !prefix) groups[groups.length - 1] += segment
    else {
      groups.push(prefix + segment)
      prefix = ''
    }
  }
  if (prefix) groups.push(prefix)
  return groups.map((group, index) =>
    group.trim() ? (
      <span key={index} className="keep-word">
        {group}
      </span>
    ) : (
      group
    ),
  )
}

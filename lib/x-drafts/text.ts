import { isHttpUrl } from '@/lib/url'

export { isHttpUrl }
export const X_CHAR_LIMIT = 280
export const SOURCE_TYPE_PATTERN = /^[a-z0-9_-]{1,40}$/
export const SOURCE_TYPES = { aihot: 'AIHOT', hot_post: '热帖', blog_repurpose: '博客一鱼多吃', other: '其他' }
export function isValidSourceType(value: string) { return SOURCE_TYPE_PATTERN.test(value) }
export function isValidContent(value: string) { return value.length <= 10000 && value.trim().length > 0 }

// Approximation by code point, not the full twitter-text grapheme/URL parser.
// Exclude common prose delimiters so a URL next to Chinese text stays bounded.
export function countXChars(text: string): number {
  const urls = /https?:\/\/[^\s<>"'\u3000-\u303f\uff00-\uffef]+/giu
  const count = (part: string) => Array.from(part).reduce((sum, char) => {
    const cp = char.codePointAt(0)!
    const wide = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(char)
      || (cp >= 0x3000 && cp <= 0x303f) || (cp >= 0xff01 && cp <= 0xff60)
      || (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x1f3fb && cp <= 0x1f3ff)
    return sum + (wide ? 2 : 1)
  }, 0)
  let total = 0; let cursor = 0
  for (const match of text.matchAll(urls)) {
    // Trailing sentence punctuation is not part of the URL.
    const url = match[0].replace(/[.,!?;:)\]}]+$/, '')
    total += count(text.slice(cursor, match.index)) + 23
    cursor = match.index + url.length
  }
  return total + count(text.slice(cursor))
}
export function isOverLimit(text: string) { return countXChars(text) > X_CHAR_LIMIT }

import twitter from 'twitter-text'
import { isHttpUrl } from '@/lib/url'

export { isHttpUrl }
export const X_CHAR_LIMIT = 280
export const SOURCE_TYPE_PATTERN = /^[a-z0-9_-]{1,40}$/
export const SOURCE_TYPES = { aihot: 'AIHOT', hot_post: '热帖', blog_repurpose: '博客一鱼多吃', other: '其他' }
export function isValidSourceType(value: string) { return SOURCE_TYPE_PATTERN.test(value) }
export function isValidContent(value: string) { return value.length <= 10000 && value.trim().length > 0 }

export function countXChars(text: string): number {
  return twitter.parseTweet(text).weightedLength
}
export function isOverLimit(text: string) { return countXChars(text) > X_CHAR_LIMIT }

import { describe, expect, it } from 'vitest'
import { limitRelatedPosts } from '@/lib/related-content'

const posts = [
  { slug: 'current', title: '当前文章' },
  { slug: 'one', title: '相关文章一' },
  { slug: 'two', title: '相关文章二' },
  { slug: 'three', title: '相关文章三' },
]

describe('limitRelatedPosts', () => {
  it('removes the current slug and limits the result', () => {
    expect(limitRelatedPosts(posts, 'current', 2).map((post) => post.slug)).toEqual(['one', 'two'])
  })

  it('returns an empty array for empty or malformed input', () => {
    expect(limitRelatedPosts([], 'current')).toEqual([])
    expect(limitRelatedPosts(null, 'current')).toEqual([])
  })

  it('does not mutate the source array', () => {
    const source = [...posts]
    limitRelatedPosts(source, 'current', 2)
    expect(source).toEqual(posts)
  })
})

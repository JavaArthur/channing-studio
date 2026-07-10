import { describe, expect, it } from 'vitest'
import { selectFeaturedPosts } from '@/lib/studio-home'

const posts = [
  { slug: 'latest', title: '最新' },
  { slug: 'middle', title: '中间' },
  { slug: 'oldest', title: '最早' },
]

describe('selectFeaturedPosts', () => {
  it('uses the configured order and ignores missing slugs', () => {
    const result = selectFeaturedPosts(posts, ['oldest', 'missing', 'latest'])

    expect(result.map((post) => post.slug)).toEqual(['oldest', 'latest'])
  })

  it('falls back to the latest posts when no slugs are configured', () => {
    const result = selectFeaturedPosts(posts, [], 2)

    expect(result.map((post) => post.slug)).toEqual(['latest', 'middle'])
  })
})

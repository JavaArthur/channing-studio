import { describe, expect, it } from 'vitest'
import { selectFeaturedPosts, selectStudioTools } from '@/lib/studio-home'

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

describe('selectStudioTools', () => {
  const tools = [
    { id: 1, name: '普通', is_pinned: 0, sort_order: 1, created_at: 3 },
    { id: 2, name: '置顶', is_pinned: 1, sort_order: 9, created_at: 1 },
    { id: 3, name: '排序靠前', is_pinned: 0, sort_order: 0, created_at: 2 },
  ]

  it('puts pinned tools first, then sort order and creation time', () => {
    expect(selectStudioTools(tools).map((tool) => tool.id)).toEqual([2, 3, 1])
  })

  it('limits the number of tools without mutating input', () => {
    const source = [...tools]
    expect(selectStudioTools(source, 2).map((tool) => tool.id)).toEqual([2, 3])
    expect(source.map((tool) => tool.id)).toEqual([1, 2, 3])
  })
})

export function selectFeaturedPosts<T extends { slug: string }>(
  posts: T[],
  featuredSlugs: string[],
  limit = 3,
): T[] {
  if (featuredSlugs.length === 0) return posts.slice(0, limit)

  const postsBySlug = new Map(posts.map((post) => [post.slug, post]))
  const selected = featuredSlugs
    .map((slug) => postsBySlug.get(slug))
    .filter((post): post is T => post !== undefined)
    .slice(0, limit)
  return [...selected, ...posts.filter(post => !selected.some(item => item.slug === post.slug))].slice(0, limit)
}

export function selectStudioTools<T extends {
  is_pinned: number
  sort_order: number
  created_at: number
}>(tools: T[], limit = 4): T[] {
  if (limit <= 0) return []
  return [...tools]
    .sort((left, right) =>
      right.is_pinned - left.is_pinned ||
      left.sort_order - right.sort_order ||
      right.created_at - left.created_at,
    )
    .slice(0, limit)
}

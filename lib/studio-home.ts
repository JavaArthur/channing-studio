export function selectFeaturedPosts<T extends { slug: string }>(
  posts: T[],
  featuredSlugs: string[],
  limit = 3,
): T[] {
  if (featuredSlugs.length === 0) return posts.slice(0, limit)

  const postsBySlug = new Map(posts.map((post) => [post.slug, post]))
  return featuredSlugs
    .map((slug) => postsBySlug.get(slug))
    .filter((post): post is T => post !== undefined)
    .slice(0, limit)
}

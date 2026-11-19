import { revalidateTag, unstable_cache } from 'next/cache'

export const PUBLIC_CACHE_TAGS = {
  posts: 'public:posts',
  studio: 'public:studio',
  portfolio: 'public:portfolio',
  tools: 'public:tools',
  prompts: 'public:prompts',
  nav: 'public:nav',
} as const

export type PublicCacheTag = (typeof PUBLIC_CACHE_TAGS)[keyof typeof PUBLIC_CACHE_TAGS]

const DEFAULT_REVALIDATE_SECONDS = 60

function isNextCacheUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /incrementalCache missing|static generation store missing|invariant/i.test(error.message)
}

/**
 * Caches public read-only JSON-serializable data with Next.js `unstable_cache`
 * (backed by OpenNext R2 incremental cache + DO sharded tag cache in production).
 *
 * IMPORTANT: Never pass non-serializable objects (like D1 bindings) in `keyParts`;
 * bind them in `fetcher` and keep `keyParts` deterministic strings.
 * Falls back transparently to direct execution outside Next.js App Router runtime (e.g. Vitest).
 */
export async function cachedPublicData<T>(
  keyParts: readonly string[],
  tags: readonly PublicCacheTag[],
  fetcher: () => Promise<T>,
  revalidate: number = DEFAULT_REVALIDATE_SECONDS,
): Promise<T> {
  try {
    const cachedFn = unstable_cache(
      async () => fetcher(),
      ['public-data', ...keyParts],
      {
        revalidate,
        tags: [...tags],
      },
    )
    return await cachedFn()
  } catch (error) {
    if (isNextCacheUnavailableError(error)) {
      return fetcher()
    }
    throw error
  }
}

export function revalidatePublicTags(...tags: PublicCacheTag[]): void {
  const uniqueTags = [...new Set(tags)]
  for (const tag of uniqueTags) {
    try {
      revalidateTag(tag, { expire: 0 })
    } catch {
      // Safe no-op outside Next.js App Router runtime (e.g. Vitest)
    }
  }
}

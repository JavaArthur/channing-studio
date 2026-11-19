import type { MetadataRoute } from 'next'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getPosts, getPublicCategories } from '@/lib/db'
import { getSiteUrl } from '@/lib/site-config'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl()
  const now = new Date()
  const entries: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${baseUrl}/writing`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/work`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/tools`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/prompts`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${baseUrl}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/labs`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
  ]

  try {
    const env = await getAppCloudflareEnv()
    if (env?.DB) {
      // Only published, non-deleted, non-hidden, non-password posts
      const [posts, categories] = await Promise.all([
        getPosts(env.DB, 1000, 0, false, false, false, false),
        getPublicCategories(env.DB),
      ])
      for (const post of posts) {
        entries.push({
          url: `${baseUrl}/${post.slug}`,
          lastModified: new Date(post.published_at * 1000),
          changeFrequency: 'weekly',
          priority: 0.8,
        })
      }

      for (const category of categories) {
        if (category.slug && category.name !== '未分类') {
          entries.push({
            url: `${baseUrl}/category/${category.slug}`,
            lastModified: new Date(),
            changeFrequency: 'weekly',
            priority: 0.6,
          })
        }
      }
    }
  } catch {}
  return entries
}

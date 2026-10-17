import { isSafeLink } from '@/lib/url'
import { type Theme } from '@/lib/appearance'
import { getPublicCategories, getSetting } from '@/lib/db'

export interface SiteNavLink {
  label: string
  url: string
  openInNewTab: boolean
}

export interface SiteCategoryLink {
  name: string
  slug: string
}

export async function getSiteHeaderData(db: D1Database): Promise<{
  navLinks: SiteNavLink[]
  categories: SiteCategoryLink[]
  defaultTheme: Theme
}> {
  let navLinks: SiteNavLink[] = []
  let categories: SiteCategoryLink[] = []
  const defaultTheme: Theme = 'light'

  try {
    const [navJson, categoryRows] = await Promise.all([
      getSetting(db, 'nav_links'),
      getPublicCategories(db),
    ])

    if (navJson) {
      try {
        const parsed = JSON.parse(navJson)
        if (Array.isArray(parsed)) {
          navLinks = parsed.filter((link): link is SiteNavLink => Boolean(link && typeof link.label === 'string' && isSafeLink(link.url)))
        }
      } catch {}
    }

    categories = categoryRows
      .filter((category) => category.slug && category.name && category.name !== '未分类')
      .map((category) => ({
        name: category.name,
        slug: category.slug,
      }))

  } catch {
    // Keep graceful fallback behavior for public pages
  }

  return { navLinks, categories, defaultTheme }
}

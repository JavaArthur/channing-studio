'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { ThemeDropdown } from './ThemeDropdown'
import { SearchEntry } from './SearchEntry'
import type { Theme } from '@/lib/appearance'
import type { SiteCategoryLink, SiteNavLink } from '@/lib/site'
import { isSafeLink } from '@/lib/url'

export type NavLink = SiteNavLink
const defaultLinks: NavLink[] = [
  { label: '作品', url: '/work', openInNewTab: false },
  { label: '文章', url: '/writing', openInNewTab: false },
  { label: '资源', url: '/tools', openInNewTab: false },
  { label: '关于', url: '/about', openInNewTab: false },
]
interface Props {
  navLinks?: NavLink[]
  categories?: SiteCategoryLink[]
  activeCategorySlug?: string | null
  stickyOnMobile?: boolean
  initialTheme?: Theme
  studioMode?: boolean
}
export function SiteHeader({ navLinks, initialTheme = 'light' }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const links = (navLinks?.length ? navLinks : defaultLinks).filter(
    (l) => isSafeLink(l.url) && !l.url.startsWith('/admin'),
  )
  const renderLinks = () =>
    links.map((link) => (
      <Link
        key={link.url}
        href={link.url}
        onClick={() => setOpen(false)}
        target={link.openInNewTab ? '_blank' : undefined}
        rel={link.openInNewTab ? 'noopener noreferrer' : undefined}
        aria-current={pathname === link.url ? 'page' : undefined}
        className="min-h-11 min-w-11 public-nav-link"
      >
        {link.label}
      </Link>
    ))
  return (
    <header className="public-header">
      <div className="public-header-inner">
        <Link href="/" className="min-h-11 min-w-11 brand">
          <span className="brand-mark">C.</span>
          <span>
            Channing<span className="brand-subtitle"> / Studio</span>
          </span>
        </Link>
        <nav aria-label="主导航" className="hidden items-center gap-7 md:flex">
          {renderLinks()}
        </nav>
        <div className="flex items-center gap-4">
          <SearchEntry />
          <ThemeDropdown initialTheme={initialTheme} />
          <button
            className="min-h-11 min-w-11 md:hidden"
            aria-label={open ? '关闭菜单' : '打开菜单'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <nav
          aria-label="移动导航"
          className="flex flex-wrap gap-6 border-t border-[var(--editor-line)] px-6 py-5 md:hidden"
        >
          {renderLinks()}
        </nav>
      )}
    </header>
  )
}

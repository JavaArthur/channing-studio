'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useId, useRef, useState } from 'react'
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
  const menuId = useId()
  const menuButton = useRef<HTMLButtonElement>(null)
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
        data-active={pathname === link.url || (link.url === '/tools' && ['/prompts', '/labs'].includes(pathname)) || (link.url === '/writing' && pathname.startsWith('/category/')) ? '' : undefined}
        className="min-h-11 min-w-11 public-nav-link"
      >
        {link.label}
      </Link>
    ))
  return (
    <header
      className="public-header"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault()
          setOpen(false)
          menuButton.current?.focus()
        }
      }}
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <a className="public-skip-link" href="#main-content" onClick={(event) => {
        const main = document.querySelector('main')
        if (main) {
          event.preventDefault()
          main.tabIndex = -1
          main.focus()
          main.scrollIntoView({ block: 'start' })
          setOpen(false)
        }
      }}>跳到主要内容</a>
      <div className="public-header-inner">
        <Link href="/" className="min-h-11 min-w-11 brand" aria-label="Channing Studio 首页" onClick={() => setOpen(false)}>
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
            ref={menuButton}
            type="button"
            className="min-h-11 min-w-11 public-menu-toggle md:hidden"
            aria-label={open ? '关闭菜单' : '打开菜单'}
            aria-controls={menuId}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>
      <nav
        id={menuId}
        aria-label="移动导航"
        hidden={!open}
        className="public-mobile-nav md:hidden"
      >
        {renderLinks()}
      </nav>
    </header>
  )
}

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
  { label: '文章', url: '/writing', openInNewTab: false },
  { label: '项目', url: '/work', openInNewTab: false },
  { label: '百宝箱', url: '/tools', openInNewTab: false },
  { label: '关于', url: '/about', openInNewTab: false },
]

const KNOWN_TOP_ROUTES = new Set([
  '/',
  '/work',
  '/writing',
  '/tools',
  '/prompts',
  '/labs',
  '/about',
  '/search',
])

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
    (l) =>
      isSafeLink(l.url) &&
      !l.url.startsWith('/admin') &&
      !/channing|studio|工作台|工作室/i.test(l.label),
  )

  const isActiveLink = (url: string) =>
    pathname === url ||
    (url === '/tools' && ['/prompts', '/labs'].includes(pathname)) ||
    (url === '/writing' &&
      (pathname.startsWith('/category/') ||
        (!KNOWN_TOP_ROUTES.has(pathname) &&
          !pathname.startsWith('/admin') &&
          !pathname.startsWith('/editor'))))

  const renderLinks = () =>
    links.map((link, index) => (
      <Link
        key={link.url}
        href={link.url}
        aria-label={link.label}
        onClick={() => setOpen(false)}
        target={link.openInNewTab ? '_blank' : undefined}
        rel={link.openInNewTab ? 'noopener noreferrer' : undefined}
        aria-current={pathname === link.url ? 'page' : undefined}
        data-active={isActiveLink(link.url) ? '' : undefined}
        className="min-h-11 min-w-11 public-nav-link"
      >
        <span className="public-nav-index" aria-hidden="true">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="public-nav-label">{link.label}</span>
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
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false)
        }
      }}
    >
      <a
        className="public-skip-link"
        href="#main-content"
        onClick={(event) => {
          const main = document.querySelector('main')
          if (main) {
            event.preventDefault()
            main.tabIndex = -1
            main.focus()
            main.scrollIntoView({ block: 'start' })
            setOpen(false)
          }
        }}
      >
        跳到主要内容
      </a>

      <div className="public-header-inner">
        <Link
          href="/"
          className="min-h-11 min-w-11 brand"
          aria-label="晨启AI 首页"
          onClick={() => setOpen(false)}
        >
          <span className="brand-mark" aria-hidden="true">
            晨<span className="brand-slash">/</span>
          </span>
          <span className="brand-copy">
            <span className="brand-title">晨启AI</span>
            <span className="brand-tag" aria-hidden="true">
              AI 工程手记
            </span>
          </span>
        </Link>

        <nav aria-label="主导航" className="public-desktop-nav">
          {renderLinks()}
        </nav>

        <div className="public-header-controls">
          <SearchEntry />
          <ThemeDropdown initialTheme={initialTheme} />
          <button
            ref={menuButton}
            type="button"
            className="min-h-11 min-w-11 public-menu-toggle"
            aria-label={open ? '关闭菜单' : '打开菜单'}
            aria-controls={menuId}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <nav
        id={menuId}
        aria-label="移动导航"
        hidden={!open}
        className="public-mobile-nav"
      >
        {renderLinks()}
      </nav>
    </header>
  )
}

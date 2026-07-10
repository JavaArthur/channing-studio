'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { Menu, X, ChevronDown } from 'lucide-react'
import { SearchEntry } from './SearchEntry'
import { ThemeDropdown } from '@/components/ThemeDropdown'
import { getClientThemePreference, subscribeToThemeChange, type Theme } from '@/lib/appearance'
import { currentIssueInfo } from '@/lib/format-date'
import type { SiteCategoryLink, SiteNavLink } from '@/lib/site'

export type NavLink = SiteNavLink

interface SiteHeaderProps {
  navLinks?: NavLink[]
  categories?: SiteCategoryLink[]
  activeCategorySlug?: string | null
  stickyOnMobile?: boolean
  initialTheme?: Theme
  studioMode?: boolean
}

const defaultNavLinks: NavLink[] = [
  { label: '作品', url: '/work', openInNewTab: false },
  { label: '文章', url: '/writing', openInNewTab: false },
  { label: '实验室', url: '/labs', openInNewTab: false },
  { label: '关于我', url: '/about', openInNewTab: false },
  { label: 'GitHub', url: 'https://github.com/JavaArthur/channing-studio', openInNewTab: true },
  { label: 'RSS', url: '/feed.xml', openInNewTab: false },
]

function getIssueInfo() {
  return currentIssueInfo()
}

export function SiteHeader({
  navLinks,
  categories = [],
  activeCategorySlug = null,
  stickyOnMobile = true,
  initialTheme = 'default',
  studioMode = false,
}: SiteHeaderProps) {
  const links = studioMode ? defaultNavLinks : navLinks && navLinks.length > 0 ? navLinks : defaultNavLinks
  const publicLinks = links.filter((link) => link.url !== '/admin' && link.label.toLowerCase() !== 'admin')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const categoryRef = useRef<HTMLDivElement>(null)
  // 首屏（含 hydration）使用 initialTheme 保持与 SSR/ISR 缓存 HTML 一致，
  // 挂载后再切到客户端真实主题，避免缓存页与个性化主题冲突的 hydration mismatch (React #418)。
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    const sync = () => setTheme(getClientThemePreference(initialTheme))
    sync()
    return subscribeToThemeChange(sync)
  }, [initialTheme])

  // 点击外部关闭分类下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setCategoryOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  const activeCategory = categories.find(c => c.slug === activeCategorySlug)

  const renderLink = (link: NavLink, onClick?: () => void) => {
    const className = "text-[var(--editor-muted)] hover:text-[var(--editor-ink)] transition-colors duration-150"

    if (link.openInNewTab || link.url.startsWith('http')) {
      return (
        <a
          key={link.label}
          href={link.url}
          target={link.openInNewTab ? '_blank' : undefined}
          rel={link.openInNewTab ? 'noopener noreferrer' : undefined}
          className={className}
          onClick={onClick}
        >
          {link.label}
        </a>
      )
    }

    return (
      <Link
        key={link.label}
        href={link.url}
        className={className}
        onClick={onClick}
      >
        {link.label}
      </Link>
    )
  }

  // 终端主题：logo 区域显示终端提示符
  const renderLogo = () => {
    if (studioMode) {
      return (
        <Link
          href="/"
          className="flex-shrink-0 text-lg font-semibold tracking-tight text-[var(--editor-ink)] hover:text-[var(--editor-accent)] transition-colors duration-200"
          style={{ fontFamily: 'Georgia, "Noto Serif SC", serif' }}
        >
          Channing / Studio
        </Link>
      )
    }

    if (theme === 'terminal') {
      return (
        <Link
          href="/"
          className="flex items-center gap-2 flex-shrink-0 text-[var(--editor-muted)] hover:text-[var(--editor-ink)] transition-colors duration-200"
          style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 13 }}
          suppressHydrationWarning
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', display: 'inline-block', boxShadow: '0 0 8px #4ade80', flexShrink: 0 }} />
          <span style={{ color: 'var(--editor-muted)' }}>channing@blog:~$</span>
          <span style={{ color: 'var(--editor-ink)' }}>./home</span>
        </Link>
      )
    }

    if (theme === 'editorial') {
      const { vol, month, year } = getIssueInfo()
      return (
        <div className="flex items-baseline gap-4 flex-shrink-0" suppressHydrationWarning>
          <Link
            href="/"
            className="text-lg tracking-tight text-[var(--editor-ink)] hover:text-[var(--editor-accent)] transition-colors duration-200 font-bold"
            style={{ fontFamily: 'var(--logo-font, "Noto Serif SC", Georgia, serif)' }}
          >
            晨启AI博客
          </Link>
          <span style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 11, letterSpacing: '0.15em', color: 'var(--editor-muted)' }}>
            VOL.{vol} · {year}年{month}月
          </span>
        </div>
      )
    }

    if (theme === 'clarity') {
      return (
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-[var(--editor-ink)] hover:text-[var(--editor-accent)] transition-colors duration-200 flex-shrink-0"
          style={{ fontFamily: 'var(--logo-font)', letterSpacing: '-0.374px' }}
        >
          晨启AI博客
        </Link>
      )
    }

    return (
      <Link
        href="/"
        className="text-lg tracking-tight text-[var(--editor-ink)] hover:text-[var(--editor-accent)] transition-colors duration-200 flex-shrink-0 font-bold"
        style={{ fontFamily: 'var(--logo-font, Georgia, "Noto Serif SC", serif)' }}
      >
        晨启AI博客
      </Link>
    )
  }

  return (
    <header
      className={`site-header ${stickyOnMobile ? 'sticky' : 'sm:sticky'} top-0 z-40 border-b border-[var(--editor-line)] bg-[var(--background)]/95 backdrop-blur-sm`}
      data-site-header-theme={theme}
      data-site-header-mode={studioMode ? 'studio' : 'blog'}
    >
      <div className="site-header-inner mx-auto max-w-3xl px-4 sm:px-6">
        <div className="h-14 flex items-center justify-between gap-4">
          {renderLogo()}

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-3 text-sm flex-shrink-0">
            {/* Category dropdown */}
            {!studioMode && categories.length > 0 && (
              <div ref={categoryRef} className="relative">
                <button
                  onClick={() => setCategoryOpen(!categoryOpen)}
                  className={`inline-flex items-center gap-1 transition-colors duration-150 ${
                    activeCategorySlug
                      ? 'text-[var(--editor-accent)]'
                      : 'text-[var(--editor-muted)] hover:text-[var(--editor-ink)]'
                  }`}
                >
                  {activeCategory?.name || '分类'}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${categoryOpen ? 'rotate-180' : ''}`} />
                </button>

                {categoryOpen && (
                  <div className="absolute top-full left-0 mt-2 min-w-[140px] rounded-lg border border-[var(--editor-line)] bg-[var(--background)] shadow-lg py-1 z-50">
                    <Link
                      href="/"
                      onClick={() => setCategoryOpen(false)}
                      className={`block px-3 py-2 text-sm transition-colors ${
                        activeCategorySlug === null
                          ? 'text-[var(--editor-accent)] bg-[var(--editor-accent)]/5 font-medium'
                          : 'text-[var(--editor-muted)] hover:text-[var(--editor-ink)] hover:bg-[var(--editor-panel)]'
                      }`}
                    >
                      全部文章
                    </Link>
                    {categories.map(cat => (
                      <Link
                        key={cat.slug}
                        href={`/category/${cat.slug}`}
                        onClick={() => setCategoryOpen(false)}
                        className={`block px-3 py-2 text-sm transition-colors ${
                          activeCategorySlug === cat.slug
                            ? 'text-[var(--editor-accent)] bg-[var(--editor-accent)]/5 font-medium'
                            : 'text-[var(--editor-muted)] hover:text-[var(--editor-ink)] hover:bg-[var(--editor-panel)]'
                        }`}
                      >
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {publicLinks.map(link => renderLink(link))}
            {!studioMode && <>
              <Link href="/clippings" className="text-[var(--editor-muted)] hover:text-[var(--editor-ink)] transition-colors duration-150">剪报</Link>
              <Link href="/tools" className="text-[var(--editor-muted)] hover:text-[var(--editor-ink)] transition-colors duration-150">工具</Link>
            </>}
            <ThemeDropdown initialTheme={initialTheme} />
            <SearchEntry />
          </nav>

          {/* Mobile: search icon + hamburger */}
          <div className="sm:hidden flex items-center gap-1">
            <SearchEntry />
            <button
              className="p-2 text-[var(--editor-muted)] hover:text-[var(--editor-ink)] transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      <div
        className={`
          sm:hidden transition-all duration-300 ease-in-out
          ${mobileMenuOpen ? 'max-h-[70vh] overflow-visible border-t border-[var(--editor-line)]' : 'max-h-0 overflow-hidden'}
        `}
      >
        <div className="bg-[var(--background)]">
          {/* Mobile categories as horizontal pills */}
          {!studioMode && categories.length > 0 && (
            <div className="px-4 py-3 border-b border-[var(--editor-line)]">
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeCategorySlug === null
                      ? 'bg-[var(--editor-accent)] text-white'
                      : 'bg-[var(--editor-panel)] text-[var(--editor-muted)]'
                  }`}
                >
                  全部
                </Link>
                {categories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/category/${category.slug}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeCategorySlug === category.slug
                        ? 'bg-[var(--editor-accent)] text-white'
                        : 'bg-[var(--editor-panel)] text-[var(--editor-muted)]'
                    }`}
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <nav className="flex flex-col text-sm">
            <div className="px-4 py-3 border-b border-[var(--editor-line)]">
              {!studioMode && <Link href="/clippings" className="text-[var(--editor-muted)] hover:text-[var(--editor-ink)] transition-colors" onClick={() => setMobileMenuOpen(false)}>剪报</Link>}
            </div>
            <div className="px-4 py-3 border-b border-[var(--editor-line)]">
              {!studioMode && <Link href="/tools" className="text-[var(--editor-muted)] hover:text-[var(--editor-ink)] transition-colors" onClick={() => setMobileMenuOpen(false)}>工具</Link>}
            </div>
            {publicLinks.map(link => (
              <div key={link.label} className="px-4 py-3 border-b border-[var(--editor-line)]">
                {renderLink(link, () => setMobileMenuOpen(false))}
              </div>
            ))}
            <div className="px-4 py-3 border-t border-[var(--editor-line)] text-[var(--editor-muted)]">
              <ThemeDropdown
                initialTheme={initialTheme}
                inlineMenu
                fullWidth
                onThemeChange={() => setMobileMenuOpen(false)}
                buttonStyle={{
                  width: '100%',
                  justifyContent: 'space-between',
                  color: 'var(--editor-muted)',
                  fontSize: 14,
                }}
                dropdownStyle={{
                  background: 'var(--editor-panel)',
                }}
                itemStyle={{
                  padding: '10px 12px',
                  fontSize: 13,
                }}
              />
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}

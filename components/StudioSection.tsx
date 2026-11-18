import { isSafeLink } from '@/lib/url'
import Link from 'next/link'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'
import type { SiteNavLink } from '@/lib/site'
import type { Theme } from '@/lib/appearance'
import type { ReactNode } from 'react'
import { KeepWords } from './KeepWords'

interface StudioShellProps {
  title: string
  description: string
  navLinks: SiteNavLink[]
  initialTheme: Theme
  children: ReactNode
  eyebrow?: string
  meta?: string
  className?: string
}

export function StudioShell({
  title,
  description,
  navLinks,
  initialTheme,
  children,
  eyebrow,
  meta,
  className = '',
}: StudioShellProps) {
  return (
    <div
      className={`studio-site public-page min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col ${className}`}
    >
      <SiteHeader initialTheme={initialTheme} navLinks={navLinks} studioMode />
      <main
        id="main-content"
        tabIndex={-1}
        className="studio-page-main mx-auto w-full flex-1"
      >
        <header className="studio-page-heading">
          {(eyebrow || meta) && (
            <div className="public-page-strip">
              {eyebrow ? (
                <p className="public-page-eyebrow">
                  <span className="public-eyebrow-tick" aria-hidden="true" />
                  {eyebrow}
                </p>
              ) : (
                <span />
              )}
              {meta && <span className="public-page-meta">{meta}</span>}
            </div>
          )}
          <div className="studio-page-heading-body">
            <h1 className="studio-page-title">
              <KeepWords text={title} />
            </h1>
            <p className="studio-page-description">{description}</p>
          </div>
        </header>
        <div className="public-page-content">{children}</div>
      </main>
      <SiteFooter />
    </div>
  )
}

/** The caller's className owns layout (block rows vs inline links); only the 44px touch target is shared. */
export function StudioLink({
  href,
  children,
  className = 'studio-inline-link inline-flex items-center',
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  if (!isSafeLink(href)) return <span>{children}</span>
  const external = href.startsWith('http')
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`min-h-11 min-w-11 ${className}`}
      >
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={`min-h-11 min-w-11 ${className}`}>
      {children}
    </Link>
  )
}

export function StudioCardLabel({ children }: { children: ReactNode }) {
  return <span className="studio-card-label">{children}</span>
}

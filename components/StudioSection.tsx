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
}

export function StudioShell({
  title,
  description,
  navLinks,
  initialTheme,
  children,
}: StudioShellProps) {
  return (
    <div className="studio-site public-page min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col">
      <SiteHeader initialTheme={initialTheme} navLinks={navLinks} studioMode />
      <main className="studio-page-main mx-auto w-full max-w-6xl flex-1 px-5 py-12 sm:px-8 sm:py-16 lg:px-10">
        <header className="studio-page-heading border-b border-[var(--editor-line)] pb-10 sm:pb-14">
          <h1 className="font-serif font-medium studio-page-title max-w-4xl"><KeepWords text={title} /></h1>
          <p className="studio-page-description mt-5 max-w-2xl">{description}</p>
        </header>
        <div className="public-page-content">{children}</div>
      </main>
      <SiteFooter />
    </div>
  )
}

/** The caller's className owns layout (block rows vs inline links); only the 44px touch target is shared. */
export function StudioLink({ href, children, className = 'studio-inline-link inline-flex items-center' }: { href: string; children: ReactNode; className?:string }) {
  if (!isSafeLink(href)) return <span>{children}</span>
  const external = href.startsWith('http')
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={`min-h-11 min-w-11 ${className}`}>
        {children}
      </a>
    )
  }
  return <Link href={href} className={`min-h-11 min-w-11 ${className}`}>{children}</Link>
}

export function StudioCardLabel({ children }: { children: ReactNode }) {
  return <span className="studio-card-label">{children}</span>
}

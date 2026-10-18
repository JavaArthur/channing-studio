import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--editor-line)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-6 py-8 text-xs text-[var(--editor-muted)] sm:px-10">
        <span>© {new Date().getFullYear()} · Channing Studio</span>
        <nav aria-label="页脚导航" className="flex items-center gap-5">
          <Link href="/about" className="min-h-11 min-w-11 inline-flex items-center">关于</Link>
          <a href="/feed.xml" className="min-h-11 min-w-11 inline-flex items-center">RSS</a>
          <Link href="/admin" className="min-h-11 min-w-11 inline-flex items-center">我的工作台 ↗</Link>
        </nav>
      </div>
    </footer>
  )
}

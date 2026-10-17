import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--editor-line)]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-6 py-8 text-xs text-[var(--editor-muted)] sm:px-10">
        <span>© {new Date().getFullYear()} · Channing Studio</span>
        <nav aria-label="页脚导航" className="flex items-center gap-5">
          <Link href="/about">关于</Link>
          <a href="/feed.xml">RSS</a>
          <Link href="/admin">我的工作台 ↗</Link>
        </nav>
      </div>
    </footer>
  )
}

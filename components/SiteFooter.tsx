import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="public-footer">
      <div className="public-footer-inner">
        <span>© {new Date().getFullYear()} Channing Studio</span>
        <nav aria-label="页脚导航">
          <Link href="/about">关于</Link>
          <a href="/feed.xml">RSS</a>
          <Link href="/admin">我的工作台</Link>
        </nav>
      </div>
    </footer>
  )
}

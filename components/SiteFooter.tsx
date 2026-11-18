import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { PUBLIC_PROFILE } from '@/lib/public-profile'
import type { StudioLink as ProfileLink } from '@/lib/studio-content'
import { isSafeLink } from '@/lib/url'

interface SiteFooterProps {
  subtitle?: string
  contactLinks?: ProfileLink[]
}

export function SiteFooter({ subtitle, contactLinks = [] }: SiteFooterProps) {
  const year = new Date().getFullYear()
  const cleanSubtitle =
    subtitle && !/channing|studio|工作室|工作台/i.test(subtitle)
      ? subtitle
      : PUBLIC_PROFILE.role

  const mergedContacts = [...PUBLIC_PROFILE.contactLinks, ...contactLinks]
    .filter(
      (link) =>
        isSafeLink(link.url) &&
        link.url !== '/feed.xml' &&
        !link.url.startsWith('/admin') &&
        !/studio|工作室|工作台/i.test(link.label),
    )
    .map((link) => ({
      ...link,
      label: /channing/i.test(link.label)
        ? /x\.com|twitter\.com/i.test(link.url)
          ? 'X (Twitter)'
          : link.label.replace(/channing/gi, PUBLIC_PROFILE.brand).trim()
        : link.label,
    }))
    .filter(
      (link, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.url === link.url ||
            candidate.label.toLowerCase() === link.label.toLowerCase(),
        ) === index,
    )

  return (
    <footer className="public-footer" role="contentinfo">
      <div className="public-colophon">
        <div className="public-colophon-strip">
          <span>COLOPHON // {PUBLIC_PROFILE.brand} · AI 工程与技术博客</span>
          <span>EDITION {year} · 曜石与暖宣</span>
        </div>

        <div className="public-colophon-grid">
          <div className="public-colophon-signature">
            <Link href="/" className="min-h-11 public-colophon-brand">
              <span className="public-colophon-monogram" aria-hidden="true">
                晨<span>/</span>
              </span>
              <span className="public-colophon-wordmark">
                {PUBLIC_PROFILE.brand}
                <span aria-hidden="true">.</span>
              </span>
            </Link>
            <p className="public-colophon-role">{cleanSubtitle}</p>
            <p className="public-colophon-note">{PUBLIC_PROFILE.publication}</p>
          </div>

          <nav className="public-colophon-column" aria-label="博客栏目">
            <p className="public-colophon-heading">01 // 栏目导航</p>
            <div className="public-colophon-links">
              <Link href="/writing" className="min-h-11">
                技术文章
              </Link>
              <Link href="/work" className="min-h-11">
                开源与项目
              </Link>
              <Link href="/tools" className="min-h-11">
                常用工具
              </Link>
              <Link href="/prompts" className="min-h-11">
                提示词库
              </Link>
              <Link href="/labs" className="min-h-11">
                工具链实验
              </Link>
              <Link href="/about" className="min-h-11">
                关于作者
              </Link>
            </div>
          </nav>

          <nav className="public-colophon-column" aria-label="订阅与联络">
            <p className="public-colophon-heading">02 // 订阅与联络</p>
            <div className="public-colophon-links">
              {mergedContacts.slice(0, 4).map((item) => {
                const external = item.url.startsWith('http')
                return external ? (
                  <a
                    key={item.url}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-11"
                  >
                    {item.label}
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </a>
                ) : (
                  <Link key={item.url} href={item.url} className="min-h-11">
                    {item.label}
                  </Link>
                )
              })}
              <a href={`mailto:${PUBLIC_PROFILE.email}`} className="min-h-11">
                邮件交流
                <ArrowUpRight size={13} aria-hidden="true" />
              </a>
              <a href="/feed.xml" className="min-h-11">
                RSS 订阅
              </a>
            </div>
          </nav>
        </div>

        <div className="public-colophon-bottom">
          <span>© {year} {PUBLIC_PROFILE.brand} · 原创技术长文与工程实战记录</span>
          <span>AI AGENT · ARCHITECTURE · ENGINEERING NOTES</span>
        </div>
      </div>
    </footer>
  )
}

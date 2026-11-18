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
  const mergedContacts = [...PUBLIC_PROFILE.contactLinks, ...contactLinks]
    .filter((link) => isSafeLink(link.url) && link.url !== '/feed.xml')
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
          <span>COLOPHON // CHANNING STUDIO · ENGINEERING MONOGRAPH</span>
          <span>EDITION {year} · OBSIDIAN &amp; VELLUM</span>
        </div>

        <div className="public-colophon-grid">
          <div className="public-colophon-signature">
            <Link href="/" className="min-h-11 public-colophon-brand">
              <span className="public-colophon-monogram" aria-hidden="true">
                C<span>/</span>
              </span>
              <span className="public-colophon-wordmark">
                Channing Studio<span aria-hidden="true">.</span>
              </span>
            </Link>
            <p className="public-colophon-role">{subtitle || PUBLIC_PROFILE.role}</p>
            <p className="public-colophon-note">{PUBLIC_PROFILE.publication}</p>
          </div>

          <nav className="public-colophon-column" aria-label="站点目录">
            <p className="public-colophon-heading">01 // DIRECTORY</p>
            <div className="public-colophon-links">
              <Link href="/work" className="min-h-11">
                作品档案
              </Link>
              <Link href="/writing" className="min-h-11">
                工程手记
              </Link>
              <Link href="/tools" className="min-h-11">
                工具收藏
              </Link>
              <Link href="/prompts" className="min-h-11">
                提示词库
              </Link>
              <Link href="/labs" className="min-h-11">
                实验室
              </Link>
              <Link href="/about" className="min-h-11">
                关于我
              </Link>
            </div>
          </nav>

          <nav className="public-colophon-column" aria-label="联络与入口">
            <p className="public-colophon-heading">02 // CHANNELS &amp; VAULT</p>
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
                邮件联络
                <ArrowUpRight size={13} aria-hidden="true" />
              </a>
              <a href="/feed.xml" className="min-h-11">
                RSS 订阅
              </a>
              <Link href="/admin" className="min-h-11 public-colophon-vault">
                我的工作台
                <ArrowUpRight size={13} aria-hidden="true" />
              </Link>
            </div>
          </nav>
        </div>

        <div className="public-colophon-bottom">
          <span>© {year} Channing Studio · 曜石与暖宣 · 精密工程手稿</span>
          <span>PUBLIC ARCHIVE // NEXT.JS · CLOUDFLARE D1</span>
        </div>
      </div>
    </footer>
  )
}

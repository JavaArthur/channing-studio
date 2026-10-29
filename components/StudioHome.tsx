import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import type { Theme } from '@/lib/appearance'
import type { SiteNavLink } from '@/lib/site'
import type { StudioContent } from '@/lib/studio-content'
import type { PostWithTags } from '@/lib/repositories/types'
import type { PublicPortfolioProject } from '@/lib/portfolio'
import type { Tool } from '@/lib/repositories/tools'
import type { Prompt } from '@/lib/repositories/prompts'
import { selectStudioTools } from '@/lib/studio-home'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { StudioLink } from './StudioSection'
import { PortfolioIndex } from './PortfolioIndex'
import { KeepWords } from './KeepWords'
import { formatDate } from '@/lib/format-date'

interface Props {
  content: StudioContent
  portfolio: PublicPortfolioProject[]
  posts: PostWithTags[]
  tools: Tool[]
  prompts: Prompt[]
  navLinks: SiteNavLink[]
  initialTheme: Theme
}

export function StudioHome({ content, portfolio, posts, tools, prompts, navLinks, initialTheme }: Props) {
  const projects = portfolio.slice(0, 4)
  const resources = [
    ...selectStudioTools(tools, 3).map(tool => ({ title: tool.name, description: tool.description, type: '工具', href: tool.url || '/tools' })),
    ...prompts.slice(0, 2).map(prompt => ({ title: prompt.title, description: prompt.description, type: '提示词', href: `/prompts#prompt-${prompt.id}` })),
  ].slice(0, 4)

  return (
    <div className="portfolio-site">
      <SiteHeader navLinks={navLinks} initialTheme={initialTheme} />
      <main className="portfolio-main" id="main-content" tabIndex={-1}>
        <section className="portfolio-hero" aria-labelledby="studio-title">
          <h1 id="studio-title"><KeepWords text={content.profile.title} /></h1>
          <div className="portfolio-hero-bottom">
            <div className="portfolio-hero-summary">
              <p>{content.profile.statement}</p>
              <div className="portfolio-hero-links">
                <Link href="/work" className="portfolio-primary">看看我的作品</Link>
                <Link href="/about" className="portfolio-text-link">认识 Channing</Link>
              </div>
            </div>
            <p className="portfolio-byline">{content.profile.subtitle.replace(/\s*·\s*/g, '，')}</p>
          </div>
          <div className="portfolio-practice">
            <span>我在做的事</span>
            <ul>{content.profile.capabilities.map(capability => <li key={capability.title}>{capability.title}</li>)}</ul>
          </div>
        </section>

        {projects.length > 0 && (
          <section className="portfolio-section" aria-labelledby="selected-work">
            <div className="portfolio-section-heading">
              <h2 id="selected-work">一些做成的事</h2>
              <Link href="/work">全部作品</Link>
            </div>
            <PortfolioIndex projects={projects} compact />
          </section>
        )}

        {posts.length > 0 && (
          <section className="portfolio-section portfolio-writing" aria-labelledby="selected-writing">
            <div className="portfolio-section-heading">
              <div>
                <h2 id="selected-writing">实践，也写下来。</h2>
                <p>关于系统、工具，以及做事过程中的判断。</p>
              </div>
              <Link href="/writing">所有文章</Link>
            </div>
            <div className="portfolio-writing-list">
              {posts.map(post => (
                <Link key={post.slug} href={`/${post.slug}`}>
                  <div className="portfolio-writing-meta">
                    <time dateTime={new Date(post.published_at * 1000).toISOString()}>{formatDate(post.published_at)}</time>
                    <span>{post.category || '随笔'}</span>
                  </div>
                  <div>
                    <h3>{post.title}</h3>
                    {post.description && <p>{post.description}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {resources.length > 0 && (
          <section className="portfolio-section" aria-labelledby="selected-resources">
            <div className="portfolio-section-heading">
              <div>
                <h2 id="selected-resources">值得放在手边</h2>
                <p>我选择留下，也愿意分享的工具与方法。</p>
              </div>
              <Link href="/tools">资源收藏</Link>
            </div>
            <div className="portfolio-resources">
              {resources.map((item, index) => (
                <StudioLink href={item.href} className="portfolio-resource" key={`${item.title}-${index}`}>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <span className="portfolio-resource-type">{item.type}</span>
                  </div>
                </StudioLink>
              ))}
            </div>
          </section>
        )}

        <section className="portfolio-signoff" aria-labelledby="studio-signoff">
          <div className="signoff-monogram" aria-hidden="true">C.</div>
          <div>
            <h2 id="studio-signoff">保持好奇，继续构建。</h2>
            <p>这里是 Channing 的工作室，也是持续更新的实践记录。</p>
          </div>
          <div>
            {content.profile.contactLinks.slice(0, 3).map(link => (
              <StudioLink href={link.url} key={link.url}>{link.label}</StudioLink>
            ))}
            <Link href="/writing"><BookOpen size={16} aria-hidden="true" />阅读文章</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

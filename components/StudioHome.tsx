import Link from 'next/link'
import { ArrowDown, ArrowUpRight } from 'lucide-react'
import type { Theme } from '@/lib/appearance'
import type { SiteNavLink } from '@/lib/site'
import type { StudioContent } from '@/lib/studio-content'
import type { PostWithTags } from '@/lib/repositories/types'
import { PORTFOLIO_STATUS_LABELS, type PublicPortfolioProject } from '@/lib/portfolio'
import type { Tool } from '@/lib/repositories/tools'
import type { PromptSummary } from '@/lib/repositories/prompts'
import { selectStudioTools } from '@/lib/studio-home'
import { PUBLIC_PROFILE } from '@/lib/public-profile'
import { SiteHeader } from './SiteHeader'
import { StudioLink } from './StudioSection'
import { formatDate } from '@/lib/format-date'
import '@/styles/studio-atlas.css'

interface Props {
  content: StudioContent
  portfolio: PublicPortfolioProject[]
  posts: PostWithTags[]
  tools: Tool[]
  prompts: PromptSummary[]
  navLinks: SiteNavLink[]
  initialTheme: Theme
}

function ProjectLinks({ project }: { project: PublicPortfolioProject }) {
  return (
    <div className="atlas-project-links">
      {project.site_url && <StudioLink href={project.site_url}>访问网站 <ArrowUpRight size={15} aria-hidden="true" /></StudioLink>}
      {project.repo_url && <StudioLink href={project.repo_url}>公开源码 <ArrowUpRight size={15} aria-hidden="true" /></StudioLink>}
    </div>
  )
}

export function StudioHome({ content, portfolio, posts, tools, prompts, navLinks, initialTheme }: Props) {
  const [featured, ...projects] = portfolio.slice(0, 4)
  const resources = [
    ...selectStudioTools(tools, 3).map(tool => ({ title: tool.name, description: tool.description, type: '工具', href: tool.url || '/tools' })),
    ...prompts.slice(0, 2).map(prompt => ({ title: prompt.title, description: prompt.description, type: '提示词', href: `/prompts#prompt-${prompt.id}` })),
  ].slice(0, 4)

  return (
    <div className="atlas-home">
      <SiteHeader navLinks={navLinks} initialTheme={initialTheme} />
      <main id="main-content" tabIndex={-1}>
        <section className="atlas-cover" aria-labelledby="atlas-title">
          <div className="atlas-wrap">
            <div className="atlas-edition">
              <p>{content.profile.eyebrow}</p>
              <span>个人工程作品档案</span>
            </div>
            <div className="atlas-masthead">
              <h1 id="atlas-title">Channing<span aria-hidden="true">.</span></h1>
              <p>Studio<br /><span>{content.profile.capabilities[0]?.title || content.profile.subtitle}</span></p>
            </div>
            <div className="atlas-cover-grid">
              <div className="atlas-intro">
                <p className="atlas-kicker">{content.profile.subtitle}</p>
                <h2>{PUBLIC_PROFILE.headline}</h2>
                <p className="atlas-statement">{PUBLIC_PROFILE.intro}</p>
                <div className="atlas-intro-links">
                  <Link href="/about">认识 Channing <ArrowUpRight size={16} aria-hidden="true" /></Link>
                  <Link href={posts.length ? '#selected-writing' : '/writing'}>阅读记录 <ArrowDown size={16} aria-hidden="true" /></Link>
                </div>
              </div>
              {featured ? (
                <article className="atlas-featured" aria-labelledby="atlas-featured-title">
                  <div className="atlas-file-top">
                    <span>作品选页 / 01</span>
                    <span className="atlas-status" data-status={featured.status}>{PORTFOLIO_STATUS_LABELS[featured.status]}</span>
                  </div>
                  <p className="atlas-file-slug">{featured.slug}</p>
                  <h2 id="atlas-featured-title">{featured.title}</h2>
                  <p className="atlas-project-summary">{featured.summary}</p>
                  {featured.tags.length > 0 && <ul className="atlas-tags" aria-label="项目技术标签">{featured.tags.map(tag => <li key={tag}>{tag}</li>)}</ul>}
                  <ProjectLinks project={featured} />
                  <span className="atlas-page-corner" aria-hidden="true">01</span>
                </article>
              ) : (
                <div className="atlas-empty">
                  <span className="atlas-kicker">作品档案</span>
                  <Link href="/work">浏览作品 <ArrowUpRight size={28} aria-hidden="true" /></Link>
                </div>
              )}
            </div>
            <div className="atlas-work-label">
              <h2 id="selected-work">项目索引</h2>
              <Link href="/work">全部作品 <ArrowUpRight size={16} aria-hidden="true" /></Link>
            </div>
            {projects.length > 0 && <ol className="atlas-project-index" start={2} aria-labelledby="selected-work">
              {projects.map((project, index) => (
                <li key={project.slug}>
                  <div className="atlas-index-top"><span>{String(index + 2).padStart(2, '0')}</span><span className="atlas-status" data-status={project.status}>{PORTFOLIO_STATUS_LABELS[project.status]}</span></div>
                  <h3>{project.title}</h3>
                  <p>{project.summary}</p>
                  <ProjectLinks project={project} />
                </li>
              ))}
            </ol>}
          </div>
        </section>

        <div className="atlas-reading atlas-wrap">
          {posts.length > 0 && <section className="atlas-writing" aria-labelledby="selected-writing">
            <div className="atlas-section-heading">
              <div><p className="atlas-section-marker">文字 / Notes</p><h2 id="selected-writing">实践记录</h2></div>
              <Link href="/writing">所有文章 <ArrowUpRight size={16} aria-hidden="true" /></Link>
            </div>
            <ol className="atlas-writing-list">
              {posts.map((post, index) => (
                <li key={post.slug}>
                  <Link href={`/${post.slug}`}>
                    <span className="atlas-note-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <div className="atlas-writing-meta"><time dateTime={new Date(post.published_at * 1000).toISOString()}>{formatDate(post.published_at)}</time><span>{post.category || '随笔'}</span></div>
                      <h3>{post.title}</h3>
                      {post.description && <p>{post.description}</p>}
                    </div>
                    <ArrowUpRight className="atlas-note-arrow" size={22} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ol>
          </section>}
          {content.profile.capabilities.length > 0 && <aside className="atlas-practice" aria-labelledby="atlas-practice-title">
            <p className="atlas-section-marker">工作方向</p>
            <h2 id="atlas-practice-title">实践的侧面</h2>
            <dl>{content.profile.capabilities.map((capability, index) => (
              <div key={`${capability.title}-${index}`}>
                <dt><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{capability.title}</dt>
                <dd>{capability.description}</dd>
              </div>
            ))}</dl>
            <Link className="atlas-underlined" href="/about">关于我 <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </aside>}
        </div>

        {resources.length > 0 && <section className="atlas-resources atlas-wrap" aria-labelledby="selected-resources">
          <div className="atlas-section-heading">
            <div><p className="atlas-section-marker">收藏 / Reference</p><h2 id="selected-resources">工具与提示词</h2></div>
            <div className="atlas-resource-links"><Link href="/tools">工具收藏 <ArrowUpRight size={16} aria-hidden="true" /></Link><Link href="/prompts">提示词收藏 <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
          </div>
          <ul className="atlas-resource-shelf">
            {resources.map((item, index) => <li key={`${item.title}-${index}`}>
              <StudioLink href={item.href} className="atlas-resource">
                <span className="atlas-resource-type">{item.type}<ArrowUpRight size={17} aria-hidden="true" /></span>
                <h3>{item.title}</h3>
                {item.description && <p>{item.description}</p>}
              </StudioLink>
            </li>)}
          </ul>
        </section>}
      </main>
      <footer className="atlas-footer">
        <div className="atlas-wrap atlas-footer-inner">
          <div><Link href="/" className="atlas-footer-brand">Channing Studio<span aria-hidden="true">.</span></Link><p>{content.profile.subtitle}</p></div>
          <nav aria-label="联系方式">{content.profile.contactLinks.map((link, index) => <StudioLink href={link.url} key={`${link.url}-${index}`}>{link.label}<ArrowUpRight size={15} aria-hidden="true" /></StudioLink>)}<Link href="/about">关于我 <ArrowUpRight size={15} aria-hidden="true" /></Link></nav>
        </div>
      </footer>
    </div>
  )
}

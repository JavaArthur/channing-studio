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
import { SiteFooter } from './SiteFooter'
import { StudioLink } from './StudioSection'
import { KeepWords } from './KeepWords'
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
  if (!project.site_url && !project.repo_url) return null
  return (
    <div className="atlas-project-links">
      {project.site_url && (
        <StudioLink href={project.site_url}>
          访问网站 <ArrowUpRight size={14} aria-hidden="true" />
        </StudioLink>
      )}
      {project.repo_url && (
        <StudioLink href={project.repo_url}>
          公开源码 <ArrowUpRight size={14} aria-hidden="true" />
        </StudioLink>
      )}
    </div>
  )
}

export function StudioHome({
  content,
  portfolio,
  posts,
  tools,
  prompts,
  navLinks,
  initialTheme,
}: Props) {
  const [featured, ...projects] = portfolio.slice(0, 4)
  const resources = [
    ...selectStudioTools(tools, 3).map((tool) => ({
      title: tool.name,
      description: tool.description,
      type: '工具',
      code: 'TOOL',
      href: tool.url || '/tools',
    })),
    ...prompts.slice(0, 2).map((prompt) => ({
      title: prompt.title,
      description: prompt.description,
      type: '提示词',
      code: 'PROMPT',
      href: `/prompts#prompt-${prompt.id}`,
    })),
  ].slice(0, 4)

  const editionEyebrow = content.profile.eyebrow || 'CHANNING STUDIO'
  const leadFocus = content.profile.capabilities[0]?.title || content.profile.subtitle

  return (
    <div className="atlas-home">
      <SiteHeader navLinks={navLinks} initialTheme={initialTheme} />

      <main id="main-content" tabIndex={-1}>
        <section className="atlas-cover" aria-labelledby="atlas-title">
          <div className="atlas-wrap">
            {/* Top Monograph Edition Strip */}
            <div className="atlas-edition">
              <p className="atlas-edition-code">
                <span className="atlas-edition-tick" aria-hidden="true" />
                [00 // {editionEyebrow} · ENGINEERING MONOGRAPH]
              </p>
              <span className="atlas-edition-meta">
                {leadFocus} · {PUBLIC_PROFILE.experience}
              </span>
            </div>

            {/* Asymmetric Editorial Hero + System Dossier 01 */}
            <div className="atlas-cover-grid">
              <div className="atlas-intro">
                <div className="atlas-author-plate">
                  <span className="atlas-monograph-name">
                    Channing<span aria-hidden="true">.</span>
                  </span>
                  <span className="atlas-role-pill">{PUBLIC_PROFILE.role}</span>
                </div>

                <h1 id="atlas-title" className="atlas-hero-headline">
                  <KeepWords text={PUBLIC_PROFILE.headline} />
                </h1>

                <p className="atlas-statement">{PUBLIC_PROFILE.intro}</p>

                <div className="atlas-provenance">
                  <span>{PUBLIC_PROFILE.experience}</span>
                  <span className="atlas-provenance-sep" aria-hidden="true">
                    /
                  </span>
                  <span>{PUBLIC_PROFILE.publication}</span>
                </div>

                <div className="atlas-intro-links">
                  <Link href="/about" className="atlas-cta-primary">
                    认识 Channing <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                  <Link
                    href={posts.length ? '#selected-writing' : '/writing'}
                    className="atlas-cta-secondary"
                  >
                    阅读实践手记 <ArrowDown size={15} aria-hidden="true" />
                  </Link>
                  <Link href="/work" className="atlas-cta-inline">
                    作品档案 <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </div>

              {featured ? (
                <article className="atlas-featured" aria-labelledby="atlas-featured-title">
                  <div className="atlas-featured-inner">
                    <div className="atlas-file-top">
                      <span className="atlas-file-label">SYSTEM DOSSIER // 01</span>
                      <span className="atlas-status" data-status={featured.status}>
                        {PORTFOLIO_STATUS_LABELS[featured.status]}
                      </span>
                    </div>

                    <p className="atlas-file-slug">ID // {featured.slug}</p>
                    <h2 id="atlas-featured-title">{featured.title}</h2>
                    {featured.summary && (
                      <p className="atlas-project-summary">{featured.summary}</p>
                    )}

                    {featured.tags.length > 0 && (
                      <ul className="atlas-tags" aria-label="项目技术标签">
                        {featured.tags.map((tag) => (
                          <li key={tag}>{tag}</li>
                        ))}
                      </ul>
                    )}

                    <div className="atlas-featured-footer">
                      <ProjectLinks project={featured} />
                      <span className="atlas-page-corner" aria-hidden="true">
                        01
                      </span>
                    </div>
                  </div>
                </article>
              ) : (
                <div className="atlas-empty">
                  <div className="atlas-file-top">
                    <span className="atlas-file-label">SYSTEM DOSSIER // ARCHIVE</span>
                    <span className="atlas-status" data-status="active">
                      持续演进
                    </span>
                  </div>
                  <p className="atlas-empty-copy">
                    公开工程项目与内容系统正在同步整理，可直接检阅作品归档或阅读工程实践手记。
                  </p>
                  <div className="atlas-empty-actions">
                    <Link href="/work">
                      浏览作品档案 <ArrowUpRight size={18} aria-hidden="true" />
                    </Link>
                    <Link href="/about">
                      查看工程履历 <ArrowUpRight size={18} aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Selected Systems Matrix (02..N) */}
            <div className="atlas-systems-block">
              <div className="atlas-work-label">
                <div className="atlas-work-label-left">
                  <span className="atlas-section-code">01 // SELECTED SYSTEMS</span>
                  <h2 id="selected-work">项目索引</h2>
                </div>
                <Link href="/work">
                  全部公开作品
                  {portfolio.length > 0 ? ` (${portfolio.length})` : ''}{' '}
                  <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </div>

              {projects.length > 0 && (
                <ol
                  className="atlas-project-index"
                  data-count={projects.length}
                  start={2}
                  aria-labelledby="selected-work"
                >
                  {projects.map((project, index) => (
                    <li key={project.slug}>
                      <div className="atlas-index-top">
                        <div className="atlas-index-id">
                          <span className="atlas-index-num">
                            {String(index + 2).padStart(2, '0')}
                          </span>
                          <span className="atlas-index-slug">{project.slug}</span>
                        </div>
                        <span className="atlas-status" data-status={project.status}>
                          {PORTFOLIO_STATUS_LABELS[project.status]}
                        </span>
                      </div>
                      <h3>{project.title}</h3>
                      {project.summary && <p>{project.summary}</p>}
                      {project.tags.length > 0 && (
                        <ul className="atlas-mini-tags" aria-label="技术标签">
                          {project.tags.slice(0, 4).map((tag) => (
                            <li key={tag}>{tag}</li>
                          ))}
                        </ul>
                      )}
                      <ProjectLinks project={project} />
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </section>

        {/* Field Notes Ledger (DOM First for Mobile) + Engineering Practice Dossier */}
        {(posts.length > 0 || content.profile.capabilities.length > 0) && (
          <div className="atlas-reading atlas-wrap">
            {posts.length > 0 && (
              <section className="atlas-writing" aria-labelledby="selected-writing">
                <div className="atlas-section-heading">
                  <div>
                    <p className="atlas-section-marker">02 // FIELD NOTES · WRITING</p>
                    <h2 id="selected-writing">实践记录</h2>
                  </div>
                  <Link href="/writing">
                    所有文章 <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </div>

                <ol className="atlas-writing-list">
                  {posts.map((post, index) => (
                    <li key={post.slug}>
                      <Link href={`/${post.slug}`}>
                        <span className="atlas-note-number" aria-hidden="true">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="atlas-note-body">
                          <div className="atlas-writing-meta">
                            <time
                              dateTime={new Date(post.published_at * 1000).toISOString()}
                            >
                              {formatDate(post.published_at)}
                            </time>
                            <span className="atlas-note-category">
                              {post.category || '随笔'}
                            </span>
                          </div>
                          <h3>{post.title}</h3>
                          {post.description && <p>{post.description}</p>}
                        </div>
                        <ArrowUpRight
                          className="atlas-note-arrow"
                          size={20}
                          aria-hidden="true"
                        />
                      </Link>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {content.profile.capabilities.length > 0 && (
              <aside className="atlas-practice" aria-labelledby="atlas-practice-title">
                <div className="atlas-practice-head">
                  <p className="atlas-section-marker">DOSSIER // PRACTICE PILLARS</p>
                  <h2 id="atlas-practice-title">实践的侧面</h2>
                </div>

                <dl className="atlas-practice-list">
                  {content.profile.capabilities.map((capability, index) => (
                    <div key={`${capability.title}-${index}`}>
                      <dt>
                        <span aria-hidden="true">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        {capability.title}
                      </dt>
                      <dd>{capability.description}</dd>
                    </div>
                  ))}
                </dl>

                <div className="atlas-practice-foot">
                  <Link className="atlas-underlined" href="/about">
                    关于我与代表案例 <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </aside>
            )}
          </div>
        )}

        {/* Curated Arsenal: Tools & Prompts Specification Shelf */}
        {resources.length > 0 && (
          <section
            className="atlas-resources atlas-wrap"
            aria-labelledby="selected-resources"
          >
            <div className="atlas-section-heading">
              <div>
                <p className="atlas-section-marker">03 // CURATED ARSENAL · REFERENCE</p>
                <h2 id="selected-resources">工具与提示词</h2>
              </div>
              <div className="atlas-resource-links">
                <Link href="/tools">
                  工具收藏 <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
                <Link href="/prompts">
                  提示词收藏 <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <ul className="atlas-resource-shelf" data-count={resources.length}>
              {resources.map((item, index) => (
                <li key={`${item.title}-${index}`}>
                  <StudioLink href={item.href} className="atlas-resource">
                    <div className="atlas-resource-top">
                      <span className="atlas-resource-code">
                        SPEC // {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="atlas-resource-badge">
                        {item.type}
                        <ArrowUpRight size={14} aria-hidden="true" />
                      </span>
                    </div>
                    <h3>{item.title}</h3>
                    {item.description && <p>{item.description}</p>}
                  </StudioLink>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      <SiteFooter
        subtitle={content.profile.subtitle}
        contactLinks={content.profile.contactLinks}
      />
    </div>
  )
}

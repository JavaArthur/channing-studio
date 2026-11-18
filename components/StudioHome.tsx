import Link from 'next/link'
import { ArrowDown, ArrowUpRight, Rss } from 'lucide-react'
import type { Theme } from '@/lib/appearance'
import type { SiteNavLink } from '@/lib/site'
import { DEFAULT_HOME_MODULES, type StudioContent } from '@/lib/studio-content'
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
          访问站点 <ArrowUpRight size={14} aria-hidden="true" />
        </StudioLink>
      )}
      {project.repo_url && (
        <StudioLink href={project.repo_url}>
          开源仓库 <ArrowUpRight size={14} aria-hidden="true" />
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
  const mods = content.homeModules ?? DEFAULT_HOME_MODULES

  // Hero Right: Featured Essay (pluggable via mods.featuredEssay)
  const heroEssay = mods.featuredEssay ? posts[0] ?? null : null

  // Latest Writing Stream (pluggable via mods.writing, up to mods.writingLimit)
  const writingPool =
    mods.featuredEssay && posts.length > 1 ? posts.slice(1) : posts
  const writingPosts = mods.writing
    ? writingPool.slice(0, mods.writingLimit)
    : []

  // Focus Areas Side Rail (pluggable via mods.focusAreas)
  const focusCapabilities = mods.focusAreas ? content.profile.capabilities : []

  // Side Projects (pluggable via mods.projects, up to mods.projectsLimit; exclude self-referential studio entries)
  const visibleProjects = mods.projects
    ? portfolio
        .filter(
          (item) =>
            item.slug !== 'channing-studio' &&
            !/channing[\s-]*studio/i.test(item.title),
        )
        .slice(0, mods.projectsLimit)
    : []

  // Toolkit Shelf (tools & prompts independently pluggable)
  const toolSliceLimit = mods.prompts ? 2 : 4
  const promptSliceLimit = mods.tools ? 2 : 4
  const toolkitItems = [
    ...(mods.tools
      ? selectStudioTools(tools, toolSliceLimit).map((tool) => ({
          title: tool.name,
          description: tool.description,
          type: '常用工具',
          href: tool.url || '/tools',
        }))
      : []),
    ...(mods.prompts
      ? prompts.slice(0, promptSliceLimit).map((prompt) => ({
          title: prompt.title,
          description: prompt.description,
          type: '提示词',
          href: `/prompts#prompt-${prompt.id}`,
        }))
      : []),
  ].slice(0, 4)

  const showWritingRow =
    (mods.writing && writingPosts.length > 0) || focusCapabilities.length > 0
  const showProjectsRow = visibleProjects.length > 0
  const showToolkitRow = toolkitItems.length > 0

  // Dynamic gap-free section numbering (01 -> 02 -> 03 regardless of which modules are unplugged)
  let sectionSeq = 0
  const nextSeq = () => String(++sectionSeq).padStart(2, '0')
  const writingSeq = showWritingRow ? nextSeq() : '01'
  const projectsSeq = showProjectsRow ? nextSeq() : '02'
  const toolkitSeq = showToolkitRow ? nextSeq() : '03'

  const rawEyebrow = content.profile.eyebrow
  const brandLabel =
    !rawEyebrow || /channing|studio|工作室|工作台/i.test(rawEyebrow)
      ? PUBLIC_PROFILE.brand
      : rawEyebrow
  const cleanSubtitle =
    content.profile.subtitle &&
    !/channing|studio|工作室|工作台/i.test(content.profile.subtitle)
      ? content.profile.subtitle
      : PUBLIC_PROFILE.role

  const heroReadingMinutes = heroEssay
    ? Math.max(
        1,
        Math.ceil(
          ((heroEssay.content?.length || heroEssay.description?.length || 600) as number) /
            400,
        ),
      )
    : 1

  return (
    <div className="atlas-home">
      <SiteHeader navLinks={navLinks} initialTheme={initialTheme} />

      <main id="main-content" tabIndex={-1}>
        <section className="atlas-cover" aria-labelledby="atlas-title">
          <div className="atlas-wrap">
            {/* Top Blog Edition Strip */}
            <div className="atlas-edition">
              <p className="atlas-edition-code">
                <span className="atlas-edition-tick" aria-hidden="true" />
                {brandLabel} · 个人技术博客与实战手记
              </p>
              <span className="atlas-edition-meta">
                {cleanSubtitle} · {PUBLIC_PROFILE.experience}
              </span>
            </div>

            {/* Asymmetric Blog Hero: Personal Intro (Left) + Featured Essay Dossier (Right) */}
            <div
              className="atlas-cover-grid"
              data-single={!mods.featuredEssay ? 'true' : undefined}
            >
              <div className="atlas-intro">
                <div className="atlas-author-plate">
                  <span className="atlas-monograph-name">
                    {PUBLIC_PROFILE.brand}
                    <span aria-hidden="true">.</span>
                  </span>
                  <span className="atlas-role-pill">AI 工程实战博客</span>
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
                  <Link
                    href={
                      mods.writing && writingPosts.length > 0
                        ? '#latest-writing'
                        : '/writing'
                    }
                    className="atlas-cta-primary"
                  >
                    阅读最新文章
                    {mods.writing && writingPosts.length > 0 ? (
                      <ArrowDown size={15} aria-hidden="true" />
                    ) : (
                      <ArrowUpRight size={15} aria-hidden="true" />
                    )}
                  </Link>
                  <Link href="/about" className="atlas-cta-secondary">
                    关于作者 <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                  <a href="/feed.xml" className="atlas-cta-inline">
                    <Rss size={14} aria-hidden="true" />
                    RSS 订阅
                  </a>
                </div>
              </div>

              {mods.featuredEssay &&
                (heroEssay ? (
                  <article
                    className="atlas-featured"
                    aria-labelledby="atlas-featured-title"
                  >
                    <div className="atlas-featured-inner">
                      <div className="atlas-file-top">
                        <span className="atlas-file-label">
                          精选长文 // FEATURED ESSAY
                        </span>
                        <span className="atlas-essay-category">
                          {heroEssay.category || '技术手记'}
                        </span>
                      </div>

                      <div className="atlas-essay-meta">
                        <time
                          dateTime={new Date(
                            heroEssay.published_at * 1000,
                          ).toISOString()}
                        >
                          {formatDate(heroEssay.published_at)}
                        </time>
                        <span aria-hidden="true">·</span>
                        <span>约 {heroReadingMinutes} 分钟阅读</span>
                      </div>

                      <h2 id="atlas-featured-title">
                        <Link
                          href={`/${heroEssay.slug}`}
                          className="atlas-featured-link"
                        >
                          {heroEssay.title}
                        </Link>
                      </h2>

                      {heroEssay.description && (
                        <p className="atlas-project-summary">
                          {heroEssay.description}
                        </p>
                      )}

                      {heroEssay.tags && heroEssay.tags.length > 0 && (
                        <ul className="atlas-tags" aria-label="文章标签">
                          {heroEssay.tags.slice(0, 4).map((tag) => (
                            <li key={tag}>#{tag}</li>
                          ))}
                        </ul>
                      )}

                      <div className="atlas-featured-footer">
                        <Link
                          href={`/${heroEssay.slug}`}
                          className="min-h-11 atlas-essay-cta"
                        >
                          阅读全文 <ArrowUpRight size={15} aria-hidden="true" />
                        </Link>
                        <span className="atlas-page-corner" aria-hidden="true">
                          01
                        </span>
                      </div>
                    </div>
                  </article>
                ) : (
                  <div className="atlas-empty">
                    <div className="atlas-file-top">
                      <span className="atlas-file-label">
                        精选长文 // FEATURED ESSAY
                      </span>
                      <span className="atlas-essay-category">持续更新</span>
                    </div>
                    <p className="atlas-empty-copy">
                      围绕企业级 AI Agent 编排、知识工程与高可靠后端架构的实战长文正在整理发布中。
                    </p>
                    <div className="atlas-empty-actions">
                      <Link href="/writing">
                        进入文章归档 <ArrowUpRight size={16} aria-hidden="true" />
                      </Link>
                      <Link href="/about">
                        了解作者履历 <ArrowUpRight size={16} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </section>

        {/* Section 01: Latest Writing Stream + Optional Focus Areas Side Rail */}
        {showWritingRow && (
          <div className="atlas-reading atlas-wrap">
            {mods.writing && writingPosts.length > 0 && (
              <section className="atlas-writing" aria-labelledby="latest-writing">
                <div className="atlas-section-heading">
                  <div>
                    <p className="atlas-section-marker">
                      {`${writingSeq} // LATEST WRITING · 最新文章`}
                    </p>
                    <h2 id="latest-writing">最新技术手记</h2>
                  </div>
                  <Link href="/writing">
                    查看全部文章 <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </div>

                <ol className="atlas-writing-list">
                  {writingPosts.map((post, index) => (
                    <li key={post.slug}>
                      <Link href={`/${post.slug}`}>
                        <span className="atlas-note-number" aria-hidden="true">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="atlas-note-body">
                          <div className="atlas-writing-meta">
                            <time
                              dateTime={new Date(
                                post.published_at * 1000,
                              ).toISOString()}
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

            {focusCapabilities.length > 0 && (
              <aside className="atlas-practice" aria-labelledby="atlas-practice-title">
                <div className="atlas-practice-head">
                  <p className="atlas-section-marker">
                    {mods.writing && writingPosts.length > 0
                      ? 'FOCUS AREAS // 写作关注'
                      : `${writingSeq} // FOCUS AREAS · 写作关注`}
                  </p>
                  <h2 id="atlas-practice-title">长期深耕与记录的方向</h2>
                </div>

                <dl className="atlas-practice-list">
                  {focusCapabilities.map((capability, index) => (
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
                    作者背景与代表系统案例{' '}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </aside>
            )}
          </div>
        )}

        {/* Section 02 (Pluggable): Side Projects & Open Source */}
        {showProjectsRow && (
          <section
            className="atlas-projects-section atlas-wrap"
            aria-labelledby="selected-work"
          >
            <div className="atlas-section-heading">
              <div>
                <p className="atlas-section-marker">
                  {`${projectsSeq} // SIDE PROJECTS · 开源与实践`}
                </p>
                <h2 id="selected-work">开源工具与工程实践</h2>
              </div>
              <Link href="/work">
                全部项目 <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            </div>

            <ol
              className="atlas-project-index"
              data-count={visibleProjects.length}
              aria-labelledby="selected-work"
            >
              {visibleProjects.map((project, index) => (
                <li key={project.slug}>
                  <div className="atlas-index-top">
                    <div className="atlas-index-id">
                      <span className="atlas-index-num">
                        {String(index + 1).padStart(2, '0')}
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
          </section>
        )}

        {/* Section 03 (Pluggable): Toolkit (Tools & Prompts) */}
        {showToolkitRow && (
          <section
            className="atlas-resources atlas-wrap"
            aria-labelledby="selected-resources"
          >
            <div className="atlas-section-heading">
              <div>
                <p className="atlas-section-marker">
                  {`${toolkitSeq} // TOOLKIT · 常用百宝箱`}
                </p>
                <h2 id="selected-resources">
                  {mods.tools && mods.prompts
                    ? '常用利器与提示词'
                    : mods.tools
                      ? '常用效率利器'
                      : '实战提示词样本'}
                </h2>
              </div>
              <div className="atlas-resource-links">
                {mods.tools && (
                  <Link href="/tools">
                    工具收藏 <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                )}
                {mods.prompts && (
                  <Link href="/prompts">
                    提示词库 <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                )}
              </div>
            </div>

            <ul className="atlas-resource-shelf" data-count={toolkitItems.length}>
              {toolkitItems.map((item, index) => (
                <li key={`${item.title}-${index}`}>
                  <StudioLink href={item.href} className="atlas-resource">
                    <div className="atlas-resource-top">
                      <span className="atlas-resource-code">
                        ITEM // {String(index + 1).padStart(2, '0')}
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
        subtitle={cleanSubtitle}
        contactLinks={content.profile.contactLinks}
      />
    </div>
  )
}

import { ArrowUpRight } from 'lucide-react'
import { portfolioHref, PORTFOLIO_STATUS_LABELS, type PublicPortfolioProject } from '@/lib/portfolio'
import { StudioLink } from './StudioSection'

function locationLabel(href: string) {
  if (href.startsWith('/')) return href
  const url = new URL(href)
  return url.host + url.pathname.replace(/\/$/, '')
}

export function PortfolioIndex({
  projects,
  compact = false,
  headingLevel = 3,
}: {
  projects: PublicPortfolioProject[]
  compact?: boolean
  headingLevel?: 2 | 3
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <ol className={`portfolio-index index-projects${compact ? ' portfolio-index-compact' : ''}`}>
      {projects.map((project, index) => {
        const href = portfolioHref(project)
        return (
          <li key={project.slug} id={project.slug} className="index-project">
            <div className="index-project-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</div>
            <div className="index-project-main">
              <div className="index-project-topline">
                <span className="index-slug">{project.slug}</span>
                <span className="index-status" data-status={project.status}>{PORTFOLIO_STATUS_LABELS[project.status]}</span>
              </div>
              <Heading className="index-project-title">{href ? <StudioLink href={href} className="index-title-link">{project.title}<ArrowUpRight size={22} aria-hidden="true" /></StudioLink> : project.title}</Heading>
              {project.summary && <p className="index-project-summary">{project.summary}</p>}
              {!compact && project.tags.length > 0 && (
                <ul className="index-tags" aria-label="技术栈">
                  {project.tags.map((tag) => <li key={tag}>{tag}</li>)}
                </ul>
              )}
              {href && <span className="index-location">{locationLabel(href)}</span>}
            </div>
            {!compact && (
              <div className="index-project-links">
                {project.site_url && <StudioLink href={project.site_url} className="index-text-link">访问网站<ArrowUpRight size={15} aria-hidden="true" /></StudioLink>}
                {project.repo_url && <StudioLink href={project.repo_url} className="index-text-link">公开源码<ArrowUpRight size={15} aria-hidden="true" /></StudioLink>}
                {!href && <span className="index-meta">暂无公开链接</span>}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

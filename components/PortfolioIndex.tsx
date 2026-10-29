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
    <ol className={`portfolio-index${compact ? ' portfolio-index-compact' : ''}`}>
      {projects.map((project) => {
        const href = portfolioHref(project)
        return (
          <li key={project.slug} id={project.slug} className="portfolio-entry">
            <div className="portfolio-entry-head">
              <Heading className="portfolio-project-heading">{href ? <StudioLink href={href} className="portfolio-entry-title">{project.title}</StudioLink> : project.title}</Heading>
              {href && <span className="portfolio-entry-location">{locationLabel(href)}</span>}
            </div>
            <div className="portfolio-entry-body">
              <p>{project.summary}</p>
              {!compact && project.tags.length > 0 && (
                <ul className="portfolio-entry-tags" aria-label="技术栈">
                  {project.tags.map((tag) => <li key={tag}>{tag}</li>)}
                </ul>
              )}
            </div>
            <div className="portfolio-entry-meta">
              <span className="portfolio-status public-project-status" data-status={project.status}>{PORTFOLIO_STATUS_LABELS[project.status]}</span>
              {!compact && (
                <div className="portfolio-entry-actions">
                  {project.site_url && <StudioLink href={project.site_url} className="portfolio-action">访问网站<ArrowUpRight size={14} aria-hidden="true" /></StudioLink>}
                  {project.repo_url && <StudioLink href={project.repo_url} className="portfolio-action">源码<ArrowUpRight size={14} aria-hidden="true" /></StudioLink>}
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { StudioLink } from '@/components/StudioSection'
import { PUBLIC_PROFILE } from '@/lib/public-profile'
import type { StudioLink as ProfileLink } from '@/lib/studio-content'
import '@/styles/studio-about.css'

export function AboutProfile({ contactLinks }: { contactLinks: ProfileLink[] }) {
  const links = [...PUBLIC_PROFILE.contactLinks, ...contactLinks].filter((link, index, all) =>
    all.findIndex((candidate) => candidate.url === link.url || candidate.label.toLowerCase() === link.label.toLowerCase()) === index,
  )
  return (
    <div className="about-profile">
      <section className="about-identity" aria-label="个人背景">
        <div className="about-identity-name">
          <p className="about-label">ABOUT ME</p>
          <h2>{PUBLIC_PROFILE.alias}</h2>
          <p>{PUBLIC_PROFILE.role}</p>
        </div>
        <div className="about-experience">
          <p>{PUBLIC_PROFILE.experience}</p>
          <span>{PUBLIC_PROFILE.experienceAsOf}</span>
          <p className="about-team">{PUBLIC_PROFILE.team}</p>
        </div>
        <a className="about-case-jump" href="#selected-experience">
          项目与职责 <ArrowDown aria-hidden size={18} />
        </a>
      </section>

      <section id="selected-experience" className="about-records" aria-labelledby="about-records-title">
        <header className="about-section-heading">
          <div>
            <p className="about-label">SELECTED EXPERIENCE</p>
            <h2 id="about-records-title">做过的系统，承担的部分。</h2>
          </div>
          <p>任职期间的团队项目</p>
        </header>

        {PUBLIC_PROFILE.cases.map((project) => (
          <article className="about-case" key={project.id} aria-labelledby={`about-case-${project.id}`}>
            <div className="about-case-heading">
              <p className="about-case-index"><span>{project.number}</span>{project.field}</p>
              <div>
                <h3 id={`about-case-${project.id}`}>{project.name}</h3>
                <p className="about-case-period">{project.period}</p>
              </div>
              <p className="about-case-role">{project.role}</p>
            </div>

            <div className="about-case-body">
              <div className="about-evidence">
                <p className="about-label">{project.id === 'reservation' ? '团队交付' : '平台成果'}</p>
                <p className="about-evidence-number">{project.metric}<span>{project.metricUnit}</span></p>
                <p className="about-evidence-label">{project.metricLabel}</p>
                <p className="about-evidence-note">{project.metricNote}</p>
                <p className="about-evidence-date">{project.metricDate}</p>
              </div>
              <div className="about-case-story">
                <p className="about-case-headline">{project.headline}</p>
                <p className="about-case-summary">{project.summary}</p>
                <p className="about-technologies">{project.technologies}</p>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="about-closing" aria-labelledby="about-closing-title">
        <p className="about-label">WRITING & CONTACT</p>
        <div>
          <h2 id="about-closing-title">{PUBLIC_PROFILE.closingTitle}</h2>
          <p className="about-closing-copy">{PUBLIC_PROFILE.writing}</p>
          <p className="about-closing-copy">{PUBLIC_PROFILE.closing}</p>
          <p className="about-closing-copy">{PUBLIC_PROFILE.publication}</p>
          <div className="about-links">
            <StudioLink href="/work" className="about-link">查看公开作品 <ArrowUpRight aria-hidden size={17} /></StudioLink>
            <StudioLink href="/writing" className="about-link">阅读工程记录 <ArrowUpRight aria-hidden size={17} /></StudioLink>
          </div>
          <div className="about-contact">
            <p>联系与订阅</p>
            <div className="about-links">
              <a href={`mailto:${PUBLIC_PROFILE.email}`} className="about-link">
                {PUBLIC_PROFILE.email} <ArrowUpRight aria-hidden size={17} />
              </a>
              {links.map((link) => (
                <StudioLink key={`${link.label}-${link.url}`} href={link.url} className="about-link">
                  {link.label} <ArrowUpRight aria-hidden size={17} />
                </StudioLink>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

import { ArrowDown, ArrowUpRight } from 'lucide-react'
import { StudioLink } from '@/components/StudioSection'
import { PUBLIC_PROFILE } from '@/lib/public-profile'
import {
  DEFAULT_STUDIO_CONTENT,
  type StudioCapability,
  type StudioLink as ProfileLink,
} from '@/lib/studio-content'
import '@/styles/studio-about.css'

export function AboutProfile({
  contactLinks,
  capabilities = DEFAULT_STUDIO_CONTENT.profile.capabilities,
}: {
  contactLinks: ProfileLink[]
  capabilities?: StudioCapability[]
}) {
  const links = [...PUBLIC_PROFILE.contactLinks, ...contactLinks]
    .filter(
      (link) =>
        !link.url.startsWith('/admin') &&
        !/studio|工作室|工作台/i.test(link.label),
    )
    .filter(
      (link, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.url === link.url ||
            candidate.label.toLowerCase() === link.label.toLowerCase(),
        ) === index,
    )

  return (
    <div className="about-profile">
      {/* Identity & Career Overview Ledger */}
      <section className="about-identity" aria-label="作者背景">
        <div className="about-identity-name">
          <p className="about-label">00 // AUTHOR PROFILE</p>
          <h2>
            {PUBLIC_PROFILE.brand} · {PUBLIC_PROFILE.alias}
          </h2>
          <p>{PUBLIC_PROFILE.role}</p>
        </div>

        <div className="about-experience">
          <div className="about-experience-head">
            <p>{PUBLIC_PROFILE.experience}</p>
            <span className="about-asof">{PUBLIC_PROFILE.experienceAsOf}</span>
          </div>
          <p className="about-team">{PUBLIC_PROFILE.team}</p>
        </div>

        <a className="about-case-jump" href="#selected-experience">
          代表系统与职责 <ArrowDown aria-hidden size={16} />
        </a>
      </section>

      {/* Verified Engineering Case Monographs */}
      <section
        id="selected-experience"
        className="about-records"
        aria-labelledby="about-records-title"
      >
        <header className="about-section-heading">
          <div>
            <p className="about-label">01 // SELECTED SYSTEMS</p>
            <h2 id="about-records-title">做过的系统，承担的部分。</h2>
          </div>
          <p className="about-section-note">任职期间核对过的代表性工程系统</p>
        </header>

        {PUBLIC_PROFILE.cases.map((project) => (
          <article
            className="about-case"
            key={project.id}
            aria-labelledby={`about-case-${project.id}`}
          >
            <div className="about-case-heading">
              <p className="about-case-index">
                <span>CASE // {project.number}</span>
                {project.field}
              </p>
              <div>
                <h3 id={`about-case-${project.id}`}>{project.name}</h3>
                <p className="about-case-period">{project.period}</p>
              </div>
              <p className="about-case-role">{project.role}</p>
            </div>

            <div className="about-case-body">
              <div className="about-evidence">
                <p className="about-label">
                  {project.id === 'reservation'
                    ? 'TEAM DELIVERY // 团队交付'
                    : 'PLATFORM OUTCOME // 平台成果'}
                </p>
                <p className="about-evidence-number">
                  {project.metric}
                  <span>{project.metricUnit}</span>
                </p>
                <p className="about-evidence-label">{project.metricLabel}</p>
                <p className="about-evidence-note">{project.metricNote}</p>
                <p className="about-evidence-date">{project.metricDate}</p>
              </div>

              <div className="about-case-story">
                <p className="about-case-headline">{project.headline}</p>
                <p className="about-case-summary">{project.summary}</p>
                <ul className="about-tech-list" aria-label="关键技术栈">
                  {project.technologies.split(' / ').map((tech) => (
                    <li key={tech}>{tech}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </section>

      {/* Practice Pillars Matrix */}
      {capabilities.length > 0 && (
        <section className="about-pillars" aria-labelledby="about-pillars-title">
          <header className="about-section-heading">
            <div>
              <p className="about-label">02 // FOCUS AREAS</p>
              <h2 id="about-pillars-title">长期投入与写作的技术方向。</h2>
            </div>
          </header>

          <dl className="about-pillars-grid" data-count={capabilities.length}>
            {capabilities.map((item, idx) => (
              <div key={`${item.title}-${idx}`} className="about-pillar-cell">
                <dt>
                  <span aria-hidden="true">{String(idx + 1).padStart(2, '0')}</span>
                  {item.title}
                </dt>
                <dd>{item.description}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Writing Philosophy & Verified Contact Matrix */}
      <section className="about-closing" aria-labelledby="about-closing-title">
        <div className="about-closing-rail">
          <p className="about-label">03 // WRITING &amp; CONTACT</p>
          <p className="about-rail-pub">{PUBLIC_PROFILE.publication}</p>
        </div>

        <div className="about-closing-body">
          <h2 id="about-closing-title">{PUBLIC_PROFILE.closingTitle}</h2>
          <p className="about-closing-copy">{PUBLIC_PROFILE.writing}</p>
          <p className="about-closing-copy">{PUBLIC_PROFILE.closing}</p>

          <div className="about-primary-actions">
            <StudioLink href="/writing" className="about-action-btn about-action-primary">
              阅读技术长文 <ArrowUpRight aria-hidden size={16} />
            </StudioLink>
            <StudioLink href="/work" className="about-action-btn about-action-secondary">
              查看开源与项目 <ArrowUpRight aria-hidden size={16} />
            </StudioLink>
          </div>

          <div className="about-contact">
            <p className="about-contact-heading">VERIFIED CHANNELS // 联系与订阅</p>
            <div className="about-contact-matrix">
              <a
                href={`mailto:${PUBLIC_PROFILE.email}`}
                className="min-h-11 about-contact-cell"
              >
                <span className="about-contact-kind">EMAIL</span>
                <span className="about-contact-val">
                  {PUBLIC_PROFILE.email}
                  <ArrowUpRight aria-hidden size={15} />
                </span>
              </a>
              {links.map((link) => (
                <StudioLink
                  key={`${link.label}-${link.url}`}
                  href={link.url}
                  className="about-contact-cell"
                >
                  <span className="about-contact-kind">CHANNEL</span>
                  <span className="about-contact-val">
                    {link.label}
                    <ArrowUpRight aria-hidden size={15} />
                  </span>
                </StudioLink>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

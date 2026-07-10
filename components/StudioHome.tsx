import Link from 'next/link'
import type { Theme } from '@/lib/appearance'
import type { PostWithTags } from '@/lib/repositories/types'
import type { SiteNavLink } from '@/lib/site'
import type { StudioContent, StudioLab, StudioProject } from '@/lib/studio-content'
import type { Tool } from '@/lib/repositories/tools'
import { selectStudioTools } from '@/lib/studio-home'
import { StudioCardLabel, StudioLink } from '@/components/StudioSection'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'

interface StudioHomeProps {
  content: StudioContent
  posts: PostWithTags[]
  tools: Tool[]
  navLinks: SiteNavLink[]
  initialTheme: Theme
}

function StudioProjectCard({ project }: { project: StudioProject }) {
  return (
    <StudioLink href={project.href}>
      <article className="studio-card studio-project-card h-full">
        <div className="flex items-start justify-between gap-4">
          <StudioCardLabel>PROJECT / {project.id}</StudioCardLabel>
          <span aria-hidden className="studio-card-arrow">↗</span>
        </div>
        <h3 className="studio-card-title mt-8">{project.title}</h3>
        <p className="studio-card-description mt-3">{project.description}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {project.tags.map((tag) => <span key={tag} className="studio-tag">{tag}</span>)}
        </div>
      </article>
    </StudioLink>
  )
}

function StudioLabCard({ lab }: { lab: StudioLab }) {
  return (
    <StudioLink href={lab.href}>
      <article className="studio-lab-row">
        <div>
          <StudioCardLabel>{lab.type.toUpperCase()}</StudioCardLabel>
          <h3 className="mt-2 text-lg font-semibold text-[var(--editor-ink)]">{lab.title}</h3>
        </div>
        <div className="flex items-center gap-5">
          <p className="hidden max-w-md text-sm leading-6 text-[var(--editor-muted)] sm:block">{lab.description}</p>
          <span aria-hidden className="studio-card-arrow">↗</span>
        </div>
      </article>
    </StudioLink>
  )
}

function StudioToolCard({ tool }: { tool: Tool }) {
  return (
    <StudioLink href={tool.url || '/tools'}>
      <article className="studio-card h-full">
        <div className="flex items-start justify-between gap-4">
          <StudioCardLabel>TOOL / {tool.type}</StudioCardLabel>
          <span aria-hidden className="studio-card-arrow">↗</span>
        </div>
        <h3 className="studio-card-title mt-7">{tool.name}</h3>
        {tool.description && <p className="studio-card-description mt-3 line-clamp-3">{tool.description}</p>}
        {tool.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {tool.tags.map((tag) => <span key={tag} className="studio-tag">{tag}</span>)}
          </div>
        )}
      </article>
    </StudioLink>
  )
}

export function StudioHome({ content, posts, tools, navLinks, initialTheme }: StudioHomeProps) {
  const { profile } = content

  return (
    <div className="studio-site min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col">
      <SiteHeader initialTheme={initialTheme} navLinks={navLinks} studioMode />
      <main className="studio-home-main mx-auto w-full max-w-6xl flex-1 px-5 sm:px-8 lg:px-10">
        <section className="studio-hero grid gap-10 border-b border-[var(--editor-line)] py-16 sm:py-24 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20 lg:py-28">
          <div>
            <p className="studio-eyebrow">{profile.eyebrow}</p>
            <h1 className="studio-hero-title mt-5 max-w-4xl">{profile.title}</h1>
            <p className="studio-hero-subtitle mt-6 max-w-2xl">{profile.subtitle}</p>
            <p className="studio-hero-statement mt-6 max-w-xl">{profile.statement}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/work" className="studio-button studio-button-primary">查看作品 <span aria-hidden>↗</span></Link>
              <Link href="/writing" className="studio-button studio-button-secondary">阅读文章 <span aria-hidden>→</span></Link>
            </div>
          </div>
          <aside className="studio-hero-note self-end lg:pb-2">
            <p className="studio-eyebrow">FIELD NOTES / 01</p>
            <p className="mt-5 text-xl leading-8 text-[var(--editor-ink)] sm:text-2xl sm:leading-9">
              “AI 是磨刀石，我是刀。”
            </p>
            <p className="mt-4 text-sm leading-7 text-[var(--editor-muted)]">
              这里记录平台工程、内容自动化和真实交付里的判断，不把漂亮的概念当成完成的工作。
            </p>
          </aside>
        </section>

        <section className="studio-section py-16 sm:py-24">
          <div className="studio-section-heading">
            <p className="studio-eyebrow">CAPABILITIES / 02</p>
            <h2 className="studio-section-title mt-3">我把什么变成系统</h2>
          </div>
          <div className="mt-10 grid gap-px overflow-hidden border border-[var(--editor-line)] bg-[var(--editor-line)] md:grid-cols-3">
            {profile.capabilities.map((capability, index) => (
              <article key={capability.title} className="studio-capability-card bg-[var(--background)] p-6 sm:p-8">
                <span className="studio-index">0{index + 1}</span>
                <h3 className="mt-12 text-xl font-semibold text-[var(--editor-ink)]">{capability.title}</h3>
                <p className="mt-4 text-sm leading-7 text-[var(--editor-muted)]">{capability.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="studio-section border-t border-[var(--editor-line)] py-16 sm:py-24">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="studio-eyebrow">SELECTED WORK / 03</p>
              <h2 className="studio-section-title mt-3">做过的东西</h2>
            </div>
            <Link href="/work" className="studio-inline-link">全部作品 →</Link>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {content.projects.filter((project) => project.visible).map((project) => (
              <StudioProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>

        <section className="studio-section border-t border-[var(--editor-line)] py-16 sm:py-24">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="studio-eyebrow">LAB / 04</p>
              <h2 className="studio-section-title mt-3">正在折腾</h2>
            </div>
            <Link href="/labs" className="studio-inline-link">进入实验室 →</Link>
          </div>
          <div className="mt-8 divide-y divide-[var(--editor-line)] border-y border-[var(--editor-line)]">
            {content.labs.filter((lab) => lab.visible).map((lab) => <StudioLabCard key={lab.id} lab={lab} />)}
          </div>
        </section>

        <section className="studio-section border-t border-[var(--editor-line)] py-16 sm:py-24">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="studio-eyebrow">TOOLBOX / 05</p>
              <h2 className="studio-section-title mt-3">我正在用的东西</h2>
            </div>
            <Link href="/tools" className="studio-inline-link">查看工具箱 →</Link>
          </div>
          {tools.length > 0 ? (
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {selectStudioTools(tools).map((tool) => <StudioToolCard key={tool.id} tool={tool} />)}
            </div>
          ) : (
            <p className="mt-8 border-y border-[var(--editor-line)] py-10 text-sm text-[var(--editor-muted)]">
              工具箱还没有公开内容，登录后台后可以添加第一件工具。
            </p>
          )}
        </section>

        <section className="studio-section border-t border-[var(--editor-line)] py-16 sm:py-24">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="studio-eyebrow">WRITING / 06</p>
              <h2 className="studio-section-title mt-3">最近写的</h2>
            </div>
            <Link href="/writing" className="studio-inline-link">查看全部文章 →</Link>
          </div>
          <div className="mt-8 divide-y divide-[var(--editor-line)] border-y border-[var(--editor-line)]">
            {posts.map((post) => (
              <Link key={post.slug} href={`/${post.slug}`} className="studio-writing-row group">
                <div className="min-w-0">
                  <p className="studio-card-label">{post.category || 'THOUGHTS'}</p>
                  <h3 className="mt-2 truncate text-lg font-semibold text-[var(--editor-ink)] group-hover:text-[var(--editor-accent)]">{post.title}</h3>
                  {post.description && <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--editor-muted)]">{post.description}</p>}
                </div>
                <span aria-hidden className="studio-card-arrow shrink-0">↗</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="studio-contact-section border-t border-[var(--editor-line)] py-16 sm:py-20">
          <p className="studio-eyebrow">KEEP IN TOUCH / 06</p>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-8">
            <h2 className="max-w-2xl text-3xl leading-tight text-[var(--editor-ink)] sm:text-4xl">如果你也在把复杂事变简单，欢迎交流。</h2>
            <div className="flex flex-wrap gap-4">
              {profile.contactLinks.map((link) => <StudioLink key={link.url} href={link.url}>{link.label} ↗</StudioLink>)}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

import Link from 'next/link'
import { ArrowUpRight, ArrowRight } from 'lucide-react'
import type { Theme } from '@/lib/appearance'
import type { PostWithTags } from '@/lib/repositories/types'
import type { SiteNavLink } from '@/lib/site'
import type { StudioContent } from '@/lib/studio-content'
import type { Tool } from '@/lib/repositories/tools'
import type { Prompt } from '@/lib/repositories/prompts'
import { selectStudioTools } from '@/lib/studio-home'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { StudioLink } from './StudioSection'
import { formatDate } from '@/lib/format-date'
interface Props {
  content: StudioContent
  posts: PostWithTags[]
  tools: Tool[]
  prompts: Prompt[]
  navLinks: SiteNavLink[]
  initialTheme: Theme
}
export function StudioHome({ content, posts, tools, prompts, navLinks, initialTheme }: Props) {
  const projects = content.projects.filter((p) => p.visible).slice(0, 3)
  const resources = [
    ...selectStudioTools(tools, 2).map((t) => ({
      title: t.name,
      description: t.description,
      type: '工具',
      href: t.url || '/tools',
    })),
    ...prompts
      .slice(0, 2)
      .map((p) => ({
        title: p.title,
        description: p.description,
        type: '提示词',
        href: '/prompts',
      })),
  ]
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader initialTheme={initialTheme} navLinks={navLinks} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 sm:px-10">
        <section className="grid gap-12 border-b border-[var(--editor-line)] py-16 sm:py-24 lg:grid-cols-[1.6fr_1fr] lg:gap-20">
          <div>
            <p className="brain-kicker">Channing Studio / 思考与实践</p>
            <h1 className="font-serif font-medium mt-7 max-w-3xl text-4xl leading-[1.2] tracking-tight sm:text-5xl lg:text-6xl">
              {content.profile.title}
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-[var(--editor-muted)]">
              {content.profile.statement}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/work" className="min-h-11 min-w-11 brain-button brain-cta">
                查看作品
                <ArrowUpRight size={16} />
              </Link>
              <Link href="/writing" className="min-h-11 min-w-11 brain-secondary">
                阅读文章
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
          <aside className="self-end rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-7">
            <p className="brain-kicker">About the studio</p>
            <p className="font-serif mt-5 text-xl font-medium leading-8">{content.profile.subtitle}</p>
            <div className="mt-7 space-y-3">
              {content.profile.capabilities.slice(0, 3).map((c, i) => (
                <div
                  key={c.title}
                  className="flex gap-4 border-t border-[var(--editor-line)] pt-3 text-sm"
                >
                  <span className="font-mono text-[var(--editor-muted)]">0{i + 1}</span>
                  <span>{c.title}</span>
                </div>
              ))}
            </div>
            <Link href="/about" className="min-h-11 min-w-11 mt-6 inline-block text-sm text-[var(--editor-accent)]">
              更多关于我 →
            </Link>
          </aside>
        </section>
        {projects.length > 0 && (
          <section className="py-14 sm:py-20">
            <div className="flex items-end justify-between">
              <div>
                <p className="brain-kicker">Selected work</p>
                <h2 className="font-serif font-medium mt-3 text-2xl tracking-tight sm:text-3xl">
                  让想法成为实际的东西
                </h2>
              </div>
              <Link href="/work" className="min-h-11 min-w-11 inline-flex items-center text-sm text-[var(--editor-muted)]">
                全部作品 ↗
              </Link>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {projects.map((project, i) => (
                <StudioLink
                  className="min-h-11 min-w-11 group block text-[var(--editor-ink)]"
                  key={project.id}
                  href={project.href}
                >
                  <article className="h-full rounded-2xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-7 sm:p-8">
                    <div className="flex justify-between">
                      <span className="brain-kicker">Project / 0{i + 1}</span>
                      <ArrowUpRight size={20} />
                    </div>
                    <h3 className="font-serif font-medium mt-9 text-xl">{project.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-[var(--editor-muted)]">
                      {project.description}
                    </p>
                    <div className="mt-6 flex flex-wrap gap-2">
                      {project.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-[var(--editor-soft)] px-2 py-1 text-xs text-[var(--editor-muted)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </article>
                </StudioLink>
              ))}
            </div>
          </section>
        )}
        {posts.length > 0 && (
          <section className="border-t border-[var(--editor-line)] py-14 sm:py-20">
            <div className="flex items-end justify-between">
              <div>
                <p className="brain-kicker">Writing & notes</p>
                <h2 className="font-serif font-medium mt-3 text-2xl sm:text-3xl">实践中的记录</h2>
              </div>
              <Link href="/writing" className="min-h-11 min-w-11 inline-flex items-center text-sm text-[var(--editor-muted)]">
                全部文章 ↗
              </Link>
            </div>
            <div className="mt-8 divide-y divide-[var(--editor-line)]">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/${post.slug}`}
                  className="min-h-11 min-w-11 group flex items-start justify-between gap-6 py-6"
                >
                  <div>
                    <p className="mb-2 text-xs text-[var(--editor-muted)]">
                      {formatDate(post.published_at)} · {post.category || '随笔'}
                    </p>
                    <h3 className="font-serif font-medium text-lg group-hover:text-[var(--editor-accent)]">
                      {post.title}
                    </h3>
                    {post.description && (
                      <p className="mt-2 line-clamp-2 max-w-3xl text-sm leading-7 text-[var(--editor-muted)]">
                        {post.description}
                      </p>
                    )}
                  </div>
                  <ArrowUpRight size={20} className="mt-5 shrink-0" />
                </Link>
              ))}
            </div>
          </section>
        )}
        {resources.length > 0 && (
          <section className="border-t border-[var(--editor-line)] py-14 sm:py-20">
            <div className="flex items-end justify-between">
              <div>
                <p className="brain-kicker">Useful things</p>
                <h2 className="font-serif font-medium mt-3 text-2xl sm:text-3xl">值得复用的工具与方法</h2>
              </div>
              <Link href="/tools" className="min-h-11 min-w-11 inline-flex items-center text-sm text-[var(--editor-muted)]">
                资源收藏 ↗
              </Link>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {resources.map((item, i) => (
                <StudioLink
                  className="min-h-11 min-w-11 group block text-[var(--editor-ink)]"
                  key={i}
                  href={item.href}
                >
                  <div className="h-full rounded-xl border border-[var(--editor-line)] bg-[var(--editor-panel)] p-5">
                    <p className="brain-kicker">{item.type}</p>
                    <h3 className="font-serif font-medium mt-4">{item.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--editor-muted)]">
                      {item.description}
                    </p>
                  </div>
                </StudioLink>
              ))}
            </div>
          </section>
        )}
        <section className="flex flex-wrap items-center justify-between gap-6 border-t border-[var(--editor-line)] py-12">
          <p className="font-serif text-lg font-medium">如果你也在把复杂事变简单，欢迎交流。</p>
          <div className="flex gap-5 text-sm text-[var(--editor-accent)]">
            {content.profile.contactLinks.map((link) => (
              <StudioLink key={link.url} href={link.url} className="min-h-11 min-w-11 inline-flex items-center">
                {link.label} ↗
              </StudioLink>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

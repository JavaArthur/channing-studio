import Link from 'next/link'
import { ArrowUpRight, ArrowRight, BookOpen, Braces, MessageSquare } from 'lucide-react'
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
interface Props { content: StudioContent; portfolio: PublicPortfolioProject[]; posts: PostWithTags[]; tools: Tool[]; prompts: Prompt[]; navLinks: SiteNavLink[]; initialTheme: Theme }
export function StudioHome({ content, portfolio, posts, tools, prompts, navLinks, initialTheme }: Props) {
  const projects = portfolio.slice(0, 4)
  const resources = [
    ...selectStudioTools(tools, 3).map(t => ({ title: t.name, description: t.description, type: '工具', href: t.url || '/tools' })),
    ...prompts.slice(0, 2).map(p => ({ title: p.title, description: p.description, type: '提示词', href: `/prompts#prompt-${p.id}` })),
  ].slice(0, 4)
  return <div className="portfolio-site"><SiteHeader navLinks={navLinks} initialTheme={initialTheme} />
    <main className="portfolio-main">
      <section className="portfolio-hero">
        <div className="portfolio-introduction"><span className="intro-line" />{content.profile.subtitle}</div>
        <h1><KeepWords text={content.profile.title} /></h1>
        <div className="portfolio-hero-bottom"><p>{content.profile.statement}</p><div className="portfolio-hero-links"><Link href="/work" className="portfolio-primary">看看我的作品<ArrowUpRight size={18} /></Link><Link href="/about" className="portfolio-text-link">认识 Channing<ArrowRight size={17} /></Link></div></div>
        <div className="portfolio-practice"><span>我在做的事</span>{content.profile.capabilities.map(c => <span key={c.title}>{c.title}</span>)}</div>
      </section>
      {projects.length > 0 && <section className="portfolio-section" aria-labelledby="selected-work"><div className="portfolio-section-heading"><h2 id="selected-work">一些做成的事</h2><Link href="/work">全部作品<ArrowUpRight size={16} /></Link></div>
        <PortfolioIndex projects={projects} compact /></section>}
      {posts.length > 0 && <section className="portfolio-section portfolio-writing" aria-labelledby="selected-writing"><div className="portfolio-section-heading"><div><h2 id="selected-writing">实践，也写下来。</h2><p>关于系统、工具，以及做事过程中的判断。</p></div><Link href="/writing">所有文章<ArrowUpRight size={16} /></Link></div><div className="portfolio-writing-list">{posts.map(post => <Link key={post.slug} href={`/${post.slug}`}><div className="portfolio-writing-meta"><time>{formatDate(post.published_at)}</time><span>{post.category || '随笔'}</span></div><div><h3>{post.title}</h3>{post.description && <p>{post.description}</p>}</div><ArrowUpRight size={20} /></Link>)}</div></section>}
      {resources.length > 0 && <section className="portfolio-section" aria-labelledby="selected-resources"><div className="portfolio-section-heading"><div><h2 id="selected-resources">值得放在手边</h2><p>我选择留下，也愿意分享的工具与方法。</p></div><Link href="/tools">资源收藏<ArrowUpRight size={16} /></Link></div><div className="portfolio-resources">{resources.map((item, i) => <StudioLink href={item.href} className="portfolio-resource" key={`${item.title}-${i}`}><div className="resource-mark">{item.type === '工具' ? <Braces size={21} /> : <MessageSquare size={21} />}</div><div><span>{item.type}</span><h3>{item.title}</h3><p>{item.description}</p></div><ArrowUpRight size={17} /></StudioLink>)}</div></section>}
      <section className="portfolio-signoff"><div className="signoff-monogram">C.</div><div><h2>保持好奇，继续构建。</h2><p>这里是 Channing 的工作室，也是持续更新的实践记录。</p></div><div>{content.profile.contactLinks.slice(0, 3).map(link => <StudioLink href={link.url} key={link.url}>{link.label}<ArrowUpRight size={15} /></StudioLink>)}<Link href="/writing"><BookOpen size={15} />阅读文章</Link></div></section>
    </main><SiteFooter />
  </div>
}

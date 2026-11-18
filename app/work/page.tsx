export const dynamic = 'force-dynamic'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getSiteHeaderData } from '@/lib/site'
import { getPublicPortfolio } from '@/lib/repositories/portfolio'
import { PortfolioIndex } from '@/components/PortfolioIndex'
import { StudioLink, StudioShell } from '@/components/StudioSection'
import { getSiteUrl } from '@/lib/site-config'
import type { Theme } from '@/lib/appearance'
import type { SiteNavLink } from '@/lib/site'
import type { PublicPortfolioProject } from '@/lib/portfolio'
import '@/styles/studio-indexes.css'

export const metadata = {
  title: '开源与实践',
  description: '开源工具、Agent 实验与工程实践项目归档。',
  alternates: { canonical: `${getSiteUrl()}/work` },
}

export default async function WorkPage() {
  let projects: PublicPortfolioProject[] = []
  let navLinks: SiteNavLink[] = []
  let defaultTheme: Theme = 'light'
  try {
    const env = await getAppCloudflareEnv()
    if (env?.DB) {
      const [headerData, portfolio] = await Promise.all([
        getSiteHeaderData(env.DB),
        getPublicPortfolio(env.DB),
      ])
      navLinks = headerData.navLinks
      defaultTheme = headerData.defaultTheme
      projects = portfolio.filter(
        (item) =>
          item.slug !== 'channing-studio' &&
          !/channing[\s-]*studio/i.test(item.title),
      )
    }
  } catch (error) {
    console.error('Projects page: failed to fetch content', error)
  }

  return (
    <StudioShell
      eyebrow="ARCHIVE // 02 · PROJECTS"
      meta={projects.length > 0 ? `${projects.length} PUBLIC PROJECTS` : 'PROJECTS ARCHIVE'}
      className="studio-index-page"
      title="开源与实践项目"
      description="业余时间打磨的开源工具、Agent 应用与工程实验。沿着条目入口，可继续访问线上演示或查阅源码仓库。"
      navLinks={navLinks}
      initialTheme={defaultTheme}
    >
      {projects.length ? (
        <section aria-label="公开项目">
          <div className="index-register">
            <span>PROJECTS CATALOGUE · 项目目录</span>
            <span>{projects.length} 个公开项目</span>
          </div>
          <PortfolioIndex projects={projects} headingLevel={2} />
        </section>
      ) : (
        <div className="studio-empty-state">
          <p>项目正在整理中</p>
          <span>可以先阅读最新技术文章或浏览工具链实验室。</span>
          <div className="public-empty-actions">
            <StudioLink href="/writing">阅读技术文章</StudioLink>
            <StudioLink href="/labs">浏览实验室</StudioLink>
          </div>
        </div>
      )}
    </StudioShell>
  )
}

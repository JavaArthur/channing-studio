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
  title: '作品 · Channing Studio',
  description: 'Channing 的公开工程项目与内容系统案例。',
  alternates: { canonical: `${getSiteUrl()}/work` },
}

export default async function WorkPage() {
  let projects: PublicPortfolioProject[] = []
  let navLinks: SiteNavLink[] = []
  let defaultTheme: Theme = 'light'
  try {
    const env = await getAppCloudflareEnv()
    if (env?.DB) {
      const [headerData, portfolio] = await Promise.all([getSiteHeaderData(env.DB), getPublicPortfolio(env.DB)])
      navLinks = headerData.navLinks
      defaultTheme = headerData.defaultTheme
      projects = portfolio
    }
  } catch (error) {
    console.error('Studio work: failed to fetch content', error)
  }

  return (
    <StudioShell
      eyebrow="WORK / 作品档案"
      className="studio-index-page"
      title="作品与实践"
      description="公开项目的用途、技术选择与当前状态。沿着项目入口，可以继续查看网站或公开源码。"
      navLinks={navLinks}
      initialTheme={defaultTheme}
    >
      {projects.length ? (
        <section aria-label="公开项目">
          <div className="index-register"><span>项目目录</span><span>{projects.length} 个公开项目</span></div>
          <PortfolioIndex projects={projects} headingLevel={2} />
        </section>
      ) : (
        <div className="studio-empty-state">
          <p>作品整理中</p>
          <span>可以先去看看文章和实验室。</span>
          <div className="public-empty-actions"><StudioLink href="/writing">阅读文章</StudioLink><StudioLink href="/labs">浏览实验室</StudioLink></div>
        </div>
      )}
    </StudioShell>
  )
}

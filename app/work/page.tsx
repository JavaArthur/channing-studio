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
      title="把判断变成可以继续运行的东西。"
      description="这些项目都在真实使用：有的每天自动更新，有的只服务家人或少数读者。每一项都写明它在哪里运行。"
      navLinks={navLinks}
      initialTheme={defaultTheme}
    >
      {projects.length ? (
        <PortfolioIndex projects={projects} headingLevel={2} />
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

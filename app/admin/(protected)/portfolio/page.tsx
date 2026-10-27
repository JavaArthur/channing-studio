import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { listPortfolioProjects } from '@/lib/repositories/portfolio'
import { PortfolioManager } from './PortfolioManager'

export const metadata = { title: '项目导航' }
export const dynamic = 'force-dynamic'

export default async function AdminPortfolioPage() {
  const env = await getAppCloudflareEnv()
  if (!env?.DB) throw new Error('数据库未连接')
  const projects = await listPortfolioProjects(env.DB)
  const published = projects.filter((project) => project.published).length
  return (
    <div>
      <header className="workspace-page-heading">
        <div>
          <h1>项目导航</h1>
          <p>
            {projects.length} 个项目 · {published} 个在作品集公开。网址、仓库和本地目录都在这里。
          </p>
        </div>
      </header>
      <PortfolioManager projects={projects} />
    </div>
  )
}

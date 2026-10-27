import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getPublicationSummary } from '@/lib/repositories/library'
import Link from 'next/link'
import { ArrowUpRight, FileText, Layout, Wrench, MessageSquare } from 'lucide-react'
const links = [
  {
    href: '/admin/posts',
    label: '文章与摘录',
    description: '编辑工作稿，确认后发布。',
    Icon: FileText,
  },
  {
    href: '/admin/studio',
    label: '首页与代表作品',
    description: '更新个人介绍、作品与精选文章。',
    Icon: Layout,
  },
  {
    href: '/admin/tools',
    label: '公开工具',
    description: '挑选值得分享的工具，管理公开版本。',
    Icon: Wrench,
  },
  {
    href: '/admin/prompts',
    label: '公开提示词',
    description: '编辑和确认可供访客取用的版本。',
    Icon: MessageSquare,
  },
]
export default async function Page() {
  const env = await getAppCloudflareEnv()
  const stats = env.DB ? await getPublicationSummary(env.DB) : null
  const states: Record<string, string> = {
    '/admin/posts': `${stats?.posts ?? 0} 篇已发布 · ${stats?.drafts ?? 0} 篇草稿`,
    '/admin/tools': `${stats?.tools ?? 0} 件已公开`,
    '/admin/prompts': `${stats?.prompts ?? 0} 条已公开`,
    '/admin/studio': '编辑站点内容',
  }
  return (
    <div>
      <header className="workspace-page-heading">
        <div>
          <div className="workspace-breadcrumb">
            我的 Studio <span>/</span> 对外分享
          </div>
          <h1>公开管理</h1>
          <p>把你选择的成果带到外面。私人资料始终由你决定是否公开。</p>
        </div>
        <Link href="/" target="_blank" className="brain-secondary">
          查看网站
          <ArrowUpRight size={16} />
        </Link>
      </header>
      <div className="publication-grid">
        {links.map(({ href, label, description, Icon }) => (
          <Link href={href} key={href}>
            <Icon size={24} />
            <h2>{label}</h2>
            <div>
              <p>{description}</p>
              <small className="publication-state">{states[href]}</small>
            </div>
            <ArrowUpRight className="publication-arrow" size={19} />
          </Link>
        ))}
      </div>
      <div className="publish-secondary">
        <Link href="/admin/projects">管理历史项目的公开版本</Link>
        <Link href="/admin/categories">文章分类</Link>
      </div>
    </div>
  )
}

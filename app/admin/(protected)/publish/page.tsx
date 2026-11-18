import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getPublicationSummary } from '@/lib/repositories/library'
import Link from 'next/link'
import {
  ArrowUpRight,
  FileText,
  FolderKanban,
  Layout,
  MessageSquare,
  PenLine,
  Tags,
  Wrench,
} from 'lucide-react'

const links = [
  {
    code: '01',
    href: '/admin/posts',
    label: '文章与摘录',
    description: '编辑工作稿，核对元信息与分类，确认后对外发布。',
    Icon: FileText,
  },
  {
    code: '02',
    href: '/admin/portfolio',
    label: '作品集',
    description: '在项目导航里挑选公开系统，确认后同步到公开作品页。',
    Icon: FolderKanban,
  },
  {
    code: '03',
    href: '/admin/studio',
    label: '首页与个人介绍',
    description: '维护公开首屏主张、能力支柱、实验室与精选文章。',
    Icon: Layout,
  },
  {
    code: '04',
    href: '/admin/tools',
    label: '公开工具',
    description: '挑选日常验证过的工程工具，独立维护公开快照。',
    Icon: Wrench,
  },
  {
    code: '05',
    href: '/admin/prompts',
    label: '公开提示词',
    description: '审校并发布可供访客直接复用的提示词标本。',
    Icon: MessageSquare,
  },
]

export default async function Page() {
  const env = await getAppCloudflareEnv()
  const stats = env.DB ? await getPublicationSummary(env.DB).catch(() => null) : null
  const states: Record<string, string> = {
    '/admin/posts': `${stats?.posts ?? 0} 篇已发布 · ${stats?.drafts ?? 0} 篇草稿`,
    '/admin/tools': `${stats?.tools ?? 0} 件已公开`,
    '/admin/prompts': `${stats?.prompts ?? 0} 条已公开`,
    '/admin/portfolio': `${stats?.portfolio ?? 0} 个项目已公开`,
    '/admin/studio': '编辑站点内容',
  }

  const telemetry = [
    {
      code: 'WRITING',
      label: '已发布文章',
      value: stats?.posts ?? 0,
      sub: `${stats?.drafts ?? 0} 篇草稿待审`,
      href: '/admin/posts',
    },
    {
      code: 'SYSTEMS',
      label: '公开作品项目',
      value: stats?.portfolio ?? 0,
      sub: '同步至 /work',
      href: '/admin/portfolio',
    },
    {
      code: 'ARSENAL · TOOLS',
      label: '公开工具收藏',
      value: stats?.tools ?? 0,
      sub: '同步至 /tools',
      href: '/admin/tools',
    },
    {
      code: 'ARSENAL · PROMPTS',
      label: '公开提示词',
      value: stats?.prompts ?? 0,
      sub: '同步至 /prompts',
      href: '/admin/prompts',
    },
  ]

  return (
    <div className="atelier-surface-page publish-hub">
      <header className="workspace-page-heading">
        <div>
          <div className="workspace-breadcrumb">
            我的 Studio <span>/</span> 对外分享
          </div>
          <span className="atelier-eyebrow">
            <span className="atelier-beacon" data-tone="vermilion" aria-hidden="true" />
            PUBLICATION // STUDIO DISPATCH
          </span>
          <h1>公开管理</h1>
          <p>把你选择的成果带到外面。私人资料始终由你显式确认后才生成公开快照。</p>
        </div>
        <div className="publish-header-actions">
          <Link href="/editor?new=1" className="admin-button admin-button-primary atelier-cta-vermilion">
            <PenLine size={15} />
            写新文章
          </Link>
          <Link href="/" target="_blank" className="brain-secondary">
            查看网站
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>

      <section className="publish-telemetry-strip" aria-label="公开内容概览">
        {telemetry.map((item) => (
          <Link key={item.code} href={item.href} className="publish-telemetry-cell">
            <span className="atelier-mono">{item.code}</span>
            <strong className="atelier-mono">{item.value}</strong>
            <div>
              <span>{item.label}</span>
              <small>{item.sub}</small>
            </div>
          </Link>
        ))}
      </section>

      <div className="publication-grid">
        {links.map(({ code, href, label, description, Icon }) => (
          <Link href={href} key={href}>
            <span className="publication-icon-box" aria-hidden="true">
              <Icon size={18} />
            </span>
            <div className="publication-title-col">
              <span className="publication-code atelier-mono">{`${code} //`}</span>
              <h2>{label}</h2>
            </div>
            <div>
              <p>{description}</p>
              <small className="publication-state">
                <span
                  className="atelier-beacon"
                  data-tone={href === '/admin/studio' ? 'vermilion' : 'healthy'}
                  aria-hidden="true"
                />
                {states[href]}
              </small>
            </div>
            <ArrowUpRight className="publication-arrow" size={18} />
          </Link>
        ))}
      </div>

      <div className="publish-secondary">
        <Link href="/admin/categories">
          <Tags size={14} />
          文章分类
        </Link>
      </div>
    </div>
  )
}

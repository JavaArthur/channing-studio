import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getPublicationSummary } from '@/lib/repositories/library'
import { DEFAULT_HOME_MODULES, DEFAULT_STUDIO_CONTENT } from '@/lib/studio-content'
import { getStudioContent } from '@/lib/studio-settings'
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
    href: '/admin/studio',
    label: '博客首页编排 · 可插拔吐出',
    description: '控制首屏精选长文、文章流、项目与百宝箱是否向晨启AI首页吐出，维护个人名片。',
    Icon: Layout,
  },
  {
    code: '02',
    href: '/admin/posts',
    label: '文章与手记',
    description: '编辑私人工作稿，核对分类与摘要，显式确认后发布至晨启AI技术博客。',
    Icon: FileText,
  },
  {
    code: '03',
    href: '/admin/portfolio',
    label: '开源与实践项目',
    description: '在项目导航里挑选愿意对外展示的实践项目，独立生成公开快照。',
    Icon: FolderKanban,
  },
  {
    code: '04',
    href: '/admin/tools',
    label: '百宝箱 · 公开工具',
    description: '挑选日常验证过的工程利器，向博客访客吐出脱敏后的公开版本。',
    Icon: Wrench,
  },
  {
    code: '05',
    href: '/admin/prompts',
    label: '百宝箱 · 公开提示词',
    description: '审校并发布可供读者直接复制复用的工程提示词标本。',
    Icon: MessageSquare,
  },
]

export default async function Page() {
  const env = await getAppCloudflareEnv()
  const [stats, studio] = env.DB
    ? await Promise.all([
        getPublicationSummary(env.DB).catch(() => null),
        getStudioContent(env.DB).catch(() => DEFAULT_STUDIO_CONTENT),
      ])
    : [null, DEFAULT_STUDIO_CONTENT]

  const modules = studio.homeModules ?? DEFAULT_HOME_MODULES
  const activeModules = [
    modules.featuredEssay,
    modules.writing,
    modules.focusAreas,
    modules.projects,
    modules.tools,
    modules.prompts,
  ].filter(Boolean).length

  const states: Record<string, string> = {
    '/admin/studio': `${activeModules} / 6 个首页模块已插拔启用`,
    '/admin/posts': `${stats?.posts ?? 0} 篇已发布 · ${stats?.drafts ?? 0} 篇草稿`,
    '/admin/portfolio': `${stats?.portfolio ?? 0} 个项目已公开${modules.projects ? '' : ' · 首页已拔除'}`,
    '/admin/tools': `${stats?.tools ?? 0} 件已公开${modules.tools ? '' : ' · 首页已拔除'}`,
    '/admin/prompts': `${stats?.prompts ?? 0} 条已公开${modules.prompts ? '' : ' · 首页已拔除'}`,
  }

  const telemetry = [
    {
      code: 'PROJECTION',
      label: '首页启用模块',
      value: `${activeModules}/6`,
      sub: '点击配置可插拔开关',
      href: '/admin/studio',
    },
    {
      code: 'BLOG ESSAYS',
      label: '已发布文章',
      value: String(stats?.posts ?? 0),
      sub: `${stats?.drafts ?? 0} 篇草稿在工作台`,
      href: '/admin/posts',
    },
    {
      code: 'SIDE PROJECTS',
      label: '公开实践项目',
      value: String(stats?.portfolio ?? 0),
      sub: modules.projects ? '首页吐出中 · /work' : '仅保留在 /work',
      href: '/admin/portfolio',
    },
    {
      code: 'TOOLKIT',
      label: '公开工具与提示词',
      value: String((stats?.tools ?? 0) + (stats?.prompts ?? 0)),
      sub:
        modules.tools || modules.prompts ? '首页百宝箱吐出中' : '首页已收起百宝箱',
      href: '/admin/tools',
    },
  ]

  return (
    <div className="atelier-surface-page publish-hub">
      <header className="workspace-page-heading">
        <div>
          <div className="workspace-breadcrumb">
            晨启工作台 <span>/</span> 博客吐出
          </div>
          <span className="atelier-eyebrow">
            <span className="atelier-beacon" data-tone="vermilion" aria-hidden="true" />
            PUBLICATION // BLOG PROJECTION HUB
          </span>
          <h1>晨启AI 公开博客吐出管理</h1>
          <p>
            工作台负责沉淀与审校，「晨启AI」博客仅展示你显式吐出的内容，外部访客对私人工作台零感知。
          </p>
        </div>
        <div className="publish-header-actions">
          <Link
            href="/editor?new=1"
            className="admin-button admin-button-primary atelier-cta-vermilion"
          >
            <PenLine size={15} />
            写新文章
          </Link>
          <Link href="/" target="_blank" className="brain-secondary">
            查看晨启AI博客
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
          文章分类管理
        </Link>
      </div>
    </div>
  )
}

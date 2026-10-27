'use client'
import { useWorkspace } from '@/components/library/WorkspaceState'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { BookOpen, Folder, FolderKanban, Globe, Settings, Sparkles, Link2, Star, CircleHelp } from 'lucide-react'
export function BrainNav({ decisions = 0 }: { decisions?: number }) {
  const { usage } = useWorkspace()
  const path = usePathname()
  const query = useSearchParams()
  const main = [
    { title: '最近阅读', href: '/admin/library?recent=1', Icon: BookOpen, active: query.get('recent') === '1' },
    {
      title: '全部内容',
      href: '/admin/library',
      Icon: BookOpen,
      active:
        path.startsWith('/admin/library') &&
        !query.get('recent') &&
        !query.get('favorite') &&
        !query.get('decisions') &&
        !query.get('collection') &&
        query.get('kind') !== 'inspiration',
    },
    {
      title: '收藏',
      href: '/admin/library?favorite=1',
      Icon: Star,
      active: !!query.get('favorite'),
    },
    {
      title: '运营',
      href: '/admin/operations',
      Icon: Sparkles,
      active: path.startsWith('/admin/operations'),
    },
    {
      title: '项目导航',
      href: '/admin/portfolio',
      Icon: FolderKanban,
      active: path.startsWith('/admin/portfolio'),
    },
    {
      title: '主题资料集',
      href: '/admin/collections',
      Icon: Folder,
      active: path === '/admin/collections' || !!query.get('collection'),
    },
    ...(decisions
      ? [
          {
            title: '待决定',
            href: '/admin/library?decisions=1',
            Icon: CircleHelp,
            active: !!query.get('decisions'),
          },
        ]
      : []),
    {
      title: '公开管理',
      href: '/admin/publish',
      Icon: Globe,
      active: [
        '/admin/publish',
        '/admin/posts',
        '/admin/studio',
        '/admin/tools',
        '/admin/prompts',
        '/admin/categories',
        '/admin/projects',
      ].some((p) => path.startsWith(p)),
    },
  ]
  return (
    <nav aria-label="个人工作空间" className="workspace-nav">
      <div className="workspace-nav-main">
        {[main[1],main[0],...main.slice(2)].map(({ title, href, Icon, active }) => (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}>
            <Icon size={17} />
            <span>{title}</span>
            {title === '待决定' && <span className="workspace-nav-count">{decisions}</span>}
          </Link>
        ))}
        {!!usage.collections.filter(c=>c.pinned).length && <div className="workspace-collection-nav"><span>常用资料集</span>{usage.collections.filter(c=>c.pinned).slice(0,6).map(c=><Link key={c.id} href={`/admin/library?collection=${encodeURIComponent(c.id)}`} aria-current={query.get('collection')===c.id?'page':undefined}><Folder size={15}/><span>{c.title}</span></Link>)}<Link href="/admin/collections">全部资料集</Link></div>}
      </div>
      <div className="workspace-nav-secondary">
        <Link
          href="/admin/connections"
          aria-current={path === '/admin/connections' ? 'page' : undefined}
        >
          <Link2 size={16} />
          连接记录
        </Link>
        <Link
          href="/admin/settings"
          aria-current={path.startsWith('/admin/settings') ? 'page' : undefined}
        >
          <Settings size={16} />
          设置
        </Link>
      </div>
    </nav>
  )
}

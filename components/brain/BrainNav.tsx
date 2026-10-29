'use client'
import { useWorkspace } from '@/components/library/WorkspaceState'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { BookOpen, Folder, FolderKanban, Globe, Settings, Sparkles, Link2, Star, CircleHelp } from 'lucide-react'
export function BrainNav({ decisions = 0 }: { decisions?: number }) {
  const { usage } = useWorkspace()
  const path = usePathname()
  const query = useSearchParams()
  const inLibrary = path === '/admin/library' || path.startsWith('/admin/library/')
  const pinnedCollections = usage.collections.filter((collection) => collection.pinned).slice(0, 6)
  const main = [
    { title: '最近阅读', href: '/admin/library?recent=1', Icon: BookOpen, active: inLibrary && query.get('recent') === '1' },
    {
      title: '全部内容',
      href: '/admin/library',
      Icon: BookOpen,
      active:
        inLibrary &&
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
      active: inLibrary && !!query.get('favorite'),
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
      active: path === '/admin/collections',
    },
    ...(decisions
      ? [
          {
            title: '待决定',
            href: '/admin/library?decisions=1',
            Icon: CircleHelp,
            active: inLibrary && !!query.get('decisions'),
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
    <nav
      aria-label="个人工作空间"
      className="workspace-nav"
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        const link = (event.target as HTMLElement).closest('a')
        const disclosure = event.currentTarget.closest('details')
        if (link && disclosure) disclosure.open = false
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        const disclosure = event.currentTarget.closest('details')
        if (!disclosure?.open) return
        disclosure.open = false
        disclosure.querySelector('summary')?.focus()
        event.preventDefault()
      }}
    >
      <div className="workspace-nav-main">
        {[main[1],main[0],...main.slice(2)].map(({ title, href, Icon, active }) => (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}>
            <Icon size={17} aria-hidden="true" />
            <span>{title}</span>
            {title === '待决定' && <span className="workspace-nav-count">{decisions}</span>}
          </Link>
        ))}
        {pinnedCollections.length > 0 && (
          <div className="workspace-collection-nav">
            <span>常用资料集</span>
            {pinnedCollections.map((collection) => (
              <Link
                key={collection.id}
                href={`/admin/library?collection=${encodeURIComponent(collection.id)}`}
                aria-current={inLibrary && query.get('collection') === collection.id ? 'page' : undefined}
                title={collection.title}
              >
                <Folder size={15} aria-hidden="true" />
                <span>{collection.title}</span>
              </Link>
            ))}
            <Link href="/admin/collections">全部资料集</Link>
          </div>
        )}
      </div>
      <div className="workspace-nav-secondary">
        <Link
          href="/admin/connections"
          aria-current={path === '/admin/connections' ? 'page' : undefined}
        >
          <Link2 size={16} aria-hidden="true" />
          连接记录
        </Link>
        <Link
          href="/admin/settings"
          aria-current={path.startsWith('/admin/settings') ? 'page' : undefined}
        >
          <Settings size={16} aria-hidden="true" />
          设置
        </Link>
      </div>
    </nav>
  )
}

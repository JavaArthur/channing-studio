'use client'

import { useWorkspace } from '@/components/library/WorkspaceState'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  BookOpen,
  CircleHelp,
  Clock3,
  Compass,
  Folder,
  FolderKanban,
  Globe,
  Link2,
  NotebookPen,
  Settings,
  Sparkles,
  Star,
  type LucideIcon,
} from 'lucide-react'

interface NavItem {
  title: string
  href: string
  Icon: LucideIcon
  active: boolean
  badge?: number
}

interface NavSection {
  code: string
  label: string
  items: NavItem[]
}

export function BrainNav({ decisions = 0 }: { decisions?: number }) {
  const { usage } = useWorkspace()
  const path = usePathname()
  const query = useSearchParams()
  const inLibrary = path === '/admin/library' || path.startsWith('/admin/library/')
  const pinnedCollections = usage.collections.filter((collection) => collection.pinned).slice(0, 6)

  const sections: NavSection[] = [
    {
      code: '01',
      label: '控制台',
      items: [
        {
          title: '总控台',
          href: '/admin',
          Icon: Compass,
          active: path === '/admin',
        },
      ],
    },
    {
      code: '02',
      label: '知识与复盘',
      items: [
        {
          title: '学习与复盘',
          href: '/admin/learning',
          Icon: NotebookPen,
          active: path === '/admin/learning',
        },
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
          title: '最近阅读',
          href: '/admin/library?recent=1',
          Icon: Clock3,
          active: inLibrary && query.get('recent') === '1',
        },
        {
          title: '收藏',
          href: '/admin/library?favorite=1',
          Icon: Star,
          active: inLibrary && !!query.get('favorite'),
        },
        {
          title: '待决定',
          href: '/admin/library?decisions=1',
          Icon: CircleHelp,
          active: inLibrary && !!query.get('decisions'),
          badge: decisions > 0 ? decisions : undefined,
        },
      ],
    },
    {
      code: '03',
      label: '协同与项目',
      items: [
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
      ],
    },
    {
      code: '04',
      label: '公开出版',
      items: [
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
            '/admin/x-drafts',
          ].some((prefix) => path.startsWith(prefix)),
        },
      ],
    },
  ]

  const systemItems: NavItem[] = [
    {
      title: '连接与密钥',
      href: '/admin/connections',
      Icon: Link2,
      active: path === '/admin/connections',
    },
    {
      title: '站点设置',
      href: '/admin/settings',
      Icon: Settings,
      active: path.startsWith('/admin/settings'),
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
        {sections.map((section) => (
          <div key={section.code} className="workspace-nav-group">
            <span className="workspace-nav-label">
              <span className="workspace-nav-code">{`${section.code} //`}</span> {section.label}
            </span>
            {section.items.map(({ title, href, Icon, active, badge }) => (
              <Link key={href} href={href} aria-current={active ? 'page' : undefined}>
                <Icon size={15} aria-hidden="true" />
                <span>{title}</span>
                {badge !== undefined && (
                  <span className="workspace-nav-count" data-tone="vermilion">
                    {badge}
                  </span>
                )}
              </Link>
            ))}
            {section.code === '03' && pinnedCollections.length > 0 && (
              <div className="workspace-collection-nav">
                <span>{'PINNED // 常用资料集'}</span>
                {pinnedCollections.map((collection) => (
                  <Link
                    key={collection.id}
                    href={`/admin/library?collection=${encodeURIComponent(collection.id)}`}
                    aria-current={inLibrary && query.get('collection') === collection.id ? 'page' : undefined}
                    title={collection.title}
                  >
                    <Folder size={14} aria-hidden="true" />
                    <span>{collection.title}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="workspace-nav-secondary">
        <span className="workspace-nav-label">
          <span className="workspace-nav-code">{'05 //'}</span> 系统设置
        </span>
        {systemItems.map(({ title, href, Icon, active }) => (
          <Link key={href} href={href} aria-current={active ? 'page' : undefined}>
            <Icon size={15} aria-hidden="true" />
            <span>{title}</span>
          </Link>
        ))}
      </div>
    </nav>
  )
}

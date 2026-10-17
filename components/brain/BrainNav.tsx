'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Home,
  Inbox,
  BookOpen,
  Layers,
  FilePenLine,
  Globe,
  Link2,
  Settings,
  Search,
  Bookmark,
  MessageSquare,
  Tags,
} from 'lucide-react'
const groups = [
  {
    label: '我的工作空间',
    links: [
      ['总览', '/admin', Home],
      ['收件箱', '/admin/inbox', Inbox],
      ['知识笔记', '/admin/notes', BookOpen],
      ['项目', '/admin/projects', Layers],
      ['写作与发布', '/admin/posts', FilePenLine],
    ],
  },
  {
    label: '知识与资源',
    links: [
      ['工具收藏', '/admin/tools', Bookmark],
      ['提示词', '/admin/prompts', MessageSquare],
      ['分类', '/admin/categories', Tags],
    ],
  },
  {
    label: '对外与连接',
    links: [
      ['公开首页', '/admin/studio', Globe],
      ['Hermes 同步', '/admin/connections', Link2],
      ['设置', '/admin/settings', Settings],
    ],
  },
] as const
export function BrainNav() {
  const path = usePathname()
  return (
    <nav aria-label="个人工作空间" className="space-y-7">
      <Link href="/admin/search" className="brain-secondary w-full justify-start">
        <Search size={16} />
        搜索我的内容
      </Link>
      {groups.map((group) => (
        <div key={group.label}>
          <p className="brain-kicker mb-3 px-3">{group.label}</p>
          <div className="space-y-1">
            {group.links.map(([label, href, Icon]) => (
              <Link
                href={href}
                key={href}
                aria-current={path === href ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${path === href ? 'bg-[var(--editor-soft)] font-medium text-[var(--editor-accent)]' : 'text-[var(--editor-muted)] hover:bg-[var(--editor-soft)]'}`}
              >
                <Icon size={17} />
                {label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

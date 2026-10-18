import Link from 'next/link'
import { ArrowUpRight, Plus, FilePenLine, Inbox, Layers, BookOpen } from 'lucide-react'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { getBrainOverview } from '@/lib/repositories/brain'
export const dynamic = 'force-dynamic'
export default async function AdminPage() {
  const env = await getAppCloudflareEnv()
  if (!env.DB) return <p role="alert">数据库未连接，请先检查本地环境。</p>
  const data = await getBrainOverview(env.DB)
  const cards = [
    { label: '待整理', value: data.counts?.inbox, path: '/admin/inbox', Icon: Inbox },
    {
      label: '写作草稿',
      value: data.counts?.drafts,
      path: '/admin/posts?status=draft',
      Icon: FilePenLine,
    },
    { label: '进行中项目', value: data.counts?.projects, path: '/admin/projects', Icon: Layers },
    { label: '知识笔记', value: data.counts?.notes, path: '/admin/notes', Icon: BookOpen },
  ]
  return (
    <div className="space-y-9">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="brain-kicker">Your personal space</p>
          <h1 className="font-serif font-medium mt-3 text-3xl tracking-tight sm:text-4xl">
            从这里，继续你的思考。
          </h1>
          <p className="mt-4 text-[var(--editor-muted)]">
            收集、整理、推进，把值得分享的部分带到外面。
          </p>
        </div>
        <Link className="min-h-11 min-w-11 brain-button brain-cta" href="/admin/inbox">
          <Plus size={16} />
          收集想法
        </Link>
      </header>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cards.map(({ label, value, path, Icon }) => (
          <Link href={path} key={path} className="min-h-11 min-w-11 brain-panel">
            <div className="flex justify-between text-[var(--editor-muted)]">
              <span className="text-sm">{label}</span>
              <Icon size={17} />
            </div>
            <p className="mt-5 text-3xl font-semibold">{value ?? 0}</p>
          </Link>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="brain-panel">
          <div className="flex justify-between">
            <h2 className="font-serif font-medium">继续写作</h2>
            <Link href="/editor?new=1" className="min-h-11 min-w-11 inline-flex items-center text-sm text-[var(--editor-accent)]">
              新建文章 +
            </Link>
          </div>
          <div className="mt-5 divide-y divide-[var(--editor-line)]">
            {data.drafts.map((post) => (
              <Link
                key={post.slug}
                href={`/editor?edit=${encodeURIComponent(post.slug)}`}
                className="min-h-11 min-w-11 flex items-center justify-between gap-4 py-4 text-sm"
              >
                <span>{post.title}</span>
                <ArrowUpRight size={16} />
              </Link>
            ))}
            {data.drafts.length === 0 && (
              <p className="py-8 text-sm text-[var(--editor-muted)]">
                还没有待写的草稿。可以从收件箱中选一条想法开始。
              </p>
            )}
          </div>
        </section>
        <section className="brain-panel">
          <div className="flex justify-between">
            <h2 className="font-serif font-medium">项目下一步</h2>
            <Link href="/admin/projects" className="min-h-11 min-w-11 inline-flex items-center text-sm text-[var(--editor-accent)]">
              全部项目 →
            </Link>
          </div>
          <div className="mt-5 space-y-5">
            {data.projects.map((project) => (
              <Link key={project.id} href="/admin/projects" className="min-h-11 min-w-11 block">
                <p className="font-serif text-sm font-medium">{project.title}</p>
                <p className="mt-2 text-sm text-[var(--editor-muted)]">
                  {project.next_action || '补充下一步行动'}
                </p>
              </Link>
            ))}
            {data.projects.length === 0 && (
              <p className="py-8 text-sm text-[var(--editor-muted)]">
                把正在做的事建成项目，记住接下来的一小步。
              </p>
            )}
          </div>
        </section>
      </div>
      <section className="brain-panel">
        <div className="flex justify-between">
          <h2 className="font-serif font-medium">最近收集</h2>
          <Link href="/admin/inbox" className="min-h-11 min-w-11 inline-flex items-center text-sm text-[var(--editor-accent)]">
            打开收件箱 →
          </Link>
        </div>
        <div className="mt-4 divide-y divide-[var(--editor-line)]">
          {data.recent.map((item) => (
            <Link
              href="/admin/inbox"
              className="min-h-11 min-w-11 flex justify-between gap-4 py-4 text-sm"
              key={item.id}
            >
              <span>{item.title}</span>
              <span className="shrink-0 whitespace-nowrap text-[var(--editor-muted)]">
                {item.status === 'inbox'
                  ? '待整理'
                  : item.status === 'organized'
                    ? '已整理'
                    : '已归档'}
              </span>
            </Link>
          ))}
          {data.recent.length === 0 && (
            <p className="py-6 text-sm text-[var(--editor-muted)]">
              一个链接、一段思考，随时可以先放在这里。
            </p>
          )}
        </div>
      </section>
      <footer className="flex flex-wrap gap-6 text-sm text-[var(--editor-muted)]">
        <Link href="/admin/connections" className="min-h-11 min-w-11 inline-flex items-center">Hermes 同步记录 →</Link>
        <Link href="/admin/studio" className="min-h-11 min-w-11 inline-flex items-center">管理公开首页 →</Link>
        <Link href="/" target="_blank" className="min-h-11 min-w-11 inline-flex items-center">
          查看公开网站 ↗
        </Link>
      </footer>
    </div>
  )
}

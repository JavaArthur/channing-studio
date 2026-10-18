import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { isAdminAuthenticated, COOKIE_NAME } from '@/lib/admin-auth'
import { LogoutButton } from './LogoutButton'
import { BrainNav } from '@/components/brain/BrainNav'
import { ThemeDropdown } from '@/components/ThemeDropdown'
export const metadata = { robots: { index: false, follow: false } }
export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  if (!(await isAdminAuthenticated(token))) redirect('/admin/login')
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--editor-ink)]">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-[var(--editor-line)] bg-[var(--editor-panel)] px-4 py-7 lg:flex">
        <Link href="/admin" className="min-h-11 min-w-11 brand mb-9 px-2">
          <span className="brand-mark">C.</span>我的大脑
        </Link>
        <div
          // -m-1 p-1 scroll-py-1: room for the 4px focus ring inside the scroll container
          // (also when focus scrolls an item into view) without shifting layout.
          className="-m-1 flex-1 scroll-py-1 overflow-y-auto p-1"
        >
          <BrainNav />
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-[var(--editor-line)] pt-5">
          <Link href="/" className="min-h-11 min-w-11 inline-flex items-center text-xs text-[var(--editor-muted)]">
            公开网站 ↗
          </Link>
          <LogoutButton />
        </div>
      </aside>
      <div className="lg:pl-60">
        <header className="flex h-16 items-center justify-between border-b border-[var(--editor-line)] px-5 sm:px-8">
          <Link href="/admin" className="min-h-11 min-w-11 inline-flex items-center text-sm font-medium lg:hidden">
            Channing / 我的大脑
          </Link>
          <span className="hidden text-xs text-[var(--editor-muted)] lg:block">
            PRIVATE WORKSPACE · 仅自己可见
          </span>
          <div className="flex items-center gap-5">
            <Link href="/editor?new=1" className="min-h-11 min-w-11 inline-flex items-center text-sm text-[var(--editor-accent)]">
              写文章 +
            </Link>
            <ThemeDropdown />
          </div>
        </header>
        <details className="border-b border-[var(--editor-line)] bg-[var(--editor-panel)] px-5 py-3 lg:hidden">
          <summary className="min-h-11 min-w-11 cursor-pointer text-sm">工作空间导航</summary>
          <div className="py-5">
            <BrainNav />
            <LogoutButton />
          </div>
        </details>
        <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">{children}</main>
      </div>
    </div>
  )
}

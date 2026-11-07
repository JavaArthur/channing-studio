import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { searchLibrary } from '@/lib/repositories/library'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowUpRight, LockKeyhole, PanelLeft, PenLine } from 'lucide-react'
import { isAdminAuthenticated, COOKIE_NAME } from '@/lib/admin-auth'
import { LogoutButton } from './LogoutButton'
import { WorkspaceState } from '@/components/library/WorkspaceState'
import { DraftScope } from '@/components/library/DraftScope'
import { UnsavedChangesProvider } from '@/components/admin/UnsavedChanges'
import { BrainNav } from '@/components/brain/BrainNav'
import { ThemeDropdown } from '@/components/ThemeDropdown'
export const metadata = { robots: { index: false, follow: false } }
export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  if (!(await isAdminAuthenticated(token))) redirect('/admin/login')
  // Domain-separated digest scopes local drafts without exposing the authentication token.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`studio-private-drafts:v1:${token}`))
  const draftScope = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  const env = await getAppCloudflareEnv()
  // An optional navigation badge must not prevent the page's recoverable error state.
  const decisions = env.DB ? await searchLibrary(env.DB, { decisions: true, limit: 1 }).then((result) => result.total).catch(() => 0) : 0
  return <DraftScope scope={draftScope}><UnsavedChangesProvider><WorkspaceState><div className="workspace-shell">
    <a href="#workspace-content" className="skip-link">跳到主要内容</a>
    <aside className="workspace-sidebar"><Link href="/admin" className="workspace-brand"><span className="brand-mark">C.</span><span>Studio<small>Channing 的私人空间</small></span></Link><BrainNav decisions={decisions} /><div className="workspace-sidebar-footer"><Link href="/">公开网站<ArrowUpRight size={14} /></Link><LogoutButton /></div></aside>
    <div className="workspace-body"><header className="workspace-topbar"><Link href="/admin" className="workspace-mobile-brand"><span className="brand-mark">C.</span>Studio</Link><span className="workspace-private"><LockKeyhole size={13} />仅自己可见</span><div><Link href="/admin/learning?new=learning"><PenLine size={15} />记一条</Link><ThemeDropdown /></div></header>
      <details className="workspace-mobile-nav"><summary><PanelLeft size={17} />工作空间导航</summary><BrainNav decisions={decisions} /><LogoutButton /></details>
      <main id="workspace-content" className="workspace-content">{children}</main>
    </div>
  </div></WorkspaceState></UnsavedChangesProvider></DraftScope>
}

import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { searchLibrary } from '@/lib/repositories/library'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowUpRight, FilePlus2, LockKeyhole, PanelLeft, PenLine } from 'lucide-react'
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
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`studio-private-drafts:v1:${token}`),
  )
  const draftScope = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')

  const env = await getAppCloudflareEnv()
  // An optional navigation badge must not prevent the page's recoverable error state.
  const decisions = env.DB
    ? await searchLibrary(env.DB, { decisions: true, limit: 1 })
        .then((result) => result.total)
        .catch(() => 0)
    : 0

  return (
    <DraftScope scope={draftScope}>
      <UnsavedChangesProvider>
        <WorkspaceState>
          <div className="workspace-shell">
            <a href="#workspace-content" className="skip-link">
              跳到主要内容
            </a>

            <aside className="workspace-sidebar">
              <Link href="/admin" className="workspace-brand">
                <span className="brand-mark" aria-hidden="true">
                  C<span className="brand-slash">/</span>
                </span>
                <span className="workspace-brand-copy">
                  <span className="workspace-brand-title">Channing Atelier</span>
                  <small>PRIVATE WORKBENCH</small>
                </span>
              </Link>

              <div className="workspace-launch-strip" aria-label="快捷新建">
                <Link href="/editor?new=1" className="workspace-launch-btn is-primary">
                  <span aria-hidden="true">+</span>
                  <span>写新文章</span>
                </Link>
                <Link href="/admin/learning?new=learning" className="workspace-launch-btn">
                  <span aria-hidden="true">+</span>
                  <span>记一条复盘</span>
                </Link>
              </div>

              <BrainNav decisions={decisions} />

              <div className="workspace-sidebar-footer">
                <Link href="/" className="workspace-footer-site">
                  <span>公开网站</span>
                  <ArrowUpRight size={13} aria-hidden="true" />
                </Link>
                <LogoutButton />
              </div>
            </aside>

            <div className="workspace-body">
              <header className="workspace-topbar">
                <Link href="/admin" className="workspace-mobile-brand">
                  <span className="brand-mark" aria-hidden="true">
                    C<span className="brand-slash">/</span>
                  </span>
                  <span>Channing Atelier</span>
                </Link>

                <span className="workspace-private">
                  <span className="atelier-beacon" data-tone="healthy" aria-hidden="true" />
                  <LockKeyhole size={12} aria-hidden="true" />
                  <span className="workspace-private-code">PRIVATE VAULT · ENCRYPTED SESSION</span>
                </span>

                <div className="workspace-topbar-actions">
                  <Link href="/editor?new=1" className="workspace-topbar-link workspace-topbar-desktop-only">
                    <FilePlus2 size={13} aria-hidden="true" />
                    <span>写新文章</span>
                  </Link>
                  <Link href="/admin/learning?new=learning" className="workspace-topbar-link">
                    <PenLine size={13} aria-hidden="true" />
                    <span>记一条</span>
                  </Link>
                  <Link href="/" className="workspace-topbar-link workspace-topbar-desktop-only">
                    <span>公开网站</span>
                    <ArrowUpRight size={12} aria-hidden="true" />
                  </Link>
                  <ThemeDropdown />
                </div>
              </header>

              <details className="workspace-mobile-nav">
                <summary>
                  <PanelLeft size={15} aria-hidden="true" />
                  <span>工作空间导航</span>
                </summary>
                <div className="workspace-mobile-drawer">
                  <div className="workspace-launch-strip" aria-label="快捷新建">
                    <Link href="/editor?new=1" className="workspace-launch-btn is-primary">
                      <span aria-hidden="true">+</span>
                      <span>写新文章</span>
                    </Link>
                    <Link href="/admin/learning?new=learning" className="workspace-launch-btn">
                      <span aria-hidden="true">+</span>
                      <span>记一条复盘</span>
                    </Link>
                  </div>
                  <BrainNav decisions={decisions} />
                  <div className="workspace-mobile-footer">
                    <Link href="/" className="workspace-footer-site">
                      <span>公开网站</span>
                      <ArrowUpRight size={13} aria-hidden="true" />
                    </Link>
                    <LogoutButton />
                  </div>
                </div>
              </details>

              <main id="workspace-content" className="workspace-content" tabIndex={-1}>
                {children}
              </main>
            </div>
          </div>
        </WorkspaceState>
      </UnsavedChangesProvider>
    </DraftScope>
  )
}

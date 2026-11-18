'use client'

import { useRouter } from 'next/navigation'
import { useUnsavedChanges } from '@/components/admin/UnsavedChanges'
import { LogOut } from 'lucide-react'
import { Tooltip } from '@/components/Tooltip'
import { clearPrivateDrafts } from '@/components/library/DraftScope'

export function LogoutButton() {
  const router = useRouter()
  const guard = useUnsavedChanges(false, async () => true)

  const handleLogout = async () => {
    const response = await fetch('/api/admin/logout', { method: 'POST' })
    if (!response.ok) return
    try {
      clearPrivateDrafts()
    } catch {}
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <Tooltip label="退出登录">
      <button
        type="button"
        data-admin-logout
        onClick={() => guard(() => void handleLogout())}
        className="workspace-logout-btn"
        aria-label="退出登录"
      >
        <LogOut size={14} aria-hidden="true" />
      </button>
    </Tooltip>
  )
}

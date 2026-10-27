'use client'

import { useRouter } from 'next/navigation'
import { useUnsavedChanges } from '@/components/admin/UnsavedChanges'
import { LogOut } from 'lucide-react'
import { Tooltip } from '@/components/Tooltip'

export function LogoutButton() {
  const router = useRouter()
  const guard = useUnsavedChanges(false, async () => true)

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <Tooltip label="退出登录">
      <button
        type="button"
        data-admin-logout
        onClick={() => guard(() => void handleLogout())}
        className="min-h-11 min-w-11 p-2 rounded-lg text-[var(--editor-muted)] hover:text-[var(--danger)] hover:bg-[var(--editor-soft)] transition-all"
        aria-label="退出登录"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </Tooltip>
  )
}


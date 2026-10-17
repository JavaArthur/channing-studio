'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useAdminSession } from '@/lib/admin-session-client'

// No unpublished content, password or editor payload may cross this boundary.
export function FrontPostAdminBoundary({ slug, children }: { slug: string; children: ReactNode }) {
  const { authenticated } = useAdminSession()
  return (
    <>
      {authenticated && (
        <div className="mb-6 flex justify-end">
          <Link className="brain-secondary" href={`/editor?edit=${encodeURIComponent(slug)}`}>
            编辑文章
          </Link>
        </div>
      )}
      {children}
    </>
  )
}

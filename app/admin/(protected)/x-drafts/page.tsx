import { redirect } from 'next/navigation'
import type { LibraryParams } from '@/components/library/LibraryPage'
export const dynamic = 'force-dynamic'
export default async function Page({ searchParams }: { searchParams: Promise<LibraryParams> }) {
  const params = await searchParams
  const query = new URLSearchParams()
  for (const key of ['account_id', 'status', 'q', 'page', 'item']) {
    if (typeof params[key] === 'string') query.set(key, params[key])
  }
  redirect(`/admin/operations?${query}`)
}

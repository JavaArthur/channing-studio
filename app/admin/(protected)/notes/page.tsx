import { redirect } from 'next/navigation'
import type { LibraryParams } from '@/components/library/LibraryPage'
export const dynamic = 'force-dynamic'
export default async function Page({ searchParams }: { searchParams: Promise<LibraryParams> }) {
  const params = await searchParams
  const query = new URLSearchParams()
  for (const [key,value] of Object.entries(params)) if (typeof value === 'string' && key !== 'status') query.set(key,value)
  query.set('kind','note')
  redirect(`/admin/library?${query}`)
}

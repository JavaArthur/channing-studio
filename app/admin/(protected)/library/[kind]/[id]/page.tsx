import { notFound, redirect } from 'next/navigation'
import { libraryKinds } from '@/lib/library/types'
export default async function Page({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params
  if (!(libraryKinds as readonly string[]).includes(kind) || id.length > 200) notFound()
  if (kind === 'inspiration') redirect(`/admin/operations?item=${encodeURIComponent(id)}`)
  redirect(
    `/admin/library?${kind === 'inspiration' ? 'kind=inspiration&' : ''}item=${encodeURIComponent(`${kind}:${id}`)}`,
  )
}

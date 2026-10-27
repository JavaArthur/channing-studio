import { LibraryPage, type LibraryParams } from '@/components/library/LibraryPage'
export const dynamic = 'force-dynamic'
export const metadata = { title: '资料库 · Studio' }
export default async function Page({ searchParams }: { searchParams: Promise<LibraryParams> }) {
  return <LibraryPage params={await searchParams} />
}

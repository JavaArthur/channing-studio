import { CollectionPage } from '@/components/brain/CollectionPage'
export const dynamic = 'force-dynamic'
export default async function Page({searchParams}: { searchParams: Promise<{q?:string;page?:string;archived?:string}> }) {
  return <CollectionPage kind="projects" params={await searchParams}/>
}

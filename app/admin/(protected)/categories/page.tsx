import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getCategories } from '@/lib/db'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { CategoryManager } from './CategoryManager'

export const metadata = { title: '分类管理' }

export default async function CategoriesPage() {
  const env = await getAppCloudflareEnv()
  let categories: Awaited<ReturnType<typeof getCategories>> = []

  if (env?.DB) {
    try {
      categories = await getCategories(env.DB)
    } catch (error) {
      console.error('Categories fetch error:', error)
    }
  }

  return (
    <div className="atelier-surface-page">
      <header className="workspace-page-heading">
        <div>
          <span className="atelier-eyebrow">TAXONOMY // CATEGORIES</span>
          <h1>分类管理</h1>
          <p>共 {categories.length} 个分类 · 用于公开文章归档与检索。</p>
        </div>
        <Link href="/admin/publish" className="admin-button">
          <ArrowLeft size={14} />
          返回公开管理
        </Link>
      </header>
      <CategoryManager initialCategories={categories} />
    </div>
  )
}

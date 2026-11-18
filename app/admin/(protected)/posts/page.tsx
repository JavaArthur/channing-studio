import { getCategories } from '@/lib/db'
import { getAdminPostPage } from '@/lib/repositories/admin-posts'
import { Pagination } from '@/components/Pagination'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import Link from 'next/link'
import { FilePlus2 } from 'lucide-react'
import { PostRow } from './PostRow'
import { FilterBar } from './FilterBar'

export const metadata = { title: '文章管理' }

export default async function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; category?: string; page?: string }>
}) {
  const params = await searchParams
  const { q, status, category } = params

  const env = await getAppCloudflareEnv()
  if (!env?.DB) throw new Error('数据库未配置')
  const result = await getAdminPostPage(env.DB, {
    q,
    status,
    category,
    page: Number(params.page) || 1,
  })
  const { posts, stats, categories: postCategories } = result
  const dbCategories = (await getCategories(env.DB))
    .map((item) => item.name)
    .filter((name) => name !== '未分类')
  const paginationQuery = new URLSearchParams()
  for (const [key, value] of Object.entries({ q, status, category }))
    if (value) paginationQuery.set(key, value)
  const basePath = `/admin/posts${paginationQuery.size ? `?${paginationQuery}` : ''}`

  return (
    <div className="atelier-surface-page">
      <FilterBar
        currentStatus={status}
        currentCategory={category}
        categories={postCategories}
        initialQuery={q}
        counts={stats}
        resultCount={result.total}
      />

      {posts.length === 0 ? (
        <div className="atelier-dossier atelier-crosshair p-16 text-center">
          <div className="mx-auto max-w-xs">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--editor-line)] bg-[var(--editor-soft)] text-[var(--stone-gray)]">
              <FilePlus2 size={22} />
            </div>
            <p className="mb-1.5 font-medium text-[var(--editor-ink)]">
              {q ? '未找到匹配的文章' : '还没有任何文章'}
            </p>
            <p className="mb-5 text-xs text-[var(--stone-gray)]">
              {q ? '试试其他关键词或切换状态筛选' : '开始创作，将实践洞察整理成工程手稿'}
            </p>
            {!q && (
              <Link
                href="/editor?new=1"
                className="admin-button admin-button-primary atelier-cta-vermilion min-h-11 min-w-11"
              >
                写第一篇文章 →
              </Link>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--editor-line)] bg-[var(--editor-panel)]">
          {/* 表头 */}
          <div className="hidden grid-cols-[54px_1fr_160px_96px_268px] gap-3 border-b border-[var(--editor-line)] bg-[var(--editor-soft)] px-5 py-3 md:grid">
            <span className="atelier-mono text-center text-[11px] font-medium tracking-wider text-[var(--editor-muted)] uppercase">
              状态
            </span>
            <span className="atelier-mono text-[11px] font-medium tracking-wider text-[var(--editor-muted)] uppercase">
              标题与摘要
            </span>
            <span className="atelier-mono text-[11px] font-medium tracking-wider text-[var(--editor-muted)] uppercase">
              分类
            </span>
            <span className="atelier-mono text-center text-[11px] font-medium tracking-wider text-[var(--editor-muted)] uppercase">
              阅读 / 日期
            </span>
            <span className="atelier-mono text-right text-[11px] font-medium tracking-wider text-[var(--editor-muted)] uppercase">
              操作
            </span>
          </div>

          {/* 文章列表 */}
          <div className="divide-y divide-[var(--editor-line)]">
            {posts.map((post) => (
              <PostRow key={post.slug} post={post} categories={dbCategories} />
            ))}
          </div>
        </div>
      )}
      <Pagination currentPage={result.page} totalPages={result.totalPages} basePath={basePath} />
    </div>
  )
}

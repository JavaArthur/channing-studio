import Link from 'next/link'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { searchBrain } from '@/lib/repositories/brain'
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams
  const env = await getAppCloudflareEnv()
  const results = env.DB ? await searchBrain(env.DB, q) : []
  return (
    <div className="space-y-8">
      <h1 className="font-serif font-medium text-3xl">搜索我的内容</h1>
      <form className="flex gap-3">
        <input
          name="q"
          aria-label="搜索我的内容"
          defaultValue={q}
          className="min-h-11 min-w-11 brain-input"
          placeholder="笔记、想法、项目、文章、工具、提示词"
        />
        <button className="min-h-11 min-w-11 brain-button">搜索</button>
      </form>
      <p className="text-sm text-[var(--editor-muted)]">
        仅你可见。{q && `找到 ${results.length} 项（最多显示 60 项）。`}
      </p>
      <div className="space-y-3">
        {results.map((item, i) => (
          <Link key={i} href={item.href} className="min-h-11 min-w-11 brain-panel flex items-center justify-between">
            <span>{item.title}</span>
            <span className="text-xs text-[var(--editor-muted)]">{item.kind}</span>
          </Link>
        ))}
        {q && results.length === 0 && (
          <p className="brain-panel">没有找到匹配内容，试试其他关键词。</p>
        )}
      </div>
    </div>
  )
}

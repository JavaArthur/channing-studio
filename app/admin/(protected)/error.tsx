'use client'
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="brain-panel space-y-4">
      <h1 className="text-xl font-semibold">暂时无法读取工作空间</h1>
      <p className="text-sm text-[var(--editor-muted)]">
        请检查数据库连接和迁移是否完成。你的内容不会因为这次读取失败而被清空。
      </p>
      <button className="brain-button" onClick={reset}>
        重新加载
      </button>
    </div>
  )
}

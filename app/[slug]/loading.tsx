export default function ArticleLoading() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="h-4 w-20 animate-pulse rounded bg-[var(--editor-soft)]" />
        <div className="mt-6 h-12 w-4/5 animate-pulse rounded bg-[var(--editor-soft)]" />
        <div className="mt-4 h-4 w-2/5 animate-pulse rounded bg-[var(--editor-soft)]" />
        <div className="mt-12 space-y-4">
          <div className="h-4 w-full animate-pulse rounded bg-[var(--editor-soft)]" />
          <div className="h-4 w-11/12 animate-pulse rounded bg-[var(--editor-soft)]" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-[var(--editor-soft)]" />
        </div>
      </div>
    </div>
  )
}

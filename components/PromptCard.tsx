import type { Prompt } from '@/lib/repositories/prompts'
import { PromptCopyButton } from '@/components/PromptCopyButton'
import { ArrowUpRight } from 'lucide-react'
import { StudioCardLabel, StudioLink } from '@/components/StudioSection'

export function PromptCard({ prompt }: { prompt: Prompt }) {
  return (
    <article className="studio-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {prompt.category && <StudioCardLabel>{prompt.category}</StudioCardLabel>}
          <h2 className="font-serif font-medium studio-card-title mt-3">{prompt.title}</h2>
        </div>
        <PromptCopyButton prompt={prompt.prompt} />
      </div>
      {prompt.description && <p className="studio-card-description mt-4">{prompt.description}</p>}
      {prompt.tags.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {prompt.tags.map((tag) => <span key={tag} className="studio-tag">{tag}</span>)}
        </div>
      )}
      <details className="mt-6 border-t border-[var(--editor-line)] pt-4">
        <summary className="min-h-11 min-w-11 cursor-pointer text-sm font-semibold text-[var(--editor-accent)]">查看提示词正文</summary>
        <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--editor-ink)] p-4 text-sm leading-7 text-[var(--editor-panel)]">{prompt.prompt}</pre>
      </details>
      {prompt.source_url && (
        <div className="mt-5 text-sm">
          <StudioLink href={prompt.source_url} className="min-h-11 min-w-11 inline-flex items-center">查看来源<ArrowUpRight aria-hidden size={14} /></StudioLink>
        </div>
      )}
    </article>
  )
}

import type { Prompt } from '@/lib/repositories/prompts'
import { PromptCopyButton } from '@/components/PromptCopyButton'
import { ArrowUpRight } from 'lucide-react'
import { StudioCardLabel, StudioLink } from '@/components/StudioSection'

export function PromptCard({ prompt }: { prompt: Prompt }) {
  return (
    <article className="public-prompt-card">
      <div className="public-prompt-heading">
        <div>
          <h2 className="font-serif font-medium studio-card-title">{prompt.title}</h2>
          {prompt.category && <StudioCardLabel>{prompt.category}</StudioCardLabel>}
        </div>
        <PromptCopyButton prompt={prompt.prompt} />
      </div>
      {prompt.description && <p className="studio-card-description mt-4">{prompt.description}</p>}
      {prompt.tags.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {prompt.tags.map((tag) => <span key={tag} className="studio-tag">{tag}</span>)}
        </div>
      )}
      <details className="public-prompt-disclosure">
        <summary className="public-prompt-summary">查看提示词正文</summary>
        <pre className="public-prompt-body" tabIndex={0} aria-label={`${prompt.title}：提示词正文`}>{prompt.prompt}</pre>
      </details>
      {prompt.source_url && (
        <div className="mt-5 text-sm">
          <StudioLink href={prompt.source_url} className="public-text-link">查看来源<ArrowUpRight aria-hidden size={14} /></StudioLink>
        </div>
      )}
    </article>
  )
}

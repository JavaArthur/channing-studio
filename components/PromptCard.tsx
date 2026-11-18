import type { Prompt } from '@/lib/repositories/prompts'
import { PromptCopyButton } from '@/components/PromptCopyButton'
import { ArrowUpRight } from 'lucide-react'
import { StudioCardLabel, StudioLink } from '@/components/StudioSection'

export function PromptCard({ prompt }: { prompt: Prompt }) {
  return (
    <article id={`prompt-${prompt.id}`} className="public-prompt-card">
      <div className="public-prompt-specbar">
        <div className="public-prompt-specmeta">
          <span className="public-prompt-specid">
            SPECIMEN // #{String(prompt.id).padStart(3, '0')}
          </span>
          {prompt.category && <StudioCardLabel>{prompt.category}</StudioCardLabel>}
        </div>
        <PromptCopyButton prompt={prompt.prompt} />
      </div>

      <h2 className="public-prompt-title">{prompt.title}</h2>

      {prompt.description && (
        <p className="studio-card-description">{prompt.description}</p>
      )}

      {prompt.tags.length > 0 && (
        <div className="public-prompt-tags">
          {prompt.tags.map((tag) => (
            <span key={tag} className="studio-tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      <details className="public-prompt-disclosure">
        <summary className="public-prompt-summary">
          <span>查看提示词正文</span>
          <span className="public-prompt-summary-code" aria-hidden="true">
            PROMPT SOURCE
          </span>
        </summary>
        <pre
          className="public-prompt-body"
          tabIndex={0}
          aria-label={`${prompt.title}：提示词正文`}
        >
          {prompt.prompt}
        </pre>
      </details>

      {prompt.source_url && (
        <div className="public-prompt-source">
          <StudioLink href={prompt.source_url} className="public-text-link">
            查看来源
            <ArrowUpRight aria-hidden size={14} />
          </StudioLink>
        </div>
      )}
    </article>
  )
}

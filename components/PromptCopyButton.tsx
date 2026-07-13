'use client'

import { useState } from 'react'

export function PromptCopyButton({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="studio-button studio-button-secondary min-h-10 px-4 text-sm"
      aria-label="复制提示词"
    >
      {copied ? '已复制' : '复制提示词'}
    </button>
  )
}

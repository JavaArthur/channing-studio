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
      className="min-h-11 min-w-11 studio-button studio-button-secondary px-4 text-sm"
      aria-label="复制提示词"
    >
      {copied ? '已复制' : '复制提示词'}
    </button>
  )
}

'use client'

import { useEffect, useId, useRef, useState } from 'react'

export function PromptCopyButton({ prompt }: { prompt: string }) {
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const feedbackId = useId()
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copying = useRef(false)

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current)
  }, [])

  const copy = async () => {
    if (copying.current) return
    copying.current = true
    if (resetTimer.current) clearTimeout(resetTimer.current)
    setStatus('copying')
    try {
      await navigator.clipboard.writeText(prompt)
      setStatus('copied')
      resetTimer.current = setTimeout(() => setStatus('idle'), 1600)
    } catch {
      setStatus('error')
    } finally {
      copying.current = false
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={copy}
        className="min-h-11 min-w-11 studio-button studio-button-secondary px-4 text-sm disabled:cursor-wait disabled:opacity-55"
        disabled={status === 'copying'}
        aria-busy={status === 'copying'}
        aria-describedby={feedbackId}
      >
        {status === 'copying' ? '正在复制…' : status === 'copied' ? '已复制' : status === 'error' ? '重新复制' : '复制提示词'}
      </button>
      <span
        id={feedbackId}
        role="status"
        aria-atomic="true"
        className={status === 'error' ? 'text-sm text-[var(--danger)]' : 'sr-only'}
      >
        {status === 'error'
          ? '无法访问剪贴板，请重试或手动选择正文复制。'
          : status === 'copied' ? '提示词已复制到剪贴板。' : ''}
      </span>
    </span>
  )
}

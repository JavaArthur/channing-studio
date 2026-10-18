'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
export function ResourceWithdrawal({ kind, id }: { kind: 'tools' | 'prompts'; id: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function withdraw() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/admin/resources/${kind}/${id}/publication`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publish: false }),
      })
      if (!response.ok) throw new Error('撤回失败，请重试')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : '撤回失败')
    } finally {
      setBusy(false)
    }
  }
  return (
    <span>
      <button
        disabled={busy}
        onClick={() => void withdraw()}
        className="min-h-11 min-w-11 text-xs text-[var(--editor-accent)]"
      >
        {busy ? '撤回中…' : '撤回公开'}
      </button>
      {error && (
        <span role="alert" className="ml-2 text-xs">
          {error}
        </span>
      )}
    </span>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Button, Input, Menu, Modal } from '@/components/admin/ui'
import { useUnsavedChanges } from '@/components/admin/UnsavedChanges'
import { useToast } from '@/components/Toast'

interface Token {
  id: number
  name: string
  token_preview: string
  created_at: number
  last_used_at: number | null
  is_active: number
}

interface TokensResponse {
  tokens: Token[]
}

interface CreateTokenResponse {
  token: string
}

export function ApiTokensManager() {
  const [tokens, setTokens] = useState<Token[]>([])
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newToken, setNewToken] = useState<string | null>(null)
  const toast = useToast()

  const loadTokens = async () => {
    try {
      const res = await fetch('/api/admin/tokens')
      if (res.ok) {
        const data = (await res.json()) as TokensResponse
        setTokens(data.tokens)
      }
    } catch {}
  }

  useEffect(() => { loadTokens() }, [])

  const createToken = async () => {
    if (!newName.trim()) return false
    setCreating(true)
    try {
      const res = await fetch('/api/admin/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (!res.ok) throw new Error('创建失败')
      const data = (await res.json()) as CreateTokenResponse
      setNewToken(data.token)
      setNewName('')
      toast.success('Token 已创建')
      loadTokens()
      return true
    } catch {
      toast.error('创建 Token 失败')
      return false
    } finally {
      setCreating(false)
    }
  }

  const guard = useUnsavedChanges(open && !!newName.trim(), async () => { if(await createToken()) throw new Error('Token 已生成，请选择继续编辑，复制保存后再离开。'); return false }, () => setNewName(''))

  const deleteToken = async (id: number, name: string) => {
    if (!confirm(`确定删除 Token "${name}"？`)) return
    try {
      const res = await fetch('/api/admin/tokens', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('删除失败')
      toast.success('Token 已删除')
      loadTokens()
    } catch {
      toast.error('删除失败')
    }
  }

  const copyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token)
      toast.success('已复制到剪贴板')
    } catch {
      toast.error('复制失败')
    }
  }

  const formatDate = (ts: number | null) => {
    if (!ts) return '从未'
    return new Date(ts * 1000).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Shanghai',
    })
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--editor-muted)]">
        API Token 用于 Obsidian 插件、Chrome 插件、Claude Skill 等外部工具发布文章。
      </p>

      <div className="flex justify-between items-center"><h3>访问 Token</h3><Button variant="primary" onClick={() => setOpen(true)}>新增 Token</Button></div>
      <Modal open={open} onOpenChange={value => value ? setOpen(true) : guard(() => setOpen(false))} title="新增 Token" sheet><div className="admin-form">
        {newToken ? <><p>Token 只显示一次，请复制保存。</p><code className="break-all">{newToken}</code><Button onClick={() => copyToken(newToken)}>复制 Token</Button><Button onClick={() => { setNewToken(null); setOpen(false) }}>我已保存</Button></> : <form className="admin-form" onSubmit={e => { e.preventDefault(); void createToken() }}><label>用途名称<Input value={newName} onChange={e => setNewName(e.target.value)} required placeholder="例如：Obsidian 发布" /></label><Button type="submit" variant="primary" disabled={creating || !newName.trim()}>{creating ? '创建中…' : '生成 Token'}</Button></form>}
      </div></Modal>

      {/* Token 列表 */}
      {tokens.length === 0 ? (
        <p className="text-sm text-[var(--stone-gray)] text-center py-8">
          暂无 API Token
        </p>
      ) : (
        <div className="space-y-2">
          {tokens.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between px-4 py-3 bg-[var(--editor-panel)] border border-[var(--editor-line)] rounded-lg"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--editor-ink)]">
                    {t.name}
                  </span>
                  <code className="text-xs text-[var(--stone-gray)] font-mono">
                    {t.token_preview}
                  </code>
                </div>
                <div className="text-xs text-[var(--stone-gray)] mt-0.5">
                  创建于 {formatDate(t.created_at)} · 最后使用 {formatDate(t.last_used_at)}
                </div>
              </div>
              <Menu label={`${t.name}的操作`} items={[{ label: '删除 Token', danger: true, onSelect: () => void deleteToken(t.id, t.name) }]} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

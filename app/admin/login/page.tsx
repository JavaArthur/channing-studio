'use client'

import Link from 'next/link'
import { isSafeLink } from '@/lib/url'
import { Suspense, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function AdminLoginForm() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const data = await res.json().catch(() => null) as { error?: string } | null

      if (res.ok) {
        const redirectTo = searchParams.get('redirect_to') || '/admin'
        // 安全检查：只允许跳转到本站路径
        const safePath = redirectTo.startsWith('/') && isSafeLink(redirectTo) ? redirectTo : '/admin'
        router.push(safePath)
        router.refresh()
      } else {
        setError(
          typeof data?.error === 'string'
            ? data.error
            : res.status === 401
              ? '密码错误，请重试'
              : '登录服务暂不可用，请稍后重试'
        )
      }
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--editor-app-bg)] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--editor-accent)] text-[var(--editor-accent-ink)] text-xl font-bold mb-4">
              C
            </div>
          <h1 className="font-serif font-medium text-2xl text-[var(--editor-ink)]">Channing Studio</h1>
          <p className="text-sm text-[var(--editor-muted)] mt-1">我的大脑</p>
        </div>

        {/* 登录表单 */}
        <div className="bg-[var(--editor-panel)] rounded-2xl border border-[var(--editor-line)] shadow-whisper p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[var(--editor-ink)] mb-2"
              >
                管理密码
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError('')
                }}
                placeholder="请输入管理密码"
                autoFocus
                autoComplete="current-password"
                className="min-h-11 min-w-11 w-full border border-[var(--editor-line)] rounded-lg px-3.5 py-2.5 text-sm text-[var(--editor-ink)] bg-[var(--editor-app-bg)] outline-none transition focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]/10 placeholder:text-[var(--editor-muted)]"
              />
            </div>

            {error && (
              <p className="text-sm text-[var(--danger)] bg-[var(--danger-soft-bg)] border border-[var(--danger-line)] rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="min-h-11 min-w-11 w-full bg-cta text-cta-ink rounded-lg py-2.5 text-sm font-semibold hover:bg-cta-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '登录中…' : '登录'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-xs text-[var(--editor-muted)]">
          <Link href="/" className="min-h-11 min-w-11 inline-flex items-center hover:text-[var(--editor-ink)] transition-colors">
            ← 返回公开首页
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function AdminLogin() {
  return (
    <Suspense fallback={null}>
      <AdminLoginForm />
    </Suspense>
  )
}

'use client'

import Link from 'next/link'
import { isSafeLink } from '@/lib/url'
import { Suspense, useRef, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function AdminLoginForm() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [loading, setLoading] = useState(false)
  const passwordInput = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (!password) {
      setInvalid(true)
      setError('请输入管理密码后再登录。')
      passwordInput.current?.focus()
      return
    }

    setLoading(true)
    setError('')
    setInvalid(false)

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
        setInvalid(res.status === 401)
        setError(
          typeof data?.error === 'string'
            ? data.error
            : res.status === 401
              ? '密码错误，请重试'
              : '登录服务暂不可用，请稍后重试'
        )
        passwordInput.current?.focus()
      }
    } catch {
      setError('网络连接失败，请检查连接后重试。')
      passwordInput.current?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="studio-login min-h-dvh bg-[var(--editor-app-bg)] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-left mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--editor-accent)] text-[var(--editor-accent-ink)] text-xl font-bold mb-4">
              C
            </div>
          <h1 className="font-serif font-medium text-2xl text-[var(--editor-ink)]">Channing Studio</h1>
          <p className="text-sm text-[var(--editor-muted)] mt-1">登录私人资料库</p>
        </div>

        {/* 登录表单 */}
        <div className="bg-[var(--editor-panel)] rounded-xl border border-[var(--editor-line)] p-6">
          <form onSubmit={handleSubmit} className="space-y-5" aria-busy={loading} noValidate>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[var(--editor-ink)] mb-2"
              >
                管理密码
              </label>
              <input
                ref={passwordInput}
                id="password"
                name="password"
                required
                readOnly={loading}
                aria-invalid={invalid || undefined}
                aria-describedby="login-feedback"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError('')
                  if (invalid) setInvalid(false)
                }}
                placeholder="请输入管理密码"
                autoFocus
                autoComplete="current-password"
                className="min-h-11 min-w-11 w-full border border-[var(--editor-line)] rounded-lg px-3.5 py-2.5 text-base text-[var(--editor-ink)] bg-[var(--editor-app-bg)] outline-none transition focus:border-[var(--focus-ring)] focus:ring-2 focus:ring-[var(--focus-ring)]/10 placeholder:text-[var(--editor-muted)]"
              />
            </div>

            <p
              id="login-feedback"
              role={error ? 'alert' : 'status'}
              className={`studio-login-feedback text-sm ${error ? 'text-[var(--danger)]' : 'text-[var(--editor-muted)]'}`}
            >
              {error || (loading ? '正在验证，请稍候…' : '使用管理密码进入私人工作空间。')}
            </p>

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="min-h-11 min-w-11 w-full bg-cta text-cta-ink rounded-md py-2.5 text-sm font-semibold hover:bg-cta-hover transition disabled:bg-cta-disabled disabled:text-cta-disabled-ink disabled:cursor-not-allowed"
            >
              {loading ? '正在进入…' : '进入我的 Studio'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm text-[var(--editor-muted)]">
          <Link href="/" className="min-h-11 min-w-11 inline-flex items-center hover:text-[var(--editor-ink)] transition-colors">
            返回公开首页
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

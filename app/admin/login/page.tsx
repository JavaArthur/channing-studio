'use client'

import Link from 'next/link'
import { isSafeLink } from '@/lib/url'
import { Suspense, useRef, useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react'
import { ThemeDropdown } from '@/components/ThemeDropdown'

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

      const data = (await res.json().catch(() => null)) as { error?: string } | null

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
              : '登录服务暂不可用，请稍后重试',
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

  const beaconTone = error ? 'alert' : loading ? 'warning' : 'healthy'

  return (
    <div className="studio-login">
      <div className="vault-topbar">
        <span className="atelier-kicker">
          <span className="atelier-beacon" data-tone={beaconTone} aria-hidden="true" />
          <span>PRIVATE WORKBENCH // 仅自己可见</span>
        </span>
        <ThemeDropdown />
      </div>

      <div className="vault-stage">
        <div className="vault-dossier atelier-crosshair">
          <header className="vault-header">
            <div className="vault-identity">
              <span className="vault-monogram" aria-hidden="true">
                晨<span>/</span>
              </span>
              <div>
                <span className="vault-kicker">ACCESS GATE // 私人空间</span>
                <h1>晨启 · 私人工作台</h1>
              </div>
            </div>
            <p className="vault-subtitle">个人写作手稿、知识复盘与晨启AI博客内容编排空间</p>
          </header>

          <div className="vault-telemetry" aria-hidden="true">
            <span>
              <ShieldCheck size={12} />
              HMAC SESSION
            </span>
            <span>SCOPE: /ADMIN</span>
            <span>NOINDEX</span>
          </div>

          <form onSubmit={handleSubmit} className="vault-form" aria-busy={loading} noValidate>
            <div className="vault-field">
              <label htmlFor="password">管理密码</label>
              <div className="vault-input-wrap">
                <LockKeyhole size={15} className="vault-input-icon" aria-hidden="true" />
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
                  placeholder="输入私人工作台访问密钥"
                  autoFocus
                  autoComplete="current-password"
                  className="vault-input"
                />
              </div>
            </div>

            <p
              id="login-feedback"
              role={error ? 'alert' : 'status'}
              className={`studio-login-feedback ${error ? 'is-error' : ''}`}
            >
              {error || (loading ? '正在验证访问密钥，请稍候…' : '验证通过后将建立加密管理会话。')}
            </p>

            <button type="submit" disabled={loading} aria-busy={loading} className="vault-submit">
              <span>{loading ? '正在验证…' : '进入私人工作台'}</span>
              <ArrowRight size={15} aria-hidden="true" />
            </button>
          </form>

          <footer className="vault-footer">
            <Link href="/" className="vault-back-link">
              <ArrowLeft size={13} aria-hidden="true" />
              <span>返回晨启AI博客</span>
            </Link>
            <span className="vault-stamp">PRIVATE VAULT · V2</span>
          </footer>
        </div>
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

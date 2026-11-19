import { NextRequest, NextResponse } from 'next/server'
import {
  verifyPassword,
  getSessionToken,
  COOKIE_NAME,
  COOKIE_MAX_AGE,
  getAdminAuthConfigError,
} from '@/lib/admin-auth'
import { getAppCloudflareEnv } from '@/lib/cloudflare'
import { checkLoginRateLimit, recordFailedLogin, cleanupOldAttempts } from '@/lib/rate-limit'

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  try {
    const configError = await getAdminAuthConfigError()
    if (configError) {
      return NextResponse.json({ error: configError }, { status: 503 })
    }

    const env = await getAppCloudflareEnv()
    const db = env.DB!
    const ip = getClientIp(req)

    // 限速检查
    const { allowed, retryAfter } = await checkLoginRateLimit(db, ip)
    if (!allowed) {
      return NextResponse.json(
        { error: '登录尝试过多，请5分钟后重试' },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      )
    }

    const { password } = (await req.json()) as { password?: string }

    if (!password || !(await verifyPassword(password))) {
      await recordFailedLogin(db, ip)
      // 顺带清理过期记录（非阻塞）
      cleanupOldAttempts(db).catch(() => {})
      return NextResponse.json({ error: '密码错误' }, { status: 401 })
    }

    const token = await getSessionToken()
    if (!token) {
      return NextResponse.json({ error: '管理员鉴权初始化失败，请检查环境变量配置' }, { status: 503 })
    }
    const response = NextResponse.json({ success: true })

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      path: '/',
      maxAge: COOKIE_MAX_AGE,
      sameSite: 'lax',
    })

    // Lightweight non-HttpOnly UI hint so anonymous public visitors skip /api/admin/session fetches.
    response.cookies.set('studio_admin_hint', '1', {
      httpOnly: false,
      secure: true,
      path: '/',
      maxAge: COOKIE_MAX_AGE,
      sameSite: 'lax',
    })

    return response
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 })
  }
}

import { NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/admin-auth'

const ADMIN_HINT_COOKIE = 'studio_admin_hint'

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' })
  response.cookies.set(ADMIN_HINT_COOKIE, '', { maxAge: 0, path: '/' })
  return response
}


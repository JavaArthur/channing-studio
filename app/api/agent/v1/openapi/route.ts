import { NextResponse } from 'next/server'
import specification from '@/docs/api/gorkbot-workspace.openapi.json'

// Public interface metadata only. Credentials and workspace contents are never included.
export function GET() {
  return NextResponse.json(specification, {
    headers: { 'Cache-Control': 'public, max-age=300', 'X-Content-Type-Options': 'nosniff' },
  })
}

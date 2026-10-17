import { NextResponse } from 'next/server'
// Compatibility response for older clients; appearance is now a local color preference.
export async function GET() {
  return NextResponse.json({ font: '' })
}

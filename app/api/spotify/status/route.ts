import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const hasToken = cookieStore.has('spotify_refresh_token')
  return NextResponse.json({ connected: hasToken })
}

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const hasAccessToken = cookieStore.has('spotify_access_token')
  const hasRefreshToken = cookieStore.has('spotify_refresh_token')
  
  console.log('Spotify Status Check:', {
    hasAccessToken,
    hasRefreshToken,
    allCookies: cookieStore.getAll().map(c => c.name)
  })

  return NextResponse.json({
    connected: hasAccessToken || hasRefreshToken
  })
}
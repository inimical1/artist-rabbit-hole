import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const hasAccessToken = cookieStore.has('spotify_access_token')
  const hasRefreshToken = cookieStore.has('spotify_refresh_token')
  
  // Log cookies for debugging (server-side console)
  console.log('Spotify Status Check - Cookies present:', {
    hasAccessToken,
    hasRefreshToken,
    cookieCount: (await cookieStore).getAll().length
  })

  // We consider it connected if we have at least a refresh token 
  // (since the access token can be refreshed)
  return NextResponse.json({ 
    connected: hasAccessToken || hasRefreshToken 
  })
}

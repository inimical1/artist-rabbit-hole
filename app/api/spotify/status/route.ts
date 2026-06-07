import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get('spotify_access_token')?.value
  const refreshToken = cookieStore.get('spotify_refresh_token')?.value
  
  console.log('Spotify Status Check:', {
    hasAccessToken: !!accessToken,
    accessTokenPrefix: accessToken ? accessToken.substring(0, 10) + '...' : 'none',
    hasRefreshToken: !!refreshToken,
    refreshTokenPrefix: refreshToken ? refreshToken.substring(0, 10) + '...' : 'none',
    allCookieNames: cookieStore.getAll().map(c => c.name)
  })

  return NextResponse.json({
    connected: !!(accessToken || refreshToken),
    hasAccessToken: !!accessToken,
    hasRefreshToken: !!refreshToken
  })
}
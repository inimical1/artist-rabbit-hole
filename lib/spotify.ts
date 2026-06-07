import { cookies } from 'next/headers'

export async function getSpotifyAccessToken() {
  const cookieStore = await cookies()
  let accessToken = cookieStore.get('spotify_access_token')?.value
  const refreshToken = cookieStore.get('spotify_refresh_token')?.value

  if (!accessToken && refreshToken) {
    accessToken = await refreshSpotifyToken(refreshToken)
  }

  return accessToken
}

async function refreshSpotifyToken(refreshToken: string) {
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    const text = await response.text()
    console.log("SPOTIFY RAW RESPONSE (token refresh):", text)

    if (!response.ok) {
      console.error('Spotify token refresh error status:', response.status)
      return null
    }

    const tokens = JSON.parse(text)

    if (tokens.error) {
      console.error('Spotify token refresh error:', tokens.error)
      return null
    }

    const cookieStore = await cookies()
    cookieStore.set('spotify_access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expires_in,
    })

    return tokens.access_token
  } catch (error) {
    console.error('Spotify token refresh failed:', error)
    return null
  }
}

export async function getSpotifyArtistImage(name: string): Promise<string | null> {
  const accessToken = await getSpotifyAccessToken()
  if (!accessToken) return null

  try {
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=1`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const text = await response.text()
    console.log("SPOTIFY RAW RESPONSE (artist image):", text)

    if (!response.ok) {
      console.error('Spotify artist image error status:', response.status)
      return null
    }

    const data = JSON.parse(text)
    if (data.error || !data.artists?.items?.length) return null

    return data.artists.items[0].images[0]?.url || null
  } catch (error) {
    console.error('Spotify artist image fetch error:', error)
    return null
  }
}

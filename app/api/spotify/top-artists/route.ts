import { NextResponse } from 'next/server'
import { getSpotifyAccessToken } from '@/lib/spotify'

export async function GET() {
  const accessToken = await getSpotifyAccessToken()
  console.log("DEBUG: SPOTIFY TOP ARTISTS - TOKEN EXISTS:", !!accessToken)

  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated with Spotify' }, { status: 401 })
  }

  try {
    // Get user details for logging
    const meRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    if (meRes.ok) {
      const meText = await meRes.text()
      console.log("SPOTIFY RAW RESPONSE (me):", meText)
      const meData = JSON.parse(meText)
      console.log("DEBUG: SPOTIFY USER:", { email: meData.email, id: meData.id })
    } else {
      const meErrorText = await meRes.text()
      console.log("DEBUG: FAILED TO FETCH USER INFO", meRes.status, meErrorText)
    }

    const endpoint = 'https://api.spotify.com/v1/me/top/artists?limit=10&time_range=medium_term'
    console.log("DEBUG: CALLING SPOTIFY ENDPOINT:", endpoint)

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const text = await response.text()
    console.log("SPOTIFY RAW RESPONSE:", text)
    console.log("SPOTIFY STATUS:", response.status)

    if (response.status === 403 || response.status === 401) {
      console.log("DEBUG: Access denied or unauthorized. Clearing tokens.");
      const cookieStore = await cookies()
      cookieStore.delete('spotify_access_token')
      cookieStore.delete('spotify_refresh_token')
      return NextResponse.json(
        { error: 'Spotify session expired or access denied. Please reconnect.', needsReconnect: true },
        { status: response.status }
      )
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error: text,
          status: response.status
        },
        { status: response.status }
      )
    }

    const data = JSON.parse(text)
    
    const artists = data.items.map((artist: any) => ({
      name: artist.name,
      image: artist.images[0]?.url,
    }))

    return NextResponse.json(artists)
  } catch (error: any) {
    console.error('Top artists fetch error:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch top artists' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { getSpotifyAccessToken } from '@/lib/spotify'

export async function GET() {
  const accessToken = await getSpotifyAccessToken()
  console.log("DEBUG: SPOTIFY TOP ARTISTS - TOKEN EXISTS:", !!accessToken)

  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated with Spotify' }, { status: 401 })
  }

  try {
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
      try {
        const cookieStore = await cookies()
        cookieStore.delete('spotify_access_token')
        cookieStore.delete('spotify_refresh_token')
      } catch (e) {
        console.error("Failed to delete cookies:", e)
      }
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
    
    if (!data.items || !Array.isArray(data.items)) {
      console.error("Spotify API returned unexpected data structure:", data)
      return NextResponse.json([], { status: 200 }) // Return empty array instead of failing
    }

    const artists = data.items.map((artist: any) => ({
      name: artist.name,
      image: artist.images && artist.images.length > 0 ? artist.images[0].url : null,
    }))

    return NextResponse.json(artists)
  } catch (error: any) {
    console.error('Top artists fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch top artists' }, { status: 500 })
  }
}

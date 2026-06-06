import { NextResponse } from 'next/server'
import { getSpotifyAccessToken } from '@/lib/spotify'

export async function GET() {
  const accessToken = await getSpotifyAccessToken()

  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated with Spotify' }, { status: 401 })
  }

  try {
    const response = await fetch('https://api.spotify.com/v1/me/top/artists?limit=10&time_range=medium_term', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const data = await response.json()
    
    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: data.error.status })
    }

    const artists = data.items.map((artist: any) => ({
      name: artist.name,
      image: artist.images[0]?.url,
    }))

    return NextResponse.json(artists)
  } catch (error) {
    console.error('Top artists fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch top artists' }, { status: 500 })
  }
}

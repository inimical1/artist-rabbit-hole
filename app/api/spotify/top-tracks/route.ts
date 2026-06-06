import { NextResponse } from 'next/server'
import { getSpotifyAccessToken } from '@/lib/spotify'

export async function GET() {
  const accessToken = await getSpotifyAccessToken()

  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated with Spotify' }, { status: 401 })
  }

  try {
    const response = await fetch('https://api.spotify.com/v1/me/top/tracks?limit=10', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const data = await response.json()

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: data.error.status })
    }

    const tracks = data.items.map((track: any) => ({
      name: track.name,
      artist: track.artists[0].name,
      albumArt: track.album.images[0]?.url,
    }))

    return NextResponse.json(tracks)
  } catch (error) {
    console.error('Top tracks fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch top tracks' }, { status: 500 })
  }
}

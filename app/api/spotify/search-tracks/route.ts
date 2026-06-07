import { NextResponse } from 'next/server'
import { getSpotifyAccessToken } from '@/lib/spotify'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 })
  }

  const token = await getSpotifyAccessToken()

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json({ error: errorData.error.message }, { status: response.status })
    }

    const data = await response.json()
    const tracks = data.tracks.items.map((track: any) => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map((a: any) => a.name).join(', '),
      albumArt: track.album.images[0]?.url,
      uri: track.uri,
      previewUrl: track.preview_url,
      durationMs: track.duration_ms
    }))

    return NextResponse.json(tracks)
  } catch (error: any) {
    console.error('Spotify search error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

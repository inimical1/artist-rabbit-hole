import { NextResponse } from 'next/server'
import { getSpotifyAccessToken } from '@/lib/spotify'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 })
  }

  const accessToken = await getSpotifyAccessToken()

  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated with Spotify' }, { status: 401 })
  }

  try {
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    const text = await response.text()
    console.log("SPOTIFY RAW RESPONSE (search):", text)

    if (!response.ok) {
      return NextResponse.json(
        { error: text, status: response.status },
        { status: response.status }
      )
    }

    const data = JSON.parse(text)

    if (data.error) {
      return NextResponse.json({ error: data.error.message }, { status: data.error.status })
    }

    const tracks = data.tracks.items.map((track: any) => ({
      id: track.id,
      name: track.name,
      artist: track.artists[0].name,
      uri: track.uri,
      albumArt: track.album.images[0]?.url,
    }))

    return NextResponse.json(tracks)
  } catch (error) {
    console.error('Spotify search error:', error)
    return NextResponse.json({ error: 'Failed to search Spotify' }, { status: 500 })
  }
}

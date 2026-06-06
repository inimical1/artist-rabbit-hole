import { NextResponse } from 'next/server'
import { getSpotifyAccessToken } from '@/lib/spotify'

const MUSICBRAINZ_USER_AGENT = 'ArtistRabbitHole/1.0'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query || query.length < 2) {
    return NextResponse.json([])
  }

  const accessToken = await getSpotifyAccessToken()

  if (accessToken) {
    try {
      const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=5`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      const data = await response.json()
      if (data.error) throw new Error(data.error.message)

      const suggestions = data.artists.items.map((artist: any) => ({
        name: artist.name,
        image: artist.images[artist.images.length - 1]?.url || artist.images[0]?.url || null,
        genres: artist.genres?.slice(0, 1) || [],
      }))

      return NextResponse.json(suggestions)
    } catch (error) {
      console.error('Spotify suggestion error:', error)
    }
  }

  // Fallback to MusicBrainz
  try {
    const response = await fetch(`https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(query)}&limit=5&fmt=json`, {
      headers: {
        'User-Agent': MUSICBRAINZ_USER_AGENT,
      },
    })

    const data = await response.json()
    const suggestions = (data.artists || []).map((artist: any) => ({
      name: artist.name,
      image: null,
      genres: artist.tags?.slice(0, 1).map((t: any) => t.name) || [],
    }))

    return NextResponse.json(suggestions)
  } catch (error) {
    console.error('MusicBrainz suggestion error:', error)
    return NextResponse.json([])
  }
}

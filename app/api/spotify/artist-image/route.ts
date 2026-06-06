import { NextResponse } from 'next/server'
import { getSpotifyArtistImage } from '@/lib/spotify'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')

  if (!name) {
    return NextResponse.json({ error: 'Artist name is required' }, { status: 400 })
  }

  try {
    const imageUrl = await getSpotifyArtistImage(name)
    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error('Artist image API error:', error)
    return NextResponse.json({ error: 'Failed to fetch artist image' }, { status: 500 })
  }
}

export const revalidate = 3600

type LastFmTrack = {
  name?: string
  artist?: {
    name?: string
  }
  playcount?: string
  listeners?: string
  url?: string
}

type LastFmTopTracksResponse = {
  tracks?: {
    track?: LastFmTrack[]
  }
}

type TrendingTrack = {
  name: string
  artist: string
  playcount: string
  listeners: string
  url: string
}

export async function GET() {
  if (!process.env.LASTFM_API_KEY) {
    return Response.json({ error: 'Last.fm API key is not configured' }, { status: 500 })
  }

  const searchParams = new URLSearchParams({
    method: 'chart.gettoptracks',
    api_key: process.env.LASTFM_API_KEY,
    format: 'json',
    limit: '10',
  })

  try {
    const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${searchParams.toString()}`, {
      next: { revalidate },
    })

    if (!response.ok) {
      throw new Error(`Last.fm request failed with ${response.status}`)
    }

    const data = (await response.json()) as LastFmTopTracksResponse
    const tracks: TrendingTrack[] = (data.tracks?.track || []).slice(0, 10).map((track) => ({
      name: track.name || 'Unknown track',
      artist: track.artist?.name || 'Unknown artist',
      playcount: track.playcount || '0',
      listeners: track.listeners || '0',
      url: track.url || '',
    }))

    return Response.json(tracks)
  } catch (error) {
    console.error('Last.fm trending lookup failed:', error)
    return Response.json({ error: 'Failed to fetch trending tracks' }, { status: 502 })
  }
}

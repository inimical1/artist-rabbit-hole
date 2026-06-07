import { NextResponse } from 'next/server'
import { getSpotifyAccessToken } from '@/lib/spotify'

export async function PUT(request: Request) {
  try {
    const { deviceId } = await request.json()

    if (!deviceId) {
      return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 })
    }

    const token = await getSpotifyAccessToken()

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('DEBUG: Calling Spotify Pause API', { deviceId })
    const response = await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    const text = await response.text()
    console.log("SPOTIFY RAW RESPONSE (pause):", text)

    if (!response.ok) {
      console.error('DEBUG: Spotify Pause API Error:', response.status, text)
      return NextResponse.json({ error: text, status: response.status }, { status: response.status })
    }

    console.log('DEBUG: Spotify Pause API Success')
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Spotify pause error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

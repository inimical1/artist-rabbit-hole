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

    if (!response.ok) {
      const errorData = await response.json()
      console.error('DEBUG: Spotify Pause API Error:', errorData)
      return NextResponse.json({ error: errorData.error.message }, { status: response.status })
    }

    console.log('DEBUG: Spotify Pause API Success')
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Spotify pause error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { getSpotifyAccessToken } from '@/lib/spotify'

export async function PUT(request: Request) {
  try {
    const { uri, deviceId, transferOnly } = await request.json()

    if (!deviceId) {
      return NextResponse.json({ error: 'Missing deviceId' }, { status: 400 })
    }

    if (!transferOnly && !uri) {
      return NextResponse.json({ error: 'Missing uri' }, { status: 400 })
    }

    const token = await getSpotifyAccessToken()

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('DEBUG: Calling Spotify API', { deviceId, uri, transferOnly })

    if (transferOnly) {
      const response = await fetch(`https://api.spotify.com/v1/me/player`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_ids: [deviceId],
          play: false
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('DEBUG: Spotify Transfer Error:', errorData)
        return NextResponse.json({ error: errorData.error.message }, { status: response.status })
      }

      console.log('DEBUG: Spotify Transfer Success')
      return NextResponse.json({ success: true })
    }

    const url = deviceId === 'current' 
      ? `https://api.spotify.com/v1/me/player/play`
      : `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uris: [uri]
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('DEBUG: Spotify Play API Error:', errorData)
      return NextResponse.json({ error: errorData.error.message }, { status: response.status })
    }

    console.log('DEBUG: Spotify Play API Success')
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Spotify play error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

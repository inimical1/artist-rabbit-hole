import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function PUT(request: Request) {
  try {
    const { uri, deviceId } = await request.json()

    if (!uri || !deviceId) {
      return NextResponse.json({ error: 'Missing uri or deviceId' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const token = cookieStore.get('spotify_access_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
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
      return NextResponse.json({ error: errorData.error.message }, { status: response.status })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Spotify play error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

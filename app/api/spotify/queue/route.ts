import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { uri } = await request.json()

    if (!uri) {
      return NextResponse.json({ error: 'Missing uri' }, { status: 400 })
    }

    const cookieStore = await cookies()
    const token = cookieStore.get('spotify_access_token')?.value

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const response = await fetch(`https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(uri)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    const text = await response.text()
    console.log("SPOTIFY RAW RESPONSE (queue):", text)

    if (!response.ok) {
      console.error('DEBUG: Spotify Queue API Error:', response.status, text)
      return NextResponse.json({ error: text, status: response.status }, { status: response.status })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Spotify queue error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

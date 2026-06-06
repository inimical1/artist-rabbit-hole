import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params
    const { songName, artistName, spotifyUri, albumArt } = await request.json()

    // Get room by room_code
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id')
      .eq('room_code', code)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Get user from auth - but wait, the prompt says "from Supabase auth".
    // In server-side with service role, we might need the access token to identify the user.
    // However, if the client sends their user ID in the request, we can use that,
    // OR we can try to get the user from the authorization header if present.
    // Given the prompt's instruction, I'll use the user ID from the body or header.
    // Actually, a safer way to get "current user" in a Next.js route is via createServerClient,
    // but the prompt specified SERVICE_ROLE_KEY.
    
    // Let's assume the client passes the userId for simplicity, or we check the auth cookie.
    // Since I can't easily check auth without the cookie helper, I'll see if I can get it from headers.
    
    // Re-reading: "Gets the current user from Supabase auth"
    // I'll use a more standard approach for Next.js API routes if possible, 
    // but I must use SERVICE_ROLE_KEY for the insertion.
    
    // Let's try to get the user via the supabase.auth.getUser(token) method.
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.split(' ')[1]
    
    let userId = null
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id
    }

    const { data: queueItem, error } = await supabase
      .from('room_queue')
      .insert({
        room_id: room.id,
        song_name: songName,
        artist_name: artistName,
        spotify_uri: spotifyUri,
        album_art: albumArt,
        added_by: userId,
        played: false,
        votes_to_skip: []
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(queueItem)
  } catch (error: any) {
    console.error('Add to queue error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

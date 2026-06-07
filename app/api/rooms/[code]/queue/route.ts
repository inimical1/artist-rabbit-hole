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
    const { code } = await params
    const { songName, artistName, youtubeVideoId, thumbnail } = await request.json()

    // Get room by room_code
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id')
      .eq('room_code', code)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Get user from auth header
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
        youtube_video_id: youtubeVideoId,
        album_art: thumbnail,
        added_by: userId,
        played: false,
        votes_to_skip: 0
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

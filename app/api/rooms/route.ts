import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { name, genre } = await request.json()

    if (!name || !genre) {
      return NextResponse.json({ error: 'Name and genre are required' }, { status: 400 })
    }

    // Generate a random 6-character room code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()

    const { data, error } = await supabase
      .from('rooms')
      .insert([
        { name, genre, host_id: null, room_code: code }
      ])
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Create Room Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Fetch all active rooms with member counts
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('*, room_members(count)')
      .eq('is_active', true)
    
    if (error) throw error

    // Fetch current songs for these rooms
    const roomIds = rooms.map(r => r.id)
    const { data: queueItems, error: queueError } = await supabase
      .from('room_queue')
      .select('room_id, song_name, artist_name, album_art')
      .in('room_id', roomIds)
      .eq('played', false)
      .order('created_at', { ascending: true })

    if (queueError) throw queueError

    const formattedRooms = rooms.map((room: any) => {
      // Find the first unplayed song as the "current" song
      const currentSong = queueItems?.find((q: any) => q.room_id === room.id)
      
      return {
        id: room.id,
        name: room.name,
        genre: room.genre,
        code: room.room_code,
        created_at: room.created_at,
        memberCount: room.room_members?.[0]?.count || 0,
        currentSong: currentSong ? {
          song_name: currentSong.song_name,
          artist_name: currentSong.artist_name,
          album_art: currentSong.album_art
        } : null
      }
    })

    return NextResponse.json(formattedRooms)
  } catch (error: any) {
    console.error('List Rooms Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

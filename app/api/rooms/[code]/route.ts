import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = await params

    // Fetch room details by room_code
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_code', code)
      .single()

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Fetch queue (unplayed songs)
    const { data: queue, error: queueError } = await supabase
      .from('room_queue')
      .select('*')
      .eq('room_id', room.id)
      .eq('played', false)
      .order('created_at', { ascending: true })

    // Fetch current members
    const { data: members, error: membersError } = await supabase
      .from('room_members')
      .select('*')
      .eq('room_id', room.id)

    if (queueError || membersError) {
      throw queueError || membersError
    }

    return NextResponse.json({
      ...room,
      queue,
      members
    })
  } catch (error: any) {
    console.error('Fetch Room Details Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const { code } = params

    const { error } = await supabase
      .from('rooms')
      .update({ is_active: false })
      .eq('room_code', code)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete Room Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

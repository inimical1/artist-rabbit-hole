import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const GROQ_MODEL = 'llama-3.3-70b-versatile'

export async function POST(request: Request) {
  try {
    const { roomId } = await request.json()

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID is required' }, { status: 400 })
    }

    // Read the last 5 played songs from 'room_queue' for that room
    const { data: playedSongs, error: fetchError } = await supabase
      .from('room_queue')
      .select('song_name, artist_name')
      .eq('room_id', roomId)
      .eq('played', true)
      .order('created_at', { ascending: false })
      .limit(5)

    if (fetchError) throw fetchError

    const songList = playedSongs
      ?.map((s) => `${s.song_name} by ${s.artist_name}`)
      .join(', ') || 'No songs played yet'

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'Groq API key not configured' }, { status: 500 })
    }

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.8,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are an AI DJ. Suggest the next song based on a list of recently played songs. Return only a valid JSON object.'
        },
        {
          role: 'user',
          content: `Based on these songs: [${songList}], suggest the next song that would fit this vibe. 
          Return JSON: { "songName": "string", "artistName": "string", "reason": "string" }`
        }
      ]
    })

    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('Failed to get suggestion from AI')
    }

    const suggestion = JSON.parse(content)
    return NextResponse.json(suggestion)

  } catch (error: any) {
    console.error('AI DJ Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

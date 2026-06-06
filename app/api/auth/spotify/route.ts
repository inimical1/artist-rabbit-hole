import { NextResponse } from 'next/server'

export async function GET() {
  const scopes = [
    'user-top-read',
    'user-read-recently-played', 
    'user-read-playback-state',
    'user-modify-playback-state',
    'streaming',
    'playlist-read-private'
  ].join(' ')

  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    scope: scopes,
  })

  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`)
}

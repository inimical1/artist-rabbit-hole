import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  console.log("Incoming callback URL:", request.url)
  console.log("Authorization code received:", code ? "YES (truncated)" : "NO")

  if (!code) {
    console.error("No authorization code received")
    return NextResponse.redirect(new URL('/?error=no_code', request.url))
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    console.error("Missing Spotify environment variables:", { 
      hasClientId: !!clientId, 
      hasClientSecret: !!clientSecret, 
      hasRedirectUri: !!redirectUri 
    })
    return NextResponse.redirect(new URL('/?error=missing_config', request.url))
  }

  try {
    console.log("Exchanging code for tokens. Redirect URI used:", redirectUri)
    
    // Add a timeout to the fetch request to prevent infinite pending state
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    const text = await tokenResponse.text()
    console.log("Token exchange response status:", tokenResponse.status)

    if (!tokenResponse.ok) {
      console.error('Spotify token exchange failed. Body:', text)
      return NextResponse.redirect(new URL(`/?error=token_exchange_failed&status=${tokenResponse.status}`, request.url))
    }

    const tokens = JSON.parse(text)

    if (tokens.error) {
      console.error('Spotify token exchange error in body:', tokens.error)
      return NextResponse.redirect(new URL('/?error=tokens_body_error', request.url))
    }

    console.log("Successfully obtained tokens. Setting cookies and redirecting...")

    // Use NextResponse to set cookies and redirect in one go
    const response = NextResponse.redirect(new URL('/', request.url))
    
    response.cookies.set('spotify_access_token', tokens.access_token, {
      path: '/',
      maxAge: tokens.expires_in,
      sameSite: 'lax',
      secure: true,
      httpOnly: false 
    })

    if (tokens.refresh_token) {
      response.cookies.set('spotify_refresh_token', tokens.refresh_token, {
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        sameSite: 'lax',
        secure: true,
        httpOnly: false
      })
    }

    return response

  } catch (error: any) {
    console.error('Spotify callback exception:', error)
    const errorType = error.name === 'AbortError' ? 'timeout' : 'exception'
    return NextResponse.redirect(new URL(`/?error=callback_${errorType}`, request.url))
  }
}

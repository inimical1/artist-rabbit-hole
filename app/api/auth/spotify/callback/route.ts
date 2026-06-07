import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  console.log("Incoming callback URL:", request.url)
  console.log("Authorization code received:", code)

  if (!code) {
    console.error("No authorization code received")
    return NextResponse.redirect(new URL('/', request.url))
  }

  try {
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
      }),
    })

    const text = await tokenResponse.text()
    console.log("Token exchange response status:", tokenResponse.status)
    console.log("Token exchange response body:", text)

    if (!tokenResponse.ok) {
      console.error('Spotify token exchange error status:', tokenResponse.status)
      return NextResponse.redirect(new URL('/', request.url))
    }

    const tokens = JSON.parse(text)

    if (tokens.error) {
      console.error('Spotify token exchange error:', tokens.error)
      return NextResponse.redirect(new URL('/', request.url))
    }

    console.log("Session/cookies will be written in the client-side script")
    console.log("Final redirect URL: /")

    // Instead of redirecting, return an HTML page that sets cookies via JavaScript
    // then redirects — this guarantees cookies are set before navigation
    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Connecting Spotify...</title></head>
        <body>
          <script>
            console.log("Setting Spotify cookies...");
            document.cookie = 'spotify_access_token=${tokens.access_token}; path=/; max-age=${tokens.expires_in}; samesite=lax; secure';
            document.cookie = 'spotify_refresh_token=${tokens.refresh_token}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax; secure';
            console.log("Cookies set, redirecting to home...");
            window.location.href = '/';
          </script>
          <p>Connecting to Spotify...</p>
        </body>
      </html>
    `

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    })

  } catch (error) {
    console.error('Spotify callback error:', error)
    return NextResponse.redirect(new URL('/', request.url))
  }
}
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    console.error('YOUTUBE_API_KEY is not set')
    return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 })
  }

  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=5&videoCategoryId=10`
    
    const response = await fetch(url)
    const data = await response.json()

    if (data.error) {
      console.error('YouTube API error:', data.error)
      return NextResponse.json({ error: data.error.message }, { status: 500 })
    }

    const results = data.items.map((item: any) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelName: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url
    }))

    return NextResponse.json(results)
  } catch (error: any) {
    console.error('YouTube Search error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

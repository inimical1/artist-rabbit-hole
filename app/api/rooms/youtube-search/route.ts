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
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&key=${apiKey}&maxResults=5&videoCategoryId=10&videoEmbeddable=true`
    
    const searchResponse = await fetch(url)
    const searchData = await searchResponse.json()

    if (searchData.error) {
      console.error('YouTube Search API error:', searchData.error)
      return NextResponse.json({ error: searchData.error.message }, { status: 500 })
    }

    const initialIds = searchData.items.map((item: any) => item.id.videoId)
    console.log('DEBUG: YouTube Search found IDs:', initialIds)

    const videoIds = initialIds.join(',')
    
    // Fetch additional video details to verify playability
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=status,contentDetails,snippet&id=${videoIds}&key=${apiKey}`
    const detailsResponse = await fetch(detailsUrl)
    const detailsData = await detailsResponse.json()

    if (detailsData.error) {
      console.error('YouTube Details API error:', detailsData.error)
      return NextResponse.json({ error: detailsData.error.message }, { status: 500 })
    }

    const results = []

    for (const item of detailsData.items) {
      if (item.status.embeddable !== true || item.status.privacyStatus !== 'public') continue
      
      // Test if the video actually embeds by checking oEmbed
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${item.id}&format=json`
        const oembedRes = await fetch(oembedUrl)
        if (!oembedRes.ok) continue // Skip if oEmbed fails — means embedding is blocked
        
        results.push({
          videoId: item.id,
          title: item.snippet.title,
          channelName: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        })
        
        if (results.length >= 5) break
      } catch {
        continue
      }
    }

    return NextResponse.json(results)
  } catch (error: any) {
    console.error('YouTube Search error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

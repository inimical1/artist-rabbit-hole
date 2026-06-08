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
    const queries = [
      `${query} official audio`,
      `${query} topic`,
      `${query} lyric video`,
      `${query} audio`
    ]

    const allItems: any[] = []
    
    // Fetch from multiple queries in parallel
    await Promise.all(queries.map(async (q) => {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(q)}&key=${apiKey}&maxResults=10&videoCategoryId=10&videoEmbeddable=true`
      const res = await fetch(url)
      const data = await res.json()
      if (data.items) allItems.push(...data.items)
    }))

    // Deduplicate by videoId
    const uniqueItems = Array.from(new Map(allItems.map(item => [item.id.videoId, item])).values())
    const videoIds = uniqueItems.map((item: any) => item.id.videoId).join(',')
    
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=status,contentDetails,snippet&id=${videoIds}&key=${apiKey}`
    const detailsResponse = await fetch(detailsUrl)
    const detailsData = await detailsResponse.json()

    if (detailsData.error) {
      console.error('YouTube Details API error:', detailsData.error)
      return NextResponse.json({ error: detailsData.error.message }, { status: 500 })
    }

    const candidates = detailsData.items.map((item: any) => {
      const title = item.snippet.title.toLowerCase()
      const channelTitle = item.snippet.channelTitle.toLowerCase()
      
      let score = 0
      
      // Ranking Logic
      if (channelTitle.includes('- topic')) score += 10
      if (title.includes('official audio')) score += 8
      if (title.includes('lyric')) score += 6
      if (title.includes('audio')) score += 4

      if (title.includes('live')) score -= 10
      if (title.includes('reaction')) score -= 10
      if (title.includes('shorts')) score -= 10
      if (title.includes('concert')) score -= 8
      if (title.includes('cover')) score -= 8

      return {
        videoId: item.id,
        title: item.snippet.title,
        channelName: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        embeddable: item.status.embeddable,
        privacyStatus: item.status.privacyStatus,
        score
      }
    })

    const results = []
    for (const item of candidates) {
      // Basic validation
      if (item.embeddable !== true || item.privacyStatus !== 'public') {
        console.log(`REJECTED ${item.videoId}: ${item.title} - Reason: Not embeddable or not public`)
        continue
      }

      try {
        // oEmbed validation
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${item.videoId}&format=json`
        const oembedRes = await fetch(oembedUrl)
        if (!oembedRes.ok) {
          console.log(`REJECTED ${item.videoId}: ${item.title} - Reason: oEmbed failed`)
          continue
        }

        // Embed page validation
        const embedUrl = `https://www.youtube.com/embed/${item.videoId}`
        const embedRes = await fetch(embedUrl, { method: 'HEAD' })
        if (!embedRes.ok) {
           console.log(`REJECTED ${item.videoId}: ${item.title} - Reason: Embed page check failed`)
           continue
        }
        
        console.log(`ACCEPTED ${item.videoId}: ${item.title} - Score: ${item.score}`)
        results.push({
          videoId: item.videoId,
          title: item.title,
          channelName: item.channelName,
          thumbnail: item.thumbnail,
          score: item.score
        })
      } catch (err) {
        console.log(`REJECTED ${item.videoId}: ${item.title} - Reason: Error during deep validation`)
        continue
      }
    }

    // Final sort by score
    const finalResults = results.sort((a, b) => b.score - a.score).slice(0, 10)
    return NextResponse.json(finalResults)
  } catch (error: any) {
    console.error('YouTube Search error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

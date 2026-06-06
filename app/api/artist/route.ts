import Groq from 'groq-sdk'
import { Vibrant } from 'node-vibrant/node'
import { type ArtistData } from '@/components/artist-result'
import { getSpotifyArtistImage } from '@/lib/spotify'

const MUSICBRAINZ_USER_AGENT = 'ArtistRabbitHole/1.0'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

type MusicBrainzArtist = {
  id?: string
  name?: string
  country?: string
  area?: {
    name?: string
  }
  'life-span'?: {
    begin?: string
    end?: string
    ended?: boolean
  }
  tags?: Array<{
    name?: string
    count?: number
  }>
  relations?: MusicBrainzRelation[]
}

type MusicBrainzRelation = {
  type?: string
  direction?: string
  artist?: {
    id?: string
    name?: string
    disambiguation?: string
  }
}

type MusicBrainzSearchResponse = {
  artists?: MusicBrainzArtist[]
}

type GroqArtistWriting = {
  vibeSummary?: string
  story?: string[]
  influences?: string[]
  influencedBy?: string[]
  similarArtists?: ArtistData['similarArtists']
}

type WikipediaSummaryResponse = {
  thumbnail?: {
    source?: string
  }
  originalimage?: {
    source?: string
  }
}

const fallbackStory = (name: string) => [
  `${name} moves through music like a rumor passed between late-night rooms, leaving texture, intent, and a little static in the air.`,
  `The story is less about a neat timeline than a set of pressure points: scenes, records, collaborators, and listeners finding their own reflection in the sound.`,
  `What remains is the feeling of an artist still being discovered in real time, with every song opening another door down the rabbit hole.`,
]

function seededRandom(name: string, min: number, max: number) {
  const seed = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return Math.floor((((seed * 9301 + 49297) % 233280) / 233280) * (max - min) + min)
}

function buildSonicDNA(name: string): ArtistData['sonicDNA'] {
  return {
    energy: seededRandom(`${name}-energy`, 30, 85),
    danceability: seededRandom(`${name}-danceability`, 25, 75),
    mood: seededRandom(`${name}-mood`, 20, 90),
    acousticness: seededRandom(`${name}-acousticness`, 15, 70),
    tempo: seededRandom(`${name}-tempo`, 40, 80),
  }
}

function formatActiveYears(lifeSpan?: MusicBrainzArtist['life-span']) {
  if (!lifeSpan?.begin && !lifeSpan?.end) return 'Unknown'

  const begin = lifeSpan.begin?.slice(0, 4) || 'Unknown'
  const end = lifeSpan.end?.slice(0, 4)

  if (end) return `${begin} - ${end}`
  if (lifeSpan.ended) return begin
  return `${begin} - present`
}

function getGenres(artist?: MusicBrainzArtist) {
  const tags = artist?.tags || []

  return tags
    .filter((tag) => tag.name)
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, 3)
    .map((tag) => tag.name as string)
}

function uniqueNames(names: string[], limit = 6) {
  return Array.from(new Set(names.filter(Boolean))).slice(0, limit)
}

function normalizeRelationType(type?: string) {
  return type?.trim().toLowerCase()
}

function getRelatedArtists(relations: MusicBrainzRelation[] = []) {
  const influenceRelations = relations.filter((relation) => {
    const type = normalizeRelationType(relation.type)
    return type === 'influenced by' || type === 'influence'
  })

  const influences = uniqueNames(
    influenceRelations
      .filter((relation) => {
        const type = normalizeRelationType(relation.type)
        return (
          (type === 'influenced by' && relation.direction === 'backward') ||
          (type === 'influence' && relation.direction !== 'backward')
        )
      })
      .map((relation) => relation.artist?.name || '')
  )

  const influencedBy = uniqueNames(
    influenceRelations
      .filter((relation) => {
        const type = normalizeRelationType(relation.type)
        return (
          (type === 'influenced by' && relation.direction !== 'backward') ||
          (type === 'influence' && relation.direction === 'backward')
        )
      })
      .map((relation) => relation.artist?.name || '')
  )

  return {
    influences,
    influencedBy,
  }
}

function getSimilarArtistNames(relations: MusicBrainzRelation[] = []) {
  return uniqueNames(
    relations
      .filter((relation) => normalizeRelationType(relation.type) === 'similar')
      .map((relation) => relation.artist?.name || ''),
    4
  )
}

function uniqueSimilarArtists(similarArtists: ArtistData['similarArtists'], artistName: string) {
  const seen = new Set<string>()

  return similarArtists.filter((similarArtist) => {
    const normalizedName = similarArtist.name.trim().toLowerCase()
    if (!normalizedName || normalizedName === artistName.toLowerCase() || seen.has(normalizedName)) {
      return false
    }

    seen.add(normalizedName)
    return true
  })
}

function repairMojibake(text: string) {
  return text
    .replaceAll('\u00e2\u20ac\u2122', "'")
    .replaceAll('\u00e2\u20ac\u02dc', "'")
    .replaceAll('\u00e2\u20ac\u0153', '"')
    .replaceAll('\u00e2\u20ac\u009d', '"')
    .replaceAll('\u00e2\u20ac\u201c', '-')
    .replaceAll('\u00e2\u20ac\u201d', '-')
    .replaceAll('\u00c2 ', ' ')
    .replaceAll('\u00c2', '')
}

async function fetchMusicBrainz<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': MUSICBRAINZ_USER_AGENT,
    },
  })

  if (!response.ok) {
    throw new Error(`MusicBrainz request failed with ${response.status}`)
  }

  const body = new TextDecoder('utf-8').decode(await response.arrayBuffer())
  return JSON.parse(repairMojibake(body)) as T
}

async function getMusicBrainzArtist(name: string) {
  try {
    const searchParams = new URLSearchParams({
      query: name,
      limit: '1',
      fmt: 'json',
    })
    const searchData = await fetchMusicBrainz<MusicBrainzSearchResponse>(
      `https://musicbrainz.org/ws/2/artist/?${searchParams.toString()}`
    )
    const artist = searchData.artists?.[0]

    if (!artist?.id) return { artist: undefined, artistWithRelations: undefined }

    const artistWithRelations = await fetchMusicBrainz<MusicBrainzArtist>(
      `https://musicbrainz.org/ws/2/artist/${artist.id}?inc=artist-rels&fmt=json`
    )

    return { artist, artistWithRelations }
  } catch (error) {
    console.error('MusicBrainz lookup failed:', error)
    return { artist: undefined, artistWithRelations: undefined }
  }
}

async function getWikipediaImage(artistName: string): Promise<string | null> {
  try {
    const slug = artistName.replace(/ /g, '_')
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`)

    if (!res.ok) return null

    const data = (await res.json()) as WikipediaSummaryResponse
    return data.thumbnail?.source || data.originalimage?.source || null
  } catch {
    return null
  }
}

async function getSpotifyImage(artistName: string): Promise<string | null> {
  return getSpotifyArtistImage(artistName)
}

async function getAccentColor(imageUrl: string | null) {
  if (!imageUrl) return '#6d28d9'

  try {
    const palette = await Vibrant.from(imageUrl).getPalette()
    return palette.Vibrant?.hex || palette.Muted?.hex || '#6d28d9'
  } catch {
    return '#6d28d9'
  }
}

async function getGroqWriting(
  name: string,
  country: string,
  activeYears: string,
  genres: string[]
) {
  const fallback = {
    vibeSummary: `music that sounds like finding ${name} at the end of a long night`,
    story: fallbackStory(name),
    influences: [],
    influencedBy: [],
    similarArtists: [],
  }

  if (!process.env.GROQ_API_KEY) return fallback

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      temperature: 0.85,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You write vivid music criticism and music discovery recommendations. Return only a valid JSON object with keys: vibeSummary, story, influences, influencedBy, and similarArtists. Do not include markdown or commentary.',
        },
        {
          role: 'user',
          content: `Artist: ${name}
Country: ${country}
Active years: ${activeYears}
Genres: ${genres.join(', ') || 'unknown'}

Respond with this exact JSON shape:
{
  "vibeSummary": "string - one poetic line like music that sounds like 3am and not caring",
  "story": ["string - paragraph 1", "string - paragraph 2", "string - paragraph 3"],
  "influences": ["array of 4-5 real artist names who influenced this artist"],
  "influencedBy": ["array of 3-4 real artist names this artist has influenced"],
  "similarArtists": [
    { "name": "string", "genre": "string", "description": "string - unique one-line description" }
  ]
}

Rules:
- story must contain exactly 3 paragraph strings, written like a music journalist, not Wikipedia.
- influences must contain 4-5 real, well-known artist names who influenced ${name}.
- influencedBy must contain 3-4 real, well-known artist names this artist has influenced.
- similarArtists must contain exactly 4 real similar artists, each with name, genre, and a one-line description.
- Return only real, well-known artist names.`,
        },
      ],
    })

    const content = completion.choices[0]?.message?.content
    if (!content) return fallback

    const parsed = JSON.parse(content) as GroqArtistWriting
    const story = Array.isArray(parsed.story)
      ? parsed.story.filter((paragraph) => typeof paragraph === 'string' && paragraph.trim()).slice(0, 3)
      : []
    const influences = Array.isArray(parsed.influences)
      ? uniqueNames(
          parsed.influences.filter((artistName) => typeof artistName === 'string' && artistName.trim()),
          5
        )
      : []
    const influencedBy = Array.isArray(parsed.influencedBy)
      ? uniqueNames(
          parsed.influencedBy.filter((artistName) => typeof artistName === 'string' && artistName.trim()),
          4
        )
      : []
    const similarArtists = Array.isArray(parsed.similarArtists)
      ? parsed.similarArtists
          .filter(
            (similarArtist) =>
              similarArtist &&
              typeof similarArtist.name === 'string' &&
              typeof similarArtist.genre === 'string' &&
              typeof similarArtist.description === 'string'
          )
          .slice(0, 4)
      : []

    return {
      vibeSummary:
        typeof parsed.vibeSummary === 'string' && parsed.vibeSummary.trim()
          ? parsed.vibeSummary.trim()
          : fallback.vibeSummary,
      story: story.length === 3 ? story : fallback.story,
      influences,
      influencedBy,
      similarArtists: uniqueSimilarArtists(similarArtists, name),
    }
  } catch (error) {
console.error('Groq generation failed:', JSON.stringify(error))
    return fallback
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const requestedName = searchParams.get('name')?.trim()

  if (!requestedName) {
    return Response.json({ error: 'Artist name is required' }, { status: 400 })
  }

  const { artist, artistWithRelations } = await getMusicBrainzArtist(requestedName)
  const name = artist?.name || requestedName
  const genres = getGenres(artist)
  const country = artist?.area?.name || artist?.country || 'Unknown'
  const activeYears = formatActiveYears(artist?.['life-span'])
  const relations = artistWithRelations?.relations || []
  const musicBrainzRelations = getRelatedArtists(relations)
  const similarArtistNames = getSimilarArtistNames(relations)
  const writing = await getGroqWriting(name, country, activeYears, genres)
  const primaryGenre = genres[0] || 'Connected artist'

  const musicBrainzSimilarArtists = similarArtistNames
    .filter((relatedName) => relatedName !== name)
    .map((relatedName) => ({
      name: relatedName,
      genre: primaryGenre,
      description: `A neighboring sound for listeners following ${name}'s trail.`,
    }))
  const influences = musicBrainzRelations.influences.length
    ? musicBrainzRelations.influences
    : writing.influences
  const influencedBy = musicBrainzRelations.influencedBy.length
    ? musicBrainzRelations.influencedBy
    : writing.influencedBy
  const similarArtists = musicBrainzSimilarArtists.length
    ? musicBrainzSimilarArtists
    : uniqueSimilarArtists(writing.similarArtists, name)
  const imageUrl = (await getSpotifyImage(name)) || (await getWikipediaImage(name))
  const accentColor = await getAccentColor(imageUrl)

  const artistData: ArtistData = {
    name,
    genres: genres.length ? genres : ['Unknown'],
    country,
    activeYears,
    vibeSummary: writing.vibeSummary,
    story: writing.story,
    sonicDNA: buildSonicDNA(name),
    influences,
    influencedBy,
    similarArtists,
    imageUrl,
    accentColor,
  }

  return Response.json(artistData)
}

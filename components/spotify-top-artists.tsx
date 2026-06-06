'use client'

import { useEffect, useState } from 'react'

interface SpotifyArtist {
  name: string
  image: string
}

export function SpotifyTopArtists({ onArtistClick, compact = false }: { onArtistClick: (name: string) => void, compact?: boolean }) {
  const [artists, setArtists] = useState<SpotifyArtist[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTopArtists = async () => {
      try {
        const response = await fetch('/api/spotify/top-artists')
        if (response.ok) {
          const data = await response.json()
          setArtists(data)
        }
      } catch (error) {
        console.error('Failed to fetch top artists:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTopArtists()
  }, [])

  if (loading || artists.length === 0) return null

  if (compact) {
    return (
      <div className="w-full max-w-4xl mx-auto mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h2 className="text-[10px] font-heading uppercase tracking-[0.3em] text-white/40 mb-4 text-center">Your Inner Circle</h2>
        <div className="flex justify-center gap-4 overflow-x-auto pb-2 scrollbar-hide px-4">
          {artists.map((artist) => (
            <button
              key={artist.name}
              onClick={() => onArtistClick(artist.name)}
              className="flex-shrink-0 group focus:outline-none"
            >
              <div className="size-16 rounded-full overflow-hidden mb-2 ring-1 ring-white/10 group-hover:ring-primary/50 transition-all duration-300">
                <img src={artist.image} alt={artist.name} className="size-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" />
              </div>
              <p className="text-[9px] font-heading text-center truncate w-16 text-white/50 group-hover:text-white transition-colors">{artist.name}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full py-8 px-8 border-b border-border bg-card/30 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-sm font-heading uppercase tracking-widest text-muted-foreground mb-4">Your Top Artists</h2>
        <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
          {artists.map((artist) => (
            <button
              key={artist.name}
              onClick={() => onArtistClick(artist.name)}
              className="flex-shrink-0 group text-left transition-transform hover:scale-105 focus:outline-none"
            >
              <div className="size-24 md:size-32 rounded-full overflow-hidden mb-3 ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all shadow-xl">
                <img src={artist.image} alt={artist.name} className="size-full object-cover" />
              </div>
              <p className="text-xs font-heading text-center truncate w-24 md:w-32">{artist.name}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

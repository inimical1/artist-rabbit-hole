'use client'

import { type CSSProperties, useEffect, useRef, useState } from 'react'

interface ArtistData {
  name: string
  genres: string[]
  country: string
  activeYears: string
  vibeSummary: string
  story: string[]
  sonicDNA: {
    energy: number
    danceability: number
    mood: number
    acousticness: number
    tempo: number
  }
  influences: string[]
  influencedBy: string[]
  similarArtists: Array<{
    name: string
    genre: string
    description: string
  }>
  imageUrl: string | null
  accentColor: string
}

const MOOD_DESCRIPTIONS: Record<string, string[]> = {
  energy: ['mellow and contemplative', 'balanced energy', 'high octane and electrifying'],
  danceability: ['sit back and listen', 'toe-tapping territory', 'dance floor anthem'],
  mood: ['deep melancholy', 'emotionally nuanced', 'pure euphoria'],
  acousticness: ['heavily produced', 'mixed approach', 'raw and organic'],
  tempo: ['slow burn', 'moderate groove', 'heart-racing pace'],
}

function getMoodDescription(key: string, value: number): string {
  const descriptions = MOOD_DESCRIPTIONS[key] || ['low', 'medium', 'high']
  if (value < 33) return descriptions[0]
  if (value < 66) return descriptions[1]
  return descriptions[2]
}

interface SectionProps {
  children: React.ReactNode
  className?: string
}

function RevealSection({ children, className = '' }: SectionProps) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
          }
        })
      },
      { threshold: 0.1 }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`transition-all duration-[1200ms] ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      } ${className}`}
      style={{
        transitionProperty: 'opacity, transform',
        transitionDuration: '0.8s',
        transitionTimingFunction: 'ease'
      }}
    >
      {children}
    </div>
  )
}

interface SonicBarProps {
  label: string
  value: number
  description: string
}

function SonicBar({ label, value, description }: SonicBarProps) {
  const [animatedValue, setAnimatedValue] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => setAnimatedValue(value), 100)
          }
        })
      },
      { threshold: 0.5 }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [value])

  return (
    <div ref={ref} className="mb-12">
      <div className="flex justify-between items-center mb-4">
        <span className="text-muted-foreground font-mono uppercase text-[10px] tracking-[0.4em]">{label}</span>
        <span className="text-white/20 text-[10px] font-mono">{animatedValue}%</span>
      </div>
      <div className="h-[1px] bg-white/10 w-full relative">
        <div 
          className="h-full bg-white transition-all duration-[1.5s] ease-out"
          style={{ width: `${animatedValue}%` }}
        />
      </div>
      <p className="text-muted-foreground text-[11px] mt-4 uppercase tracking-widest opacity-60">
        {description}
      </p>
    </div>
  )
}

interface ArtistResultProps {
  artist: ArtistData
  onArtistClick: (name: string) => void
}

export function ArtistResult({ artist, onArtistClick }: ArtistResultProps) {
  const accentColor = artist.accentColor
  const sectionStyle = { '--accent': accentColor } as CSSProperties & Record<'--accent', string>
  const heroBackground = artist.imageUrl
    ? `linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,1)), url(${JSON.stringify(artist.imageUrl)})`
    : `radial-gradient(circle at center, ${accentColor}10 0%, transparent 70%)`

  return (
    <section className="py-0" id="artist-result" style={sectionStyle}>
      <div className="w-full">
        {/* Artist Hero - Edge to Edge */}
        <RevealSection className="min-h-screen relative flex flex-col justify-end overflow-hidden px-8 pb-32">
          <div 
            className="absolute inset-0 -z-20 bg-cover bg-center grayscale opacity-40"
            style={{
              backgroundImage: heroBackground,
            }}
          />
          
          <div className="max-w-screen-2xl mx-auto w-full">
            <h1 className="font-mono font-bold text-[clamp(80px,25vw,280px)] tracking-tight leading-[0.75] text-foreground mb-16 uppercase break-words">
              {artist.name}
            </h1>
            
            <div className="flex flex-wrap gap-12 items-end">
              <div className="space-y-2">
                <span className="block text-muted-foreground text-[10px] uppercase tracking-[0.4em]">Genre</span>
                <p className="text-xl font-heading">{artist.genres.join(' / ')}</p>
              </div>
              <div className="space-y-2">
                <span className="block text-muted-foreground text-[10px] uppercase tracking-[0.4em]">Origin</span>
                <p className="text-xl font-heading">{artist.country}</p>
              </div>
              <div className="space-y-2">
                <span className="block text-muted-foreground text-[10px] uppercase tracking-[0.4em]">Years</span>
                <p className="text-xl font-heading">{artist.activeYears}</p>
              </div>
            </div>
          </div>
        </RevealSection>

        <div className="max-w-screen-xl mx-auto px-8 py-48 space-y-64">
          {/* The Vibe */}
          <RevealSection className="max-w-4xl">
            <span className="text-muted-foreground text-[10px] uppercase tracking-[0.4em] mb-12 block">THE VIBE</span>
            <h2 className="text-[clamp(32px,6vw,80px)] font-heading leading-tight italic text-white/90">
              {`"${artist.vibeSummary}"`}
            </h2>
          </RevealSection>

          {/* The Story */}
          <RevealSection className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-4">
              <span className="text-muted-foreground text-[10px] uppercase tracking-[0.4em] sticky top-32 block">THE STORY</span>
            </div>
            <div className="lg:col-span-8 space-y-16">
              {artist.story.map((paragraph, index) => (
                <p key={index} className="text-2xl leading-relaxed text-white/70 font-sans font-light">
                  {paragraph}
                </p>
              ))}
            </div>
          </RevealSection>

          {/* Sonic DNA */}
          <RevealSection className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-4">
              <span className="text-muted-foreground text-[10px] uppercase tracking-[0.4em] sticky top-32 block">SONIC DNA</span>
            </div>
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-x-24 gap-y-12">
              <SonicBar 
                label="Energy" 
                value={artist.sonicDNA.energy} 
                description={getMoodDescription('energy', artist.sonicDNA.energy)}
              />
              <SonicBar 
                label="Danceability" 
                value={artist.sonicDNA.danceability} 
                description={getMoodDescription('danceability', artist.sonicDNA.danceability)}
              />
              <SonicBar 
                label="Mood" 
                value={artist.sonicDNA.mood} 
                description={getMoodDescription('mood', artist.sonicDNA.mood)}
              />
              <SonicBar 
                label="Acousticness" 
                value={artist.sonicDNA.acousticness} 
                description={getMoodDescription('acousticness', artist.sonicDNA.acousticness)}
              />
              <SonicBar 
                label="Tempo" 
                value={artist.sonicDNA.tempo} 
                description={getMoodDescription('tempo', artist.sonicDNA.tempo)}
              />
            </div>
          </RevealSection>

          {/* Go Deeper */}
          <RevealSection>
            <span className="text-muted-foreground text-[10px] uppercase tracking-[0.4em] mb-24 block">GO DEEPER</span>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 border-t border-white/10">
              {artist.similarArtists.map((similarArtist) => (
                <button
                  key={similarArtist.name}
                  onClick={() => onArtistClick(similarArtist.name)}
                  className="text-left p-12 hover:bg-white/[0.03] transition-all duration-700 border-r border-b border-white/10 group"
                >
                  <h3 className="font-mono font-bold text-3xl text-foreground mb-4 uppercase group-hover:text-primary transition-colors">
                    {similarArtist.name}
                  </h3>
                  <span className="inline-block text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-6">
                    {similarArtist.genre}
                  </span>
                  <p className="text-[12px] text-muted-foreground leading-relaxed uppercase tracking-wider opacity-60">
                    {similarArtist.description}
                  </p>
                </button>
              ))}
            </div>
          </RevealSection>
        </div>
      </div>
    </section>
  )
}

export type { ArtistData }

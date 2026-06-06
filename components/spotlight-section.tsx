'use client'

import { useEffect, useRef, useState } from 'react'

interface TrendingTrack {
  name: string
  artist: string
  listeners: string
}

const GRADIENTS = [
  'from-purple-900/60 to-purple-950/20',
  'from-teal-900/60 to-teal-950/20',
  'from-orange-900/60 to-orange-950/20',
  'from-pink-900/60 to-pink-950/20',
  'from-indigo-900/60 to-indigo-950/20',
]

function formatListeners(count: string) {
  const num = parseInt(count, 10)
  if (isNaN(num)) return '0 listeners'
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M listeners`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K listeners`
  return `${num} listeners`
}

export function SpotlightSection() {
  const [tracks, setTracks] = useState<TrendingTrack[]>([])
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const res = await fetch('/api/trending')
        if (res.ok) {
          const data = await res.json()
          setTracks(data)
        }
      } catch (error) {
        console.error('Failed to fetch trending:', error)
      }
    }
    fetchTrending()

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.1 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  if (tracks.length === 0) return null

  return (
    <section 
      ref={sectionRef}
      className="py-64 px-8 overflow-hidden bg-black"
    >
      <div className="max-w-screen-2xl mx-auto">
        <span className="text-muted-foreground text-[10px] uppercase tracking-[0.4em] mb-24 block">SPOTLIGHT</span>
        
        <div className="flex gap-4 overflow-x-auto pb-12 scrollbar-hide">
          {tracks.map((track, i) => (
            <div 
              key={`${track.name}-${i}`}
              className={`relative h-[500px] w-[350px] flex-shrink-0 flex flex-col justify-end p-12 transition-all duration-[1.2s] ease-out bg-gradient-to-b ${GRADIENTS[i % GRADIENTS.length]} rounded-2xl`}
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(40px)',
                transitionDelay: `${i * 100}ms`,
              }}
            >
              <h3 className="font-mono font-bold text-4xl text-foreground uppercase tracking-tight leading-none mb-4 break-words">
                {track.name}
              </h3>
              <p className="text-white/80 font-heading text-xl mb-4">
                {track.artist}
              </p>
              <p className="text-white/40 text-[11px] uppercase tracking-widest">
                {formatListeners(track.listeners)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'

const TRENDING_ARTISTS = [
  { name: 'Aphex Twin', color: 'from-purple-900/40' },
  { name: 'Cocteau Twins', color: 'from-blue-900/40' },
  { name: 'My Bloody Valentine', color: 'from-pink-900/40' },
  { name: 'Burial', color: 'from-zinc-900/40' },
]

export function SpotlightSection() {
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
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

  return (
    <section 
      ref={sectionRef}
      className="py-64 px-8 overflow-hidden bg-black"
    >
      <div className="max-w-screen-2xl mx-auto">
        <span className="text-muted-foreground text-[10px] uppercase tracking-[0.4em] mb-24 block">SPOTLIGHT</span>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0">
          {TRENDING_ARTISTS.map((artist, i) => (
            <div 
              key={artist.name}
              className={`relative h-[600px] flex flex-col justify-end p-12 transition-all duration-[1.2s] ease-out bg-gradient-to-b ${artist.color} to-black`}
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(40px)',
                transitionDelay: `${i * 150}ms`,
              }}
            >
              <span className="text-[10px] uppercase tracking-[0.4em] text-white/40 mb-4 block">Trending</span>
              <h3 className="font-mono font-bold text-5xl text-foreground uppercase tracking-tight leading-none mb-4">
                {artist.name}
              </h3>
              <p className="text-muted-foreground text-[11px] uppercase tracking-widest opacity-60">
                Exploring the echoes of influence and the textures of sound.
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

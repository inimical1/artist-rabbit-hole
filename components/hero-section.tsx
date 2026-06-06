'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Music, Search, User } from 'lucide-react'

interface HeroSectionProps {
  onSearch: (query: string) => void
  children?: React.ReactNode
}

interface Suggestion {
  name: string
  image: string | null
  genres: string[]
}

export function HeroSection({ onSearch, children }: HeroSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [scrollY, setScrollY] = useState(0)
  const sectionRef = useRef<HTMLElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Debounced suggestion fetch
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSuggestions([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(searchQuery)}`)
        const data = await res.json()
        setSuggestions(data)
        setShowSuggestions(true)
        setSelectedIndex(-1)
      } catch (error) {
        console.error('Failed to fetch suggestions:', error)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    setSearchQuery(suggestion.name)
    setShowSuggestions(false)
    onSearch(suggestion.name)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault()
        handleSelectSuggestion(suggestions[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim())
      setShowSuggestions(false)
    }
  }

  // Slower, cinematic opacity
  const opacity = Math.max(0, 1 - (scrollY * 0.001))

  return (
    <section 
      ref={sectionRef}
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden py-32"
    >
      {/* Hero content */}
      <div 
        className="w-full text-center z-10 px-4"
        style={{ 
          opacity: opacity,
          transition: 'opacity 0.8s ease, transform 0.8s ease'
        }}
      >
        <h1 className="font-mono font-bold tracking-tight leading-[0.8] mb-16 uppercase">
          <span className="block text-[clamp(80px,20vw,200px)] text-foreground">ARTIST</span>
          <span className="block text-[clamp(80px,20vw,200px)] text-foreground">RABBIT</span>
          <span className="block text-[clamp(80px,20vw,200px)] text-foreground">HOLE</span>
        </h1>
        <p className="text-muted-foreground text-[10px] uppercase tracking-[0.4em] mb-24">
          every artist is a rabbit hole waiting to be explored
        </p>
        
        {/* Search bar with Autocomplete */}
        <div className="relative max-w-xl mx-auto mt-12" ref={dropdownRef}>
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => searchQuery.length >= 2 && setShowSuggestions(true)}
              placeholder="search by name"
              className="w-full bg-transparent border-0 border-b border-white/20 
                       text-white text-2xl py-6 px-2 outline-none 
                       placeholder:text-white/20 focus:border-white/40 
                       transition-all duration-700 font-sans text-center"
            />
          </form>

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-black border border-white/10 rounded-lg overflow-hidden z-50 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-300">
              {suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.name}-${index}`}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors ${
                    selectedIndex === index ? 'bg-primary/20 text-white' : 'text-white/60 hover:bg-white/5'
                  }`}
                >
                  <div className="size-10 rounded-full bg-zinc-800 flex-shrink-0 overflow-hidden border border-white/10">
                    {suggestion.image ? (
                      <img src={suggestion.image} alt="" className="size-full object-cover" />
                    ) : (
                      <div className="size-full flex items-center justify-center">
                        <User className="size-5 text-white/20" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading text-base truncate">{suggestion.name}</p>
                    {suggestion.genres.length > 0 && (
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">
                        {suggestion.genres[0]}
                      </p>
                    )}
                  </div>
                  {selectedIndex === index && <Search className="size-4 text-primary animate-pulse" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-16">
          {children}
        </div>
      </div>

      {/* Scroll indicator */}
      <div 
        className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4"
        style={{ opacity: opacity }}
      >
        <span className="text-muted-foreground text-[10px] uppercase tracking-[0.4em]">Scroll</span>
        <div className="w-[1px] h-12 bg-gradient-to-b from-white/30 to-transparent" />
      </div>
    </section>
  )
}

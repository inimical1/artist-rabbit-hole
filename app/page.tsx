'use client'

import { useState, useCallback, useEffect } from 'react'
import { HeroSection } from '@/components/hero-section'
import { SpotlightSection } from '@/components/spotlight-section'
import { HowItWorksSection } from '@/components/how-it-works-section'
import { LoadingOverlay } from '@/components/loading-overlay'
import { ArtistResult, type ArtistData } from '@/components/artist-result'
import { InfluenceWeb } from '@/components/influence-web'
import { UserMenu } from '@/components/user-menu'
import { SpotifyTopArtists } from '@/components/spotify-top-artists'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function Home() {
  const [isLoading, setIsLoading] = useState(false)
  const [artistData, setArtistData] = useState<ArtistData | null>(null)
  const [isSpotifyConnected, setIsSpotifyConnected] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const checkStatus = async () => {
      console.log("Checking Spotify status...");
      const { data: { user } } = await supabase.auth.getUser()
      console.log("Supabase User:", user ? user.email : "Not logged in");
      setUser(user)

      if (user) {
        try {
          const res = await fetch('/api/spotify/status')
          const data = await res.json()
          console.log("Spotify Status Response:", data);
          setIsSpotifyConnected(data.connected)
        } catch (error) {
          console.error('Failed to check Spotify status:', error)
        }
      }
    }
    checkStatus()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("Auth State Changed:", _event, session?.user?.email);
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSearch = useCallback(async (query: string) => {
    setIsLoading(true)
    
    try {
      const response = await fetch(`/api/artist?name=${encodeURIComponent(query)}`)
      const data = await response.json()
      
      setArtistData(data)
      
      // Smooth scroll to artist result after a brief delay
      setTimeout(() => {
        document.getElementById('artist-result')?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (error) {
      console.log('[v0] Search failed:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleArtistClick = useCallback((name: string) => {
    // Scroll to top first
    window.scrollTo({ top: 0, behavior: 'smooth' })
    
    // Then search for new artist after scroll animation
    setTimeout(() => {
      handleSearch(name)
    }, 500)
  }, [handleSearch])

  return (
    <main className="relative min-h-screen">
      {/* Grain overlay */}
      <div className="grain-overlay" />
      
      {/* User Menu */}
      <div className="absolute top-6 right-8 z-50 flex items-center gap-4">
        <Link href="/rooms">
          <Button variant="outline" size="sm" className="font-heading border-primary/50 hover:bg-primary/10">
            Rooms
          </Button>
        </Link>
        <UserMenu />
      </div>
      
      {/* Loading overlay */}
      <LoadingOverlay isVisible={isLoading} />
      
      {/* Spotify Connection Banner */}
      {!isSpotifyConnected && !isLoading && !artistData && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-top-4 duration-500">
          <a href="/api/auth/spotify">
            <Button 
              className="bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold font-heading rounded-full px-6 shadow-xl"
            >
              Connect Spotify
            </Button>
          </a>
        </div>
      )}

      {/* Hero Section */}
      <HeroSection onSearch={handleSearch}>
        {isSpotifyConnected && (
          <SpotifyTopArtists 
            onArtistClick={handleArtistClick} 
            compact 
            onError={() => {
              console.log("Spotify error detected in Home, showing connect button");
              setIsSpotifyConnected(false);
            }}
          />
        )}
      </HeroSection>
      
      {/* Global Spotlight Section */}
      <SpotlightSection />
      
      {/* How It Works Section */}
      <HowItWorksSection />
      
      {/* Artist Result Section (only shows after search) */}
      {artistData && (
        <>
          <ArtistResult artist={artistData} onArtistClick={handleArtistClick} />
          <div className="mb-32">
            <InfluenceWeb 
              centerArtist={artistData.name}
              influences={artistData.influences}
              influencedBy={artistData.influencedBy}
              accentColor={artistData.accentColor}
              onNodeClick={handleArtistClick}
            />
          </div>
        </>
      )}
      
      {/* Footer */}
      <footer className="py-12 px-8 text-center">
        <p className="text-muted-foreground text-sm font-sans">
          Built with obsession. Powered by curiosity.
        </p>
      </footer>
    </main>
  )
}

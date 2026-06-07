'use client'

import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { initSpotifyPlayer } from '@/lib/spotify-player'
import { 
  Music, 
  Users, 
  Copy, 
  LogOut, 
  Search, 
  Plus, 
  SkipForward, 
  Sparkles,
  Loader2,
  Play,
  Pause,
  RefreshCw,
  Clock,
  ExternalLink
} from 'lucide-react'

interface Room {
  id: string
  name: string
  genre: string
  code: string
  host_id: string
}

interface RoomQueue {
  id: string
  song_name: string
  artist_name: string
  youtube_video_id: string
  spotify_uri: string
  album_art: string
  added_by: string
  played: boolean
  votes_to_skip: string[]
}

interface RoomPlayback {
  room_id: string
  youtube_video_id: string | null
  spotify_uri: string | null
  song_name: string | null
  artist_name: string | null
  album_art: string | null
  is_playing: boolean
  playback_position: number
  duration_ms: number
  updated_at: string
}

interface RoomMember {
  id: string
  user_id: string
  joined_at: string
}

interface Reaction {
  id: string
  type: string
  x: number
}

export default function RoomPage() {
  const params = useParams()
  const code = params.code as string
  const router = useRouter()
  
  const [room, setRoom] = useState<Room | null>(null)
  const [queue, setQueue] = useState<RoomQueue[]>([])
  const [members, setMembers] = useState<RoomMember[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [aiSuggestion, setAiSuggestion] = useState<any>(null)
  const [isGettingAiSuggestion, setIsGettingAiSuggestion] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  const [playback, setPlayback] = useState<RoomPlayback | null>(null)
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [player, setPlayer] = useState<any>(null)
  const playbackRef = useRef<RoomPlayback | null>(null)
  const isAdvancingRef = useRef(false)

  const isHost = currentUser?.id && room?.host_id && currentUser.id === room.host_id

  // Fetch Spotify token on mount
  useEffect(() => {
    const fetchToken = async () => {
      const res = await fetch('/api/spotify/token')
      const data = await res.json()
      setSpotifyToken(data.token)
    }
    fetchToken()
  }, [])

  // Initialize Spotify Player for Host
  useEffect(() => {
    if (isHost && spotifyToken && !player) {
      console.log('DEBUG: Initializing Spotify Player for host...')
      const spotifyPlayer = initSpotifyPlayer(
        spotifyToken,
        (id) => {
          console.log('DEBUG: Spotify Player Ready with device_id:', id)
          setDeviceId(id)
        },
        async (state) => {
          if (!state) return
          
          // Update local playback state from player state if we are the host
          const { 
            paused, 
            position, 
            duration,
            track_window: { current_track }
          } = state

          // Only broadcast if there's a significant change or periodically
          // (Handled by the broadcast interval below for simplicity)
        }
      )
      setPlayer(spotifyPlayer)
    }
  }, [isHost, spotifyToken, player])

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (player) {
        player.disconnect()
      }
    }
  }, [player])

  // Update ref whenever playback changes to keep handlers stable
  useEffect(() => {
    playbackRef.current = playback
  }, [playback])

  useEffect(() => {
    if (currentUser && room) {
      console.log('DEBUG: Auth check', { userId: currentUser.id, hostId: room.host_id, isHost })
    }
  }, [currentUser, room, isHost])

  const fetchRoomData = useCallback(async () => {
    try {
      console.log('DEBUG: Fetching room data...')
      const response = await fetch(`/api/rooms/${code}`)
      if (!response.ok) throw new Error('Room not found')
      const data = await response.json()
      setRoom({ 
        id: data.id, 
        name: data.name, 
        genre: data.genre, 
        code: data.room_code,
        host_id: data.host_id 
      })
      setQueue(data.queue || [])
      setMembers(data.members || [])
      
      const { data: playbackData } = await supabase
        .from('room_playback')
        .select('*')
        .eq('room_id', data.id)
        .single()
      
      if (playbackData) {
        setPlayback(prev => {
          console.log("DEBUG: PLAYBACK UPDATE (fetchRoomData)", {
            source: "api_fetch",
            oldId: prev?.youtube_video_id,
            newId: playbackData.youtube_video_id,
            isPlaying: playbackData.is_playing
          })
          return playbackData
        })
      }
    } catch (error) {
      console.error('Error fetching room:', error)
      router.push('/rooms')
    } finally {
      setIsLoading(false)
    }
  }, [code, router])

  useEffect(() => {
    fetchRoomData()
  }, [fetchRoomData])

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setCurrentUser(user)
    }
    checkUser()
  }, [router])

  useEffect(() => {
    if (!currentUser || !room?.id) return

    const setupSubscriptions = () => {
      console.log('DEBUG: Setting up Supabase Realtime subscriptions...')
      
      const queueChannel = supabase.channel(`room_queue:${room.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_queue', filter: `room_id=eq.${room.id}` }, () => {
          fetchRoomData()
        })
        .subscribe()

      const membersChannel = supabase.channel(`room_members:${room.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${room.id}` }, () => {
          fetchRoomData()
        })
        .subscribe()

      const playbackChannel = supabase.channel(`room_playback:${room.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'room_playback', filter: `room_id=eq.${room.id}` }, (payload) => {
          const newPlayback = payload.new as any
          
          setPlayback(prev => {
            const merged = { ...prev } as any
            Object.keys(newPlayback).forEach(key => {
              if (newPlayback[key] !== undefined && newPlayback[key] !== null) {
                // Ignore empty strings for IDs
                if ((key === 'youtube_video_id' || key === 'spotify_uri') && newPlayback[key] === '') return
                merged[key] = newPlayback[key]
              }
            })
            
            console.log("SUBSCRIPTION UPDATE", {
              oldVideoId: prev?.youtube_video_id,
              oldSpotifyUri: prev?.spotify_uri,
              newId: merged.youtube_video_id,
              newSpotifyUri: merged.spotify_uri
            })

            return merged as RoomPlayback
          })
        })
        .subscribe()

      const reactionsChannel = supabase.channel(`room_reactions:${room.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_reactions', filter: `room_id=eq.${room.id}` }, (payload) => {
          const id = Math.random().toString(36).substring(7)
          const x = Math.floor(Math.random() * 80) + 10
          setReactions(prev => [...prev, { id, type: payload.new.type, x }])
          setTimeout(() => {
            setReactions(prev => prev.filter(r => r.id !== id))
          }, 3000)
        })
        .subscribe()

      return () => {
        queueChannel.unsubscribe()
        membersChannel.unsubscribe()
        playbackChannel.unsubscribe()
        reactionsChannel.unsubscribe()
      }
    }

    const joinRoom = async () => {
      await supabase.from('room_members').upsert({ room_id: room.id, user_id: currentUser.id }, { onConflict: 'room_id,user_id' })
    }

    const leaveRoom = async () => {
      await supabase.from('room_members').delete().eq('room_id', room.id).eq('user_id', currentUser.id)
    }

    joinRoom()
    const unsubscribe = setupSubscriptions()
    window.addEventListener('beforeunload', leaveRoom)

    return () => {
      leaveRoom()
      unsubscribe()
      window.removeEventListener('beforeunload', leaveRoom)
    }
  }, [currentUser, room?.id, fetchRoomData, isHost])

  // Host broadcast logic
  useEffect(() => {
    if (!isHost || !room?.id || !playback?.is_playing || !player) return

    const interval = setInterval(async () => {
      const state = await player.getCurrentState()
      if (state) {
        await supabase
          .from('room_playback')
          .update({ 
            playback_position: Math.floor(state.position / 1000), 
            duration_ms: state.duration,
            updated_at: new Date().toISOString() 
          })
          .eq('room_id', room.id)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [isHost, room?.id, playback?.is_playing, player])

  useEffect(() => {
    if (queue.length <= 1 && room?.id && !isGettingAiSuggestion && !aiSuggestion) {
      getAiSuggestion()
    } else if (queue.length > 1) {
      setAiSuggestion(null)
    }
  }, [queue.length, room?.id])

  const getAiSuggestion = useCallback(async () => {
    if (!room?.id) return
    console.log('DEBUG: Getting AI suggestion...')
    setIsGettingAiSuggestion(true)
    try {
      const response = await fetch('/api/rooms/ai-dj', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id })
      })
      const data = await response.json()
      if (!data.error) {
        console.log('DEBUG: AI Suggestion received:', data)
        setAiSuggestion(data)
      }
    } catch (error) {
      console.error('AI DJ Error:', error)
    } finally {
      setIsGettingAiSuggestion(false)
    }
  }, [room?.id])

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setIsSearching(true)
    try {
      const response = await fetch(`/api/spotify/search-tracks?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()
      setSearchResults(data)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery])

  const addToQueue = useCallback(async (track: any, startImmediately = false) => {
    if (!room?.id || !currentUser) return
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      console.log("DEBUG: Adding to queue", { title: track.name, uri: track.uri })
      const response = await fetch(`/api/rooms/${code}/queue`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          songName: track.name,
          artistName: track.artist,
          spotifyUri: track.uri,
          thumbnail: track.albumArt
        })
      })
      
      if (!response.ok) throw new Error('Failed to add to queue')

      const currentPlayback = playbackRef.current
      const isIdle = !currentPlayback?.spotify_uri || !currentPlayback.is_playing
      
      if ((isIdle || startImmediately) && isHost && deviceId) {
        console.log("DEBUG: Triggering Spotify playback for host", track.uri)
        
        // Start Spotify playback
        await fetch('/api/spotify/play', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uri: track.uri, deviceId })
        })

        // Update Supabase playback state
        const { data: existing } = await supabase
          .from('room_playback')
          .select('id')
          .eq('room_id', room.id)
          .single()

        if (existing) {
          await supabase
            .from('room_playback')
            .update({
              spotify_uri: track.uri,
              song_name: track.name,
              artist_name: track.artist,
              album_art: track.albumArt,
              is_playing: true,
              playback_position: 0,
              duration_ms: track.durationMs,
              updated_at: new Date().toISOString()
            })
            .eq('room_id', room.id)
        } else {
          await supabase
            .from('room_playback')
            .insert({
              room_id: room.id,
              spotify_uri: track.uri,
              song_name: track.name,
              artist_name: track.artist,
              album_art: track.albumArt,
              is_playing: true,
              playback_position: 0,
              duration_ms: track.durationMs,
              updated_at: new Date().toISOString()
            })
        }
      }

      setSearchQuery('')
      setSearchResults([])
      setAiSuggestion(null)
      fetchRoomData()
    } catch (error) {
      console.error('Error adding to queue:', error)
    }
  }, [room?.id, currentUser, code, fetchRoomData, isHost, deviceId])

  const addAiSuggestionToQueue = useCallback(async () => {
    if (!aiSuggestion || !room?.id) return
    console.log('DEBUG: Adding AI suggestion to queue via search...', aiSuggestion)
    setIsSearching(true)
    try {
      const searchQuery = `${aiSuggestion.songName} ${aiSuggestion.artistName}`
      const searchRes = await fetch(`/api/spotify/search-tracks?q=${encodeURIComponent(searchQuery)}`)
      const tracks = await searchRes.json()
      
      if (tracks && tracks.length > 0) {
        await addToQueue(tracks[0], true)
      } else {
        alert('Could not find a Spotify track for this suggestion.')
      }
    } catch (error) {
      console.error('Error adding AI suggestion:', error)
    } finally {
      setIsSearching(false)
    }
  }, [aiSuggestion, room?.id, addToQueue])

  const togglePlayback = useCallback(async () => {
    if (!isHost || !room?.id || !playbackRef.current || !player) return
    
    const currentPlayback = playbackRef.current

    if (!currentPlayback.spotify_uri && queue.length > 0) {
      const firstValidSong = queue.find(s => s.spotify_uri && s.spotify_uri !== '')
      if (firstValidSong) {
        await addToQueue(firstValidSong, true)
      }
      return
    }

    if (!currentPlayback.spotify_uri) return

    await player.togglePlay()
    const newState = !currentPlayback.is_playing
    
    await supabase
      .from('room_playback')
      .update({ is_playing: newState, updated_at: new Date().toISOString() })
      .eq('room_id', room.id)
  }, [isHost, room?.id, queue, player, addToQueue])

  const autoAdvanceWithAiDJ = useCallback(async () => {
    if (!isHost || !room?.id) return
    console.log('DEBUG: Queue empty, triggering auto-advance with AI DJ...')
    try {
      const suggestionRes = await fetch('/api/rooms/ai-dj', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id })
      })
      const suggestion = await suggestionRes.json()
      if (suggestion.error) throw new Error(suggestion.error)

      const searchQuery = `${suggestion.songName} ${suggestion.artistName}`
      const searchRes = await fetch(`/api/spotify/search-tracks?q=${encodeURIComponent(searchQuery)}`)
      const tracks = await searchRes.json()
      
      if (tracks && tracks.length > 0) {
        console.log("DEBUG: NEXT SONG FOUND (AI DJ)", tracks[0])
        await addToQueue(tracks[0], true)
      } else {
        console.warn("DEBUG: AI DJ failed to find replacement track")
        await supabase.from('room_playback').update({
          spotify_uri: null,
          song_name: null,
          artist_name: null,
          album_art: null,
          is_playing: false,
          playback_position: 0,
          duration_ms: 0,
          updated_at: new Date().toISOString()
        }).eq('room_id', room.id)
      }
    } catch (error) {
      console.error('DEBUG: autoAdvanceWithAiDJ failed:', error)
    }
  }, [isHost, room?.id, addToQueue])

  const skipToNext = useCallback(async () => {
    if (!isHost || !room?.id) return
    
    if (isAdvancingRef.current) {
      console.log("ADVANCE BLOCKED (Concurrency Guard)")
      return
    }
    
    isAdvancingRef.current = true
    console.log("ADVANCE START (skipToNext)", Date.now())
    
    try {
      const currentPlayback = playbackRef.current
      
      // 1. Fetch fresh queue first
      const response = await fetch(`/api/rooms/${code}`)
      if (!response.ok) throw new Error('Failed to fetch fresh room data')
      const data = await response.json()
      const freshQueue = data.queue || []

      // 2. Mark current as played
      if (currentPlayback?.spotify_uri) {
        const currentItem = freshQueue.find((s: any) => s.spotify_uri === currentPlayback.spotify_uri && !s.played)
        if (currentItem) {
          await fetch(`/api/rooms/${code}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mark_as_played', songId: currentItem.id })
          })
          currentItem.played = true
        }
      }

      // 3. Find next song
      const nextSong = freshQueue.find((s: any) => !s.played && s.spotify_uri)

      if (nextSong) {
        console.log("DEBUG: NEXT SONG FOUND (Skip)", nextSong)
        
        if (deviceId) {
          await fetch('/api/spotify/play', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uri: nextSong.spotify_uri, deviceId })
          })
        }

        await supabase
          .from('room_playback')
          .update({
            spotify_uri: nextSong.spotify_uri,
            song_name: nextSong.song_name,
            artist_name: nextSong.artist_name,
            album_art: nextSong.album_art,
            is_playing: true,
            playback_position: 0,
            updated_at: new Date().toISOString()
          })
          .eq('room_id', room.id)
      } else {
        await autoAdvanceWithAiDJ()
      }
      
      await fetchRoomData()
    } catch (err) {
      console.error("DEBUG: skipToNext failed", err)
    } finally {
      isAdvancingRef.current = false
    }
  }, [isHost, room?.id, code, fetchRoomData, autoAdvanceWithAiDJ, deviceId])

  const deleteRoom = async () => {
    if (!isHost || !room?.id) return
    if (!confirm('Are you sure you want to delete this room?')) return
    
    try {
      const response = await fetch(`/api/rooms/${code}`, { method: 'DELETE' })
      if (response.ok) router.push('/rooms')
    } catch (error) {
      console.error('Error deleting room:', error)
    }
  }

  const syncToHost = useCallback(() => {
    // For Spotify, we don't need manual sync as Supabase state is the source of truth
    fetchRoomData()
  }, [fetchRoomData])

  const playOnMySpotify = async () => {
    if (!playback?.spotify_uri) return
    try {
      const response = await fetch('/api/spotify/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri: playback.spotify_uri })
      })
      if (response.ok) {
        alert('Added to your Spotify queue!')
      } else {
        const error = await response.json()
        alert(`Failed to add to Spotify: ${error.error}`)
      }
    } catch (error) {
      console.error('Error adding to Spotify:', error)
    }
  }

  const sendReaction = async (type: string) => {
    if (!room?.id || !currentUser) return
    await supabase.from('room_reactions').insert({ room_id: room.id, user_id: currentUser.id, type })
  }

  const voteSkip = async (songId: string, currentVotes: string[]) => {
    if (!currentUser || !room?.id) return
    if (currentVotes.includes(currentUser.id)) return
    const newVotes = [...currentVotes, currentUser.id]
    
    if (newVotes.length >= members.length * 0.5) {
      await fetch(`/api/rooms/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_as_played', songId })
      })
      if (isHost) skipToNext()
    } else {
      await supabase.from('room_queue').update({ votes_to_skip: newVotes }).eq('id', songId)
    }
  }

  const copyCode = () => {
    navigator.clipboard.writeText(code)
    alert('Room code copied!')
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    )
  }

  const upcomingQueue = queue.filter(song => !song.played && song.spotify_uri !== playback?.spotify_uri)

  const progress = playback?.duration_ms ? (playback.playback_position * 1000 / playback.duration_ms) * 100 : 0

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-purple-500/30">
      <style jsx global>{`
        @keyframes float {
          0% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(-200px); opacity: 0; }
        }
        .reaction-float {
          animation: float 3s ease-out forwards;
        }
      `}</style>

      <div className="fixed inset-0 pointer-events-none z-50">
        {reactions.map(r => (
          <div key={r.id} className="absolute bottom-20 text-4xl reaction-float" style={{ left: `${r.x}%` }}>{r.type}</div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <h2 className="text-xl font-bold font-heading flex items-center gap-2">
            <Music className="text-purple-500" /> Now Playing
          </h2>
          
          <div className="space-y-4">
            <div className="aspect-square rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl shadow-purple-500/20 relative group">
              {playback?.album_art ? (
                <img 
                  src={playback.album_art} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                  alt={playback.song_name || ''} 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600 italic p-12 text-center">
                  {isHost ? 'Select a song from search or AI DJ to start playing' : 'Waiting for host to start playback'}
                </div>
              )}
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                <div className="w-full">
                  <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden mb-4">
                    <div 
                      className="h-full bg-purple-500 transition-all duration-1000" 
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                    <span>{Math.floor((playback?.playback_position || 0) / 60)}:{String((playback?.playback_position || 0) % 60).padStart(2, '0')}</span>
                    <span>{Math.floor((playback?.duration_ms || 0) / 60000)}:{String(Math.floor(((playback?.duration_ms || 0) % 60000) / 1000)).padStart(2, '0')}</span>
                  </div>
                </div>
              </div>
            </div>

            {playback?.song_name && (
              <div className="space-y-1">
                <h3 className="text-2xl font-black leading-tight tracking-tight">{playback.song_name}</h3>
                <p className="text-zinc-400 font-medium flex items-center gap-2">
                  {playback.artist_name}
                </p>
              </div>
            )}

            {isHost ? (
              <div className="flex gap-2">
                <Button onClick={togglePlayback} className="flex-1 bg-white text-black hover:bg-zinc-200 rounded-full py-6 font-bold">
                  {playback?.is_playing ? <Pause className="mr-2 h-5 w-5 fill-current" /> : <Play className="mr-2 h-5 w-5 fill-current" />}
                  {playback?.is_playing ? 'Pause' : 'Play'}
                </Button>
                <Button variant="outline" onClick={skipToNext} className="border-zinc-800 rounded-full w-14 h-14 p-0">
                  <SkipForward className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Button 
                  onClick={playOnMySpotify} 
                  className="w-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold rounded-full py-6"
                >
                  <ExternalLink className="mr-2 h-5 w-5" /> Play on my Spotify
                </Button>
                <Button variant="outline" className="w-full border-zinc-800 rounded-full" onClick={syncToHost}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Sync Room
                </Button>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-4">
              {['🔥', '😭', '🌊', '💀', '✨'].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className="w-10 h-10 flex items-center justify-center bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800/50 rounded-full transition-all hover:scale-110 active:scale-95 text-xl"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="relative">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search Spotify tracks..."
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-purple-500" />}
            </form>

            {searchResults.length > 0 && (
              <div className="absolute top-full mt-2 w-full bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden z-20 shadow-2xl backdrop-blur-xl">
                {searchResults.map((track) => (
                  <button
                    key={track.id}
                    onClick={() => addToQueue(track)}
                    className="w-full p-4 flex items-center gap-4 hover:bg-white/5 transition-colors text-left border-b border-zinc-800/50 last:border-0"
                  >
                    <img src={track.albumArt} className="w-12 h-12 rounded shadow-lg" alt="" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{track.name}</div>
                      <div className="text-sm text-zinc-400 truncate">{track.artist}</div>
                    </div>
                    <div className="flex items-center gap-2 text-zinc-500 text-xs font-mono">
                      <Clock className="h-3 w-3" />
                      {Math.floor(track.durationMs / 60000)}:{String(Math.floor((track.durationMs % 60000) / 1000)).padStart(2, '0')}
                    </div>
                    <Plus className="h-5 w-5 text-purple-500" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold font-heading">Upcoming Queue</h2>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {upcomingQueue.map((song) => (
                <div key={song.id} className="flex items-center gap-4 p-3 bg-zinc-900/50 border border-zinc-800/50 rounded-xl group hover:border-zinc-700 transition-all">
                  <img src={song.album_art} className="w-12 h-12 rounded-lg object-cover" alt="" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{song.song_name}</div>
                    <div className="text-sm text-zinc-500 truncate">{song.artist_name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-600">
                      {song.votes_to_skip?.length || 0}/{Math.ceil(members.length * 0.5)}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-full hover:bg-white/10"
                      onClick={() => voteSkip(song.id, song.votes_to_skip || [])}
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              {upcomingQueue.length === 0 && (
                <div className="py-12 text-center text-zinc-600 border border-dashed border-zinc-800 rounded-xl">
                  Queue is empty
                </div>
              )}
            </div>
          </div>

          {upcomingQueue.length === 0 && aiSuggestion && (
            <div className="bg-gradient-to-br from-purple-900/20 to-zinc-900 border border-purple-500/20 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-purple-400 font-bold">
                <Sparkles className="h-5 w-5" /> AI DJ Suggestion
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold">{aiSuggestion.songName}</h3>
                  <p className="text-zinc-400">{aiSuggestion.artistName}</p>
                  <p className="text-xs text-zinc-500 mt-2 italic">"{aiSuggestion.reason}"</p>
                </div>
                <Button 
                  onClick={addAiSuggestionToQueue}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Add to Queue
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-3 space-y-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
            <div>
              <h1 className="text-2xl font-bold font-heading text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">{room?.name}</h1>
              <p className="text-zinc-500 text-sm mt-1 uppercase tracking-wider">{room?.genre}</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Room Code</span>
                <button onClick={copyCode} className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 transition-colors">
                  <span className="font-mono font-bold">{code}</span>
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <Button variant="destructive" className="w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20" onClick={() => router.push('/rooms')}>
                <LogOut className="mr-2 h-4 w-4" /> Leave Room
              </Button>
              {isHost && (
                <Button variant="destructive" className="w-full mt-2" onClick={deleteRoom}>Delete Room</Button>
              )}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                <Users className="h-4 w-4" /> Members ({members.length})
              </h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-xs font-bold border border-zinc-700">
                      {member.user_id.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-zinc-300 truncate">
                        {member.user_id === currentUser?.id ? 'You' : `User ${member.user_id.substring(0, 5)}...`}
                      </span>
                      {member.user_id === room?.host_id && (
                        <span className="text-[10px] text-purple-500 font-bold uppercase tracking-tighter">Host</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

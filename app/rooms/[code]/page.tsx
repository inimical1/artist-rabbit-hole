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
  const deviceIdRef = useRef<string | null>(null)
  const [player, setPlayer] = useState<any>(null)
  const playbackRef = useRef<RoomPlayback | null>(null)
  const isAdvancingRef = useRef(false)

  const isHost = currentUser?.id && room?.host_id && currentUser.id === room.host_id

  // Fetch Spotify token on mount
  useEffect(() => {
    const fetchToken = async () => {
      const res = await fetch('/api/spotify/token')
      const data = await res.json()
      console.log("DEBUG: SPOTIFY TOKEN LOADED", { hasToken: !!data.token, isProduction: process.env.NODE_ENV === 'production' })
      setSpotifyToken(data.token)
    }
    fetchToken()
  }, [])

  // Initialize Spotify Player for Host
  useEffect(() => {
    if (isHost && spotifyToken && !player) {
      console.log('DEBUG: SPOTIFY PLAYER INITIALIZING', { isProduction: process.env.NODE_ENV === 'production' })
      const spotifyPlayer = initSpotifyPlayer(
        spotifyToken,
        async (id) => {
          console.log('DEBUG: SPOTIFY PLAYER READY', { deviceId: id })
          setDeviceId(id)
          deviceIdRef.current = id

          // Force transfer to browser
          console.log('DEBUG: Transferring playback to browser SDK...')
          await fetch('/api/spotify/play', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId: id, transferOnly: true })
          })
        },
        async (state) => {
          if (!state) return
          // Monitoring logic can go here
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
        setPlayback(playbackData)
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
          setPlayback(newPlayback as RoomPlayback)
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
      
      if ((isIdle || startImmediately) && isHost && deviceIdRef.current) {
        console.log("DEBUG: Triggering Spotify playback for host", track.uri)
        
        // Start Spotify playback
        await fetch('/api/spotify/play', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uri: track.uri, deviceId: deviceIdRef.current })
        })

        // Update Supabase playback state
        const { data: existing } = await supabase
          .from('room_playback')
          .select('id')
          .eq('room_id', room.id)
          .single()

        const playbackData = {
          room_id: room.id,
          spotify_uri: track.uri,
          song_name: track.name,
          artist_name: track.artist,
          album_art: track.albumArt,
          is_playing: true,
          playback_position: 0,
          duration_ms: track.durationMs,
          updated_at: new Date().toISOString()
        }

        if (existing) {
          await supabase.from('room_playback').update(playbackData).eq('room_id', room.id)
        } else {
          await supabase.from('room_playback').insert(playbackData)
        }
      }

      setSearchQuery('')
      setSearchResults([])
      setAiSuggestion(null)
      fetchRoomData()
    } catch (error) {
      console.error('Error adding to queue:', error)
    }
  }, [room?.id, currentUser, code, fetchRoomData, isHost])

  const addAiSuggestionToQueue = useCallback(async () => {
    if (!aiSuggestion || !room?.id) return
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
    if (!isHost || !room?.id || !playbackRef.current || !deviceIdRef.current) return
    
    const currentPlayback = playbackRef.current
    const newState = !currentPlayback.is_playing

    try {
      if (newState) {
        console.log('DEBUG: Host triggering PLAY API', { deviceId: deviceIdRef.current, uri: currentPlayback.spotify_uri })
        await fetch('/api/spotify/play', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uri: currentPlayback.spotify_uri, deviceId: deviceIdRef.current })
        })
      } else {
        console.log('DEBUG: Host triggering PAUSE API', { deviceId: deviceIdRef.current })
        await fetch('/api/spotify/pause', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: deviceIdRef.current })
        })
      }

      await supabase
        .from('room_playback')
        .update({ is_playing: newState, updated_at: new Date().toISOString() })
        .eq('room_id', room.id)
    } catch (err) {
      console.error('DEBUG: Playback toggle failed', err)
    }
  }, [isHost, room?.id])

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
        await addToQueue(tracks[0], true)
      } else {
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

    try {
      const { data: freshQueue } = await supabase
        .from('room_queue')
        .select('*')
        .eq('room_id', room.id)
        .eq('played', false)
        .order('created_at', { ascending: true })

      if (!freshQueue || freshQueue.length === 0) {
        await supabase.from('room_playback').update({ spotify_uri: null, song_name: null, artist_name: null, album_art: null, is_playing: false, playback_position: 0, duration_ms: 0 }).eq('room_id', room.id)
        console.log("DEBUG: Queue empty, waiting 5s before AI DJ...")
        setTimeout(() => autoAdvanceWithAiDJ(), 5000)
        return
      }

      const currentSong = freshQueue[0]
      await supabase.from('room_queue').update({ played: true }).eq('id', currentSong.id)

      const nextSong = freshQueue[1]
      if (nextSong) {
        console.log("DEBUG: PLAYING NEXT SONG", { uri: nextSong.spotify_uri, deviceId: deviceIdRef.current })
        await fetch('/api/spotify/play', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uri: nextSong.spotify_uri, deviceId: deviceIdRef.current })
        })

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
        await supabase.from('room_playback').update({ spotify_uri: null, song_name: null, artist_name: null, album_art: null, is_playing: false, playback_position: 0, duration_ms: 0 }).eq('room_id', room.id)
        console.log("DEBUG: No next song, waiting 5s before AI DJ...")
        setTimeout(() => autoAdvanceWithAiDJ(), 5000)
      }
      fetchRoomData()
    } catch (err) {
      console.error('skipToNext failed:', err)
    }
  }, [isHost, room?.id, supabase, fetchRoomData, autoAdvanceWithAiDJ])

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

  const syncToHost = useCallback(async () => {
    if (isHost || !playback) return
    console.log('DEBUG: Syncing to host...', { uri: playback.spotify_uri, isPlaying: playback.is_playing })

    try {
      if (playback.spotify_uri) {
        await fetch('/api/spotify/play', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uri: playback.spotify_uri, deviceId: 'current' })
        })

        if (!playback.is_playing) {
          await fetch('/api/spotify/pause', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId: 'current' })
          })
        }
      }
      alert('Synced to Host!')
    } catch (err) {
      console.error('DEBUG: Sync failed', err)
    }
  }, [isHost, playback])

  const playOnMySpotify = async () => {
    if (!playback?.spotify_uri) return
    try {
      const response = await fetch('/api/spotify/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uri: playback.spotify_uri })
      })
      if (response.ok) alert('Added to your Spotify queue!')
      else alert('Failed to add to Spotify')
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
        .reaction-float { animation: float 3s ease-out forwards; }
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
            <div className="aspect-square rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl relative group">
              {playback?.album_art ? (
                <img src={playback.album_art} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600 italic p-12 text-center">
                  {isHost ? 'Search a song to start playing' : 'Waiting for host...'}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent flex items-end p-6">
                <div className="w-full">
                  <div className="h-1 w-full bg-zinc-800 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-purple-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
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
                <h3 className="text-2xl font-black">{playback.song_name}</h3>
                <p className="text-zinc-400">{playback.artist_name}</p>
              </div>
            )}

            <div className="flex gap-2">
              {isHost ? (
                <>
                  <Button onClick={togglePlayback} className="flex-1 bg-white text-black hover:bg-zinc-200 rounded-full py-6 font-bold">
                    {playback?.is_playing ? <Pause className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5" />}
                    {playback?.is_playing ? 'Pause' : 'Play'}
                  </Button>
                  <Button variant="outline" onClick={skipToNext} className="border-zinc-800 rounded-full w-14 h-14 p-0">
                    <SkipForward className="h-5 w-5" />
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={syncToHost} className="flex-1 bg-purple-600 hover:bg-purple-700 rounded-full py-6 font-bold">
                    <RefreshCw className="mr-2 h-5 w-5" /> Sync To Host
                  </Button>
                  <Button onClick={playOnMySpotify} variant="outline" className="border-zinc-800 rounded-full px-6">
                    <ExternalLink className="h-5 w-5" />
                  </Button>
                </>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              {['🔥', '😭', '🌊', '💀', '✨'].map(emoji => (
                <button key={emoji} onClick={() => sendReaction(emoji)} className="w-10 h-10 flex items-center justify-center bg-zinc-900 border border-zinc-800 rounded-full transition-transform hover:scale-110 active:scale-95 text-xl">{emoji}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="relative">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search Spotify tracks..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-purple-500/50 outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-purple-500" />}
            </form>

            {searchResults.length > 0 && (
              <div className="absolute top-full mt-2 w-full bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden z-20 shadow-2xl">
                {searchResults.map((track) => (
                  <button key={track.id} onClick={() => addToQueue(track)} className="w-full p-4 flex items-center gap-4 hover:bg-zinc-800 transition-colors text-left border-b border-zinc-800/50 last:border-0">
                    <img src={track.albumArt} className="w-12 h-12 rounded" alt="" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{track.name}</div>
                      <div className="text-sm text-zinc-400 truncate">{track.artist}</div>
                    </div>
                    <Plus className="h-5 w-5 text-purple-500" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold">Upcoming Queue</h2>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {upcomingQueue.map((song) => (
                <div key={song.id} className="flex items-center gap-4 p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl group hover:border-zinc-700 transition-all">
                  <img src={song.album_art} className="w-12 h-12 rounded-lg object-cover" alt="" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{song.song_name}</div>
                    <div className="text-sm text-zinc-500 truncate">{song.artist_name}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-600">{song.votes_to_skip?.length || 0}/{Math.ceil(members.length * 0.5)}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => voteSkip(song.id, song.votes_to_skip || [])}><SkipForward className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
              {upcomingQueue.length === 0 && <div className="py-12 text-center text-zinc-600 border border-dashed border-zinc-800 rounded-xl">Queue is empty</div>}
            </div>
          </div>

          {upcomingQueue.length === 0 && aiSuggestion && (
            <div className="bg-purple-900/10 border border-purple-500/20 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-purple-400 font-bold"><Sparkles className="h-5 w-5" /> AI DJ Suggestion</div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold">{aiSuggestion.songName}</h3>
                  <p className="text-zinc-400">{aiSuggestion.artistName}</p>
                  <p className="text-xs text-zinc-500 mt-2 italic">"{aiSuggestion.reason}"</p>
                </div>
                <Button onClick={addAiSuggestionToQueue} className="bg-purple-600">Add</Button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-3 space-y-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 truncate">{room?.name}</h1>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center"><span className="text-zinc-400">Code</span><button onClick={copyCode} className="text-purple-400 flex items-center gap-1 font-bold font-mono">{code} <Copy className="h-3 w-3" /></button></div>
              <Button variant="destructive" className="w-full" onClick={() => router.push('/rooms')}>Leave Room</Button>
            </div>
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Users className="h-4 w-4" /> Members ({members.length})</h3>
              <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                {members.map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold">{m.user_id.substring(0,2).toUpperCase()}</div>
                    <span className="text-sm text-zinc-300 truncate">{m.user_id === currentUser?.id ? 'You' : `User ${m.user_id.substring(0,4)}`}</span>
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

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import YouTube, { YouTubePlayer } from 'react-youtube'
import { 
  Music, 
  Users, 
  Copy, 
  Search, 
  Plus, 
  SkipForward, 
  Sparkles,
  Loader2,
  Play,
  Pause,
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
  const [isLoading, setIsLoading] = useState(true)
  
  const [playback, setPlayback] = useState<RoomPlayback | null>(null)
  const [player, setPlayer] = useState<YouTubePlayer | null>(null)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  
  const playbackRef = useRef<RoomPlayback | null>(null)
  const failedVideoIdsRef = useRef<Set<string>>(new Set())
  const isAdvancingRef = useRef(false)
  const aiDjCooldownRef = useRef(0)

  const isHost = currentUser?.id && room?.host_id && currentUser.id === room.host_id

  useEffect(() => {
    playbackRef.current = playback
  }, [playback])

  const fetchRoomData = useCallback(async () => {
    try {
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
          console.log("REALTIME PLAYBACK UPDATE", newPlayback)
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

  // Host broadcast logic for YouTube position
  useEffect(() => {
    if (!isHost || !room?.id || !playback?.is_playing || !player || !isPlayerReady) return

    const interval = setInterval(async () => {
      try {
        const state = await player.getPlayerState()
        if (state === 1) { // PLAYING
          const position = await player.getCurrentTime()
          const duration = await player.getDuration()
          
          await supabase
            .from('room_playback')
            .update({ 
              playback_position: Math.floor(position), 
              duration_ms: Math.floor(duration * 1000),
              updated_at: new Date().toISOString() 
            })
            .eq('room_id', room.id)
        }
      } catch (err) {
        console.error('Error broadcasting state', err)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [isHost, room?.id, playback?.is_playing, player, isPlayerReady])

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setIsSearching(true)
    try {
      const response = await fetch(`/api/rooms/youtube-search?q=${encodeURIComponent(searchQuery)}`)
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
      
      const response = await fetch(`/api/rooms/${code}/queue`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          songName: track.title,
          artistName: track.channelName,
          youtubeVideoId: track.videoId,
          thumbnail: track.thumbnail
        })
      })
      
      if (!response.ok) throw new Error('Failed to add to queue')

      const currentPlayback = playbackRef.current
      const isIdle = !currentPlayback?.youtube_video_id || !currentPlayback.is_playing
      
      if ((isIdle || startImmediately) && isHost) {
        // Start YouTube playback
        const { data: existing } = await supabase
          .from('room_playback')
          .select('id')
          .eq('room_id', room.id)
          .single()

        const playbackData = {
          room_id: room.id,
          youtube_video_id: track.videoId,
          song_name: track.title,
          artist_name: track.channelName,
          album_art: track.thumbnail,
          is_playing: true,
          playback_position: 0,
          duration_ms: 0, // updated later
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

  const autoAdvanceWithAiDJ = useCallback(async () => {
    if (!isHost || !room?.id || isAdvancingRef.current) return
    
    const now = Date.now()
    if (now < aiDjCooldownRef.current) {
      console.log("AI DJ cooldown active")
      return
    }

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
      const searchRes = await fetch(`/api/rooms/youtube-search?q=${encodeURIComponent(searchQuery)}`)
      const tracks = await searchRes.json()
      
      if (tracks && tracks.length > 0) {
        await addToQueue(tracks[0], true)
      } else {
        console.log("No playable candidates found for AI suggestion, starting 60s cooldown")
        aiDjCooldownRef.current = Date.now() + 60000
        await supabase.from('room_playback').update({
          youtube_video_id: null,
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
      aiDjCooldownRef.current = Date.now() + 60000
    }
  }, [isHost, room?.id, addToQueue])

  const skipToNext = useCallback(async () => {
    if (!isHost || !room?.id || isAdvancingRef.current) {
      console.log("ADVANCING (skipToNext locked or not host)", isAdvancingRef.current)
      return
    }
    isAdvancingRef.current = true
    console.log("SKIP START")
    console.log("CURRENT PLAYBACK", playbackRef.current?.youtube_video_id)

    try {
      const { data: freshQueue } = await supabase
        .from('room_queue')
        .select('*')
        .eq('room_id', room.id)
        .eq('played', false)
        .order('created_at', { ascending: true })

      if (!freshQueue) throw new Error("Could not fetch queue")
      
      console.log("QUEUE", freshQueue.map(s => ({
        id: s.youtube_video_id,
        played: s.played
      })))

      if (freshQueue.length === 0) {
        await supabase.from('room_playback').update({ youtube_video_id: null, song_name: null, artist_name: null, album_art: null, is_playing: false, playback_position: 0, duration_ms: 0 }).eq('room_id', room.id)
        setTimeout(() => {
          isAdvancingRef.current = false
          autoAdvanceWithAiDJ()
        }, 3000)
        return
      }

      // Mark the current playing/failed one as played
      const currentSong = freshQueue[0]
      await supabase.from('room_queue').update({ played: true }).eq('id', currentSong.id)

      // Find the next VALID song not in the blacklist
      let nextSong = null
      let currentIndex = 1
      while (currentIndex < freshQueue.length) {
        const candidate = freshQueue[currentIndex]
        if (candidate.youtube_video_id && !failedVideoIdsRef.current.has(candidate.youtube_video_id)) {
          nextSong = candidate
          break
        }
        console.log("BLACKLIST (skipping blacklisted video)", candidate.youtube_video_id)
        // Mark failed ones in queue as played so we don't try them again
        await supabase.from('room_queue').update({ played: true }).eq('id', candidate.id)
        currentIndex++
      }

      console.log("NEXT SONG CHOSEN", nextSong)

      if (nextSong) {
        const result = await supabase
          .from('room_playback')
          .update({
            youtube_video_id: nextSong.youtube_video_id,
            song_name: nextSong.song_name,
            artist_name: nextSong.artist_name,
            album_art: nextSong.album_art,
            is_playing: true,
            playback_position: 0,
            updated_at: new Date().toISOString()
          })
          .eq('room_id', room.id)
        
        console.log("PLAYBACK UPDATE RESULT", result)
      } else {
        await supabase.from('room_playback').update({ youtube_video_id: null, song_name: null, artist_name: null, album_art: null, is_playing: false, playback_position: 0, duration_ms: 0 }).eq('room_id', room.id)
        setTimeout(() => {
          isAdvancingRef.current = false
          autoAdvanceWithAiDJ()
        }, 3000)
      }
      fetchRoomData()
    } catch (err) {
      console.error('skipToNext failed:', err)
    } finally {
      setTimeout(() => {
        isAdvancingRef.current = false
      }, 1000)
    }
  }, [isHost, room?.id, supabase, fetchRoomData, autoAdvanceWithAiDJ])

  const togglePlayback = useCallback(async () => {
    if (!isHost || !room?.id || !playbackRef.current) return
    
    const currentPlayback = playbackRef.current
    const newState = !currentPlayback.is_playing

    try {
      await supabase
        .from('room_playback')
        .update({ is_playing: newState, updated_at: new Date().toISOString() })
        .eq('room_id', room.id)
    } catch (err) {
      console.error('DEBUG: Playback toggle failed', err)
    }
  }, [isHost, room?.id])

  // YouTube Event Handlers
  const onPlayerReady = (event: any) => {
    console.log("PLAYER READY", event.target.getVideoData()?.video_id)
    setPlayer(event.target)
    setIsPlayerReady(true)
    if (playbackRef.current?.is_playing && isHost) {
      event.target.playVideo()
    }
  }

  const onPlayerStateChange = (event: any) => {
    if (!isHost) return
    // ENDED
    if (event.data === YouTube.PlayerState.ENDED) {
      skipToNext()
    }
  }

  const onPlayerError = (event: any) => {
    if (!isHost) return
    console.log("PLAYER ERROR", event.data, playbackRef.current?.youtube_video_id)
    // 150/101 = embedding restricted or video unplayable
    if (event.data === 150 || event.data === 101) {
      console.log('Video restricted, skipping to next valid item...')
      const currentVideoId = playbackRef.current?.youtube_video_id
      if (currentVideoId) {
        failedVideoIdsRef.current.add(currentVideoId)
        console.log("BLACKLIST (added)", Array.from(failedVideoIdsRef.current))
      }
      skipToNext()
    }
  }

  // Non-host users watch the playback position state
  useEffect(() => {
    if (isHost || !player || !isPlayerReady || !playback) return
    
    if (playback.is_playing) {
      player.playVideo()
      // Sync position if we drift more than 3 seconds
      player.getCurrentTime().then((time: number) => {
        if (Math.abs(time - playback.playback_position) > 3) {
          player.seekTo(playback.playback_position, true)
        }
      })
    } else {
      player.pauseVideo()
    }
  }, [isHost, playback?.is_playing, playback?.playback_position, player, isPlayerReady])

  const addAiSuggestionToQueue = useCallback(async () => {
    if (!aiSuggestion || !room?.id) return
    setIsSearching(true)
    try {
      const searchQuery = `${aiSuggestion.songName} ${aiSuggestion.artistName}`
      const searchRes = await fetch(`/api/rooms/youtube-search?q=${encodeURIComponent(searchQuery)}`)
      const tracks = await searchRes.json()
      
      if (tracks && tracks.length > 0) {
        await addToQueue(tracks[0], true)
      } else {
        alert('Could not find a YouTube track for this suggestion.')
      }
    } catch (error) {
      console.error('Error adding AI suggestion:', error)
    } finally {
      setIsSearching(false)
    }
  }, [aiSuggestion, room?.id, addToQueue])

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

  const upcomingQueue = queue.filter(song => !song.played && song.youtube_video_id !== playback?.youtube_video_id)
  const progress = playback?.duration_ms ? (playback.playback_position * 1000 / playback.duration_ms) * 100 : 0

  console.log("YOUTUBE RENDER", playback?.youtube_video_id)

  const youtubeOpts = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      origin: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
    },
  }

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
            <div className="aspect-video rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl relative group">
              {playback?.youtube_video_id ? (
                <div className="w-full h-full relative pointer-events-none">
                   <YouTube 
                     videoId={playback.youtube_video_id} 
                     opts={youtubeOpts} 
                     onReady={onPlayerReady}
                     onStateChange={onPlayerStateChange}
                     onError={onPlayerError}
                     className="absolute inset-0 w-full h-full"
                   />
                   <div className="absolute inset-0 bg-transparent z-10" />
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600 italic p-12 text-center">
                  {isHost ? 'Search a song to start playing' : 'Waiting for host...'}
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent flex items-end p-6 z-20 pointer-events-none">
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
              {isHost && (
                <>
                  <Button onClick={togglePlayback} className="flex-1 bg-white text-black hover:bg-zinc-200 rounded-full py-6 font-bold">
                    {playback?.is_playing ? <Pause className="mr-2 h-5 w-5" /> : <Play className="mr-2 h-5 w-5" />}
                    {playback?.is_playing ? 'Pause' : 'Play'}
                  </Button>
                  <Button variant="outline" onClick={skipToNext} className="border-zinc-800 rounded-full w-14 h-14 p-0">
                    <SkipForward className="h-5 w-5" />
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
                placeholder="Search YouTube..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-purple-500/50 outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-purple-500" />}
            </form>

            {searchResults.length > 0 && (
              <div className="absolute top-full mt-2 w-full bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden z-20 shadow-2xl">
                {searchResults.map((track) => (
                  <button key={track.videoId} onClick={() => addToQueue(track)} className="w-full p-4 flex items-center gap-4 hover:bg-zinc-800 transition-colors text-left border-b border-zinc-800/50 last:border-0">
                    <img src={track.thumbnail} className="w-12 h-12 rounded object-cover" alt="" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{track.title}</div>
                      <div className="text-sm text-zinc-400 truncate">{track.channelName}</div>
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

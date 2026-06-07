'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import YouTube from 'react-youtube'
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
  ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
  album_art: string
  added_by: string
  played: boolean
  votes_to_skip: string[]
}

interface RoomPlayback {
  room_id: string
  youtube_video_id: string | null
  song_name: string | null
  artist_name: string | null
  is_playing: boolean
  playback_position: number
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
  const playerRef = useRef<any>(null)
  const isHost = currentUser?.id === room?.host_id

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
      
      // Fetch initial playback state
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
          const newPlayback = payload.new as RoomPlayback
          setPlayback(newPlayback)
          
          if (!isHost && playerRef.current) {
            const player = playerRef.current
            // Sync play/pause
            if (newPlayback.is_playing) {
              player.playVideo()
            } else {
              player.pauseVideo()
            }
            
            // Sync timestamp if more than 2 seconds off
            const currentTime = player.getCurrentTime()
            if (Math.abs(currentTime - newPlayback.playback_position) > 2) {
              player.seekTo(newPlayback.playback_position)
            }
          }
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
      await supabase.from('room_members').upsert(
        { room_id: room.id, user_id: currentUser.id }, 
        { onConflict: 'room_id,user_id' }
      )
    }

    const leaveRoom = async () => {
      await supabase.from('room_members')
        .delete()
        .eq('room_id', room.id)
        .eq('user_id', currentUser.id)
    }

    joinRoom()
    const unsubscribe = setupSubscriptions()

    const handleBeforeUnload = () => {
      leaveRoom()
    }
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      leaveRoom()
      unsubscribe()
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [currentUser, room?.id, fetchRoomData, isHost])

  // Host broadcast logic
  useEffect(() => {
    if (!isHost || !room?.id || !playback?.is_playing) return

    const interval = setInterval(async () => {
      if (playerRef.current) {
        const currentTime = playerRef.current.getCurrentTime()
        await supabase
          .from('room_playback')
          .update({ playback_position: currentTime, updated_at: new Date().toISOString() })
          .eq('room_id', room.id)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [isHost, room?.id, playback?.is_playing])

  useEffect(() => {
    if (queue.length <= 1 && room?.id && !isGettingAiSuggestion && !aiSuggestion) {
      getAiSuggestion()
    } else if (queue.length > 1) {
      setAiSuggestion(null)
    }
  }, [queue.length, room?.id])

  const getAiSuggestion = async () => {
    if (!room?.id) return
    setIsGettingAiSuggestion(true)
    try {
      const response = await fetch('/api/rooms/ai-dj', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id })
      })
      const data = await response.json()
      if (!data.error) setAiSuggestion(data)
    } catch (error) {
      console.error('AI DJ Error:', error)
    } finally {
      setIsGettingAiSuggestion(false)
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
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
  }

  const addToQueue = async (video: any) => {
    if (!room?.id || !currentUser) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      await fetch(`/api/rooms/${code}/queue`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          songName: video.title,
          artistName: video.channelName,
          youtubeVideoId: video.videoId,
          thumbnail: video.thumbnail
        })
      })
      
      // If nothing is playing, update playback to this song
      if (!playback?.youtube_video_id) {
        await supabase
          .from('room_playback')
          .update({
            youtube_video_id: video.videoId,
            song_name: video.title,
            artist_name: video.channelName,
            is_playing: true,
            playback_position: 0
          })
          .eq('room_id', room.id)
      }

      setSearchQuery('')
      setSearchResults([])
      setAiSuggestion(null)
    } catch (error) {
      console.error('Error adding to queue:', error)
    }
  }

  const togglePlayback = async () => {
    if (!isHost || !room?.id || !playback) return
    const newState = !playback.is_playing
    await supabase
      .from('room_playback')
      .update({ is_playing: newState })
      .eq('room_id', room.id)
  }

  const skipToNext = async () => {
    if (!isHost || !room?.id) return
    
    // Mark current song as played
    if (queue[0]) {
      await fetch(`/api/rooms/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_as_played', songId: queue[0].id })
      })
    }

    // Get next song
    const nextSong = queue[1]
    if (nextSong) {
      await supabase
        .from('room_playback')
        .update({
          youtube_video_id: nextSong.youtube_video_id,
          song_name: nextSong.song_name,
          artist_name: nextSong.artist_name,
          is_playing: true,
          playback_position: 0
        })
        .eq('room_id', room.id)
    } else {
      await supabase
        .from('room_playback')
        .update({
          youtube_video_id: null,
          song_name: null,
          artist_name: null,
          is_playing: false,
          playback_position: 0
        })
        .eq('room_id', room.id)
    }
  }

  const syncToHost = () => {
    if (playerRef.current && playback) {
      playerRef.current.seekTo(playback.playback_position)
      if (playback.is_playing) {
        playerRef.current.playVideo()
      } else {
        playerRef.current.pauseVideo()
      }
    }
  }

  const onPlayerReady = (event: any) => {
    playerRef.current = event.target
    if (playback) {
      event.target.seekTo(playback.playback_position)
      if (playback.is_playing) {
        event.target.playVideo()
      } else {
        event.target.pauseVideo()
      }
    }
  }

  const onPlayerStateChange = async (event: any) => {
    if (!isHost) return
    
    // 1 = playing, 2 = paused
    if (event.data === 1 && !playback?.is_playing) {
      await supabase.from('room_playback').update({ is_playing: true }).eq('room_id', room!.id)
    } else if (event.data === 2 && playback?.is_playing) {
      await supabase.from('room_playback').update({ is_playing: false }).eq('room_id', room!.id)
    }
  }

  const onPlayerEnd = () => {
    if (isHost) {
      skipToNext()
    }
  }

  const sendReaction = async (type: string) => {
    if (!room?.id || !currentUser) return
    await supabase.from('room_reactions').insert({
      room_id: room.id,
      user_id: currentUser.id,
      type
    })
  }

  const voteSkip = async (songId: string, currentVotes: string[]) => {
    if (!currentUser || !room?.id) return
    if (currentVotes.includes(currentUser.id)) return

    const newVotes = [...currentVotes, currentUser.id]
    
    if (newVotes.length >= members.length * 0.5) {
      // Mark as played
      await fetch(`/api/rooms/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_as_played', songId })
      })
      if (isHost) skipToNext()
    } else {
      await supabase.from('room_queue')
        .update({ votes_to_skip: newVotes })
        .eq('id', songId)
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

  const upcomingQueue = queue.slice(1)

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

      {/* Reactions Layer */}
      <div className="fixed inset-0 pointer-events-none z-50">
        {reactions.map(r => (
          <div 
            key={r.id} 
            className="absolute bottom-20 text-4xl reaction-float"
            style={{ left: `${r.x}%` }}
          >
            {r.type}
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Now Playing */}
        <div className="lg:col-span-4 space-y-6">
          <h2 className="text-xl font-bold font-heading flex items-center gap-2">
            <Music className="text-purple-500" /> Now Playing
          </h2>
          
          <div className="space-y-4">
            <div className="aspect-video rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl shadow-purple-500/10">
              {playback?.youtube_video_id ? (
                <YouTube
                  videoId={playback.youtube_video_id}
                  onReady={onPlayerReady}
                  onStateChange={onPlayerStateChange}
                  onEnd={onPlayerEnd}
                  opts={{
                    width: '100%',
                    height: '100%',
                    playerVars: {
                      autoplay: 1,
                      controls: isHost ? 1 : 0,
                      disablekb: isHost ? 0 : 1,
                      fs: 0,
                      modestbranding: 1,
                      rel: 0
                    }
                  }}
                  className="w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600 italic">
                  Waiting for host to start playback
                </div>
              )}
            </div>

            {playback?.song_name && (
              <div className="space-y-2">
                <h3 className="text-xl font-bold leading-tight">{playback.song_name}</h3>
                <p className="text-zinc-400">{playback.artist_name}</p>
              </div>
            )}

            {isHost ? (
              <div className="flex gap-2">
                <Button 
                  onClick={togglePlayback}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  {playback?.is_playing ? <><Pause className="mr-2 h-4 w-4" /> Pause</> : <><Play className="mr-2 h-4 w-4" /> Play</>}
                </Button>
                <Button 
                  variant="outline"
                  onClick={skipToNext}
                  className="border-zinc-800"
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button 
                variant="outline" 
                className="w-full border-zinc-800"
                onClick={syncToHost}
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Sync to Host
              </Button>
            )}

            <div className="flex flex-wrap gap-2 pt-4">
              {['🔥', '😭', '🌊', '💀', '✨'].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className="w-10 h-10 flex items-center justify-center bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full transition-all hover:scale-110 active:scale-95 text-xl"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {queue[0] && (
              <Button 
                variant="outline" 
                className="w-full border-zinc-800 hover:bg-zinc-900 text-zinc-300"
                onClick={() => voteSkip(queue[0].id, queue[0].votes_to_skip || [])}
              >
                <SkipForward className="mr-2 h-4 w-4" /> 
                Vote Skip ({queue[0].votes_to_skip?.length || 0}/{Math.ceil(members.length * 0.5)})
              </Button>
            )}
          </div>
        </div>

        {/* Centre Column: Queue */}
        <div className="lg:col-span-5 space-y-6">
          <div className="relative">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search YouTube Music..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-purple-500" />}
            </form>

            {searchResults.length > 0 && (
              <div className="absolute top-full mt-2 w-full bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden z-20 shadow-2xl">
                {searchResults.map((video) => (
                  <button
                    key={video.videoId}
                    onClick={() => addToQueue(video)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-zinc-800 transition-colors text-left border-b border-zinc-800 last:border-0"
                  >
                    <img src={video.thumbnail} className="w-12 h-12 rounded object-cover" alt="" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{video.title}</div>
                      <div className="text-xs text-zinc-500 truncate">{video.channelName}</div>
                    </div>
                    <Plus className="h-4 w-4 text-zinc-400" />
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
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => voteSkip(song.id, song.votes_to_skip || [])}
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
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
                  onClick={() => addToQueue({ 
                    title: aiSuggestion.songName, 
                    channelName: aiSuggestion.artistName,
                    videoId: aiSuggestion.youtubeVideoId || '', // Assuming AI DJ might provide this soon
                    thumbnail: '/placeholder.svg'
                  })}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Add to Queue
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Room Info */}
        <div className="lg:col-span-3 space-y-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
            <div>
              <h1 className="text-2xl font-bold font-heading text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                {room?.name}
              </h1>
              <p className="text-zinc-500 text-sm mt-1 uppercase tracking-wider">{room?.genre}</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Room Code</span>
                <button 
                  onClick={copyCode}
                  className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 transition-colors"
                >
                  <span className="font-mono font-bold">{code}</span>
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <Button 
                variant="destructive" 
                className="w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20"
                onClick={() => router.push('/rooms')}
              >
                <LogOut className="mr-2 h-4 w-4" /> Leave Room
              </Button>
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

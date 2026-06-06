'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { 
  Music, 
  Users, 
  Copy, 
  LogOut, 
  Search, 
  Plus, 
  SkipForward, 
  Sparkles,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Room {
  id: string
  name: string
  genre: string
  code: string
}

interface RoomQueue {
  id: string
  song_name: string
  artist_name: string
  spotify_uri: string
  album_art: string
  added_by: string
  played: boolean
  votes_to_skip: string[]
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

  const fetchRoomData = useCallback(async () => {
    try {
      const response = await fetch(`/api/rooms/${code}`)
      if (!response.ok) throw new Error('Room not found')
      const data = await response.json()
      setRoom({ id: data.id, name: data.name, genre: data.genre, code: data.code })
      setQueue(data.queue || [])
      setMembers(data.members || [])
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
  }, [currentUser, room?.id, fetchRoomData])

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
      const response = await fetch(`/api/spotify/search?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()
      setSearchResults(data)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const addToQueue = async (track: any) => {
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
          songName: track.name,
          artistName: track.artist,
          spotifyUri: track.uri,
          albumArt: track.albumArt
        })
      })
      
      setSearchQuery('')
      setSearchResults([])
      setAiSuggestion(null)
    } catch (error) {
      console.error('Error adding to queue:', error)
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
    } else {
      await supabase.from('room_queue')
        .update({ votes_to_skip: newVotes })
        .eq('id', songId)
    }
  }

  const addToSpotify = async (uri: string) => {
    try {
      const response = await fetch(`/api/spotify/queue?uri=${encodeURIComponent(uri)}`, {
        method: 'POST'
      })
      if (response.ok) {
        alert('Added to your Spotify queue!')
      } else {
        const data = await response.json()
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Spotify queue error:', error)
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

  const nowPlaying = queue[0]
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
        <div className="lg:col-span-3 space-y-6">
          <h2 className="text-xl font-bold font-heading flex items-center gap-2">
            <Music className="text-purple-500" /> Now Playing
          </h2>
          {nowPlaying ? (
            <div className="space-y-4">
              <div className="aspect-square rounded-xl overflow-hidden bg-zinc-900 border border-zinc-800 shadow-2xl shadow-purple-500/10">
                <img src={nowPlaying.album_art} alt={nowPlaying.song_name} className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="text-lg font-bold truncate">{nowPlaying.song_name}</h3>
                <p className="text-zinc-400 truncate">{nowPlaying.artist_name}</p>
              </div>
              <div className="flex flex-wrap gap-2 pt-4">
                {['🔥', '😭', '🌊', '💀', '✨'].map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => sendReaction(emoji)}
                    className="w-12 h-12 flex items-center justify-center bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full transition-all hover:scale-110 active:scale-95 text-2xl"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <Button 
                variant="outline" 
                className="w-full border-zinc-800 hover:bg-zinc-900 text-zinc-300"
                onClick={() => voteSkip(nowPlaying.id, nowPlaying.votes_to_skip || [])}
              >
                <SkipForward className="mr-2 h-4 w-4" /> 
                Vote Skip ({nowPlaying.votes_to_skip?.length || 0}/{Math.ceil(members.length * 0.5)})
              </Button>
              <Button 
                variant="ghost" 
                className="w-full text-zinc-500 hover:text-white"
                onClick={() => addToSpotify(nowPlaying.spotify_uri)}
              >
                <ExternalLink className="mr-2 h-4 w-4" /> Add to Spotify
              </Button>
            </div>
          ) : (
            <div className="aspect-square rounded-xl bg-zinc-900/50 border border-dashed border-zinc-800 flex items-center justify-center text-zinc-600 italic">
              Nothing playing yet
            </div>
          )}
        </div>

        {/* Centre Column: Queue */}
        <div className="lg:col-span-6 space-y-6">
          <div className="relative">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search tracks to add..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-purple-500" />}
            </form>

            {searchResults.length > 0 && (
              <div className="absolute top-full mt-2 w-full bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden z-20 shadow-2xl">
                {searchResults.map((track) => (
                  <button
                    key={track.id}
                    onClick={() => addToQueue(track)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-zinc-800 transition-colors text-left border-b border-zinc-800 last:border-0"
                  >
                    <img src={track.albumArt} className="w-10 h-10 rounded" alt="" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{track.name}</div>
                      <div className="text-xs text-zinc-500 truncate">{track.artist}</div>
                    </div>
                    <Plus className="h-4 w-4 text-zinc-400" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold font-heading">Upcoming Queue</h2>
            <div className="space-y-2">
              {upcomingQueue.map((song) => (
                <div key={song.id} className="flex items-center gap-4 p-3 bg-zinc-900/50 border border-zinc-800/50 rounded-xl group hover:border-zinc-700 transition-all">
                  <img src={song.album_art} className="w-12 h-12 rounded-lg" alt="" />
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
                    name: aiSuggestion.songName, 
                    artist: aiSuggestion.artistName,
                    albumArt: '/placeholder.svg' // We don't have album art for suggestion yet
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
                    <span className="text-sm text-zinc-300 truncate">
                      {member.user_id === currentUser?.id ? 'You' : `User ${member.user_id.substring(0, 5)}...`}
                    </span>
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

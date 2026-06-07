'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { UserMenu } from '@/components/user-menu'
import { Plus, Music, Users, X } from 'lucide-react'
import Link from 'next/link'

interface Room {
  id: string
  name: string
  genre: string
  code: string
  memberCount: number
  currentSong: {
    song_name: string
    artist_name: string
    album_art: string
  } | null
}

const GENRES = ['Rock', 'Pop', 'Electronic', 'Jazz', 'Hip Hop', 'R&B', 'Classical', 'Metal', 'Lofi']

export default function RoomsLobby() {
  const router = useRouter()
  const [rooms, setRooms] = useState<Room[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [joinCode, setJoinCode] = useState('')

  // Create Room Form State
  const [roomName, setRoomName] = useState('')
  const [selectedGenre, setSelectedGenre] = useState(GENRES[0])
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)
      fetchRooms()
    }
    checkAuth()
  }, [router])

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms')
      const data = await res.json()
      if (Array.isArray(data)) {
        setRooms(data)
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomName || !selectedGenre) return

    setIsCreating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ name: roomName, genre: selectedGenre }),
      })
      const data = await res.json()
      if (data.room_code) {
        router.push(`/rooms/${data.room_code}`)
      } else if (data.code) {
        router.push(`/rooms/${data.code}`)
      }
    } catch (error) {
      console.error('Failed to create room:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault()
    if (joinCode.length === 6) {
      router.push(`/rooms/${joinCode.toUpperCase()}`)
    }
  }

  if (!user && !isLoading) return null

  return (
    <main className="relative min-h-screen bg-background text-foreground p-8 overflow-x-hidden">
      {/* Grain overlay */}
      <div className="grain-overlay" />

      {/* Header */}
      <div className="flex justify-between items-center mb-12 relative z-10 max-w-7xl mx-auto">
        <Link href="/">
          <h1 className="text-xl md:text-2xl font-bold font-heading tracking-tighter hover:text-primary transition-colors">
            ARTIST <span className="text-primary">RABBIT HOLE</span>
          </h1>
        </Link>
        <UserMenu />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h2 className="text-4xl md:text-5xl font-bold font-heading mb-2 tracking-tight">Lobby</h2>
            <p className="text-muted-foreground font-sans max-w-md">Join a room to listen and discover music with others in real-time.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
             <form onSubmit={handleJoinRoom} className="flex gap-2">
                <input
                  type="text"
                  placeholder="6-char code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="bg-card border border-border rounded-lg px-4 py-2 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-36 transition-all"
                />
                <Button 
                  type="submit" 
                  disabled={joinCode.length !== 6}
                  variant="secondary"
                  className="font-heading"
                >
                  Join
                </Button>
             </form>

            <Button onClick={() => setIsModalOpen(true)} className="font-heading gap-2 shadow-lg shadow-primary/20">
              <Plus className="size-4" />
              Create Room
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-48 rounded-2xl bg-card animate-pulse border border-border" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.length > 0 ? (
              rooms.map((room) => (
                <Link href={`/rooms/${room.code}`} key={room.id} className="group">
                  <div className="bg-card border border-border rounded-2xl p-6 h-full flex flex-col hover:border-primary/50 transition-all duration-300 hover:translate-y-[-4px] hover:shadow-2xl hover:shadow-primary/10">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-xl font-bold font-heading group-hover:text-primary transition-colors leading-tight mb-1">{room.name}</h3>
                        <span className="text-[10px] font-mono uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">{room.genre}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground bg-background/50 px-2 py-1 rounded-full border border-border">
                        <Users className="size-3" />
                        <span className="text-xs font-mono">{room.memberCount}</span>
                      </div>
                    </div>

                    <div className="mt-auto">
                      {room.currentSong ? (
                        <div className="flex items-center gap-3 bg-background/50 p-3 rounded-xl border border-border/50 group-hover:bg-background/80 transition-colors">
                          <div className="relative size-12 shrink-0">
                            {room.currentSong.album_art ? (
                               <img src={room.currentSong.album_art} alt={room.currentSong.song_name} className="size-full rounded-lg object-cover shadow-lg" />
                            ) : (
                               <div className="size-full bg-muted rounded-lg flex items-center justify-center">
                                 <Music className="size-6 text-muted-foreground opacity-20" />
                               </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 size-4 bg-primary rounded-full flex items-center justify-center border-2 border-card">
                              <div className="size-1.5 bg-white rounded-full animate-pulse" />
                            </div>
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-sm font-bold truncate group-hover:text-primary transition-colors">{room.currentSong.song_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{room.currentSong.artist_name}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-3 text-muted-foreground italic text-sm bg-background/20 rounded-xl border border-dashed border-border/50">
                          <Music className="size-4 opacity-50" />
                          <span>Waiting for tracks...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="col-span-full py-24 text-center bg-card/30 border border-dashed border-border rounded-3xl">
                <div className="relative size-20 mx-auto mb-6">
                   <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
                   <Music className="relative size-full text-muted-foreground opacity-20" />
                </div>
                <h3 className="text-2xl font-bold font-heading mb-2">The Lobby is Empty</h3>
                <p className="text-muted-foreground mb-8 max-w-xs mx-auto">Be the pioneer and start the first listening session in the Rabbit Hole.</p>
                <Button onClick={() => setIsModalOpen(true)} size="lg" className="font-heading">
                  Create the First Room
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Simple Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-background/80 backdrop-blur-xl animate-in fade-in duration-300"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="bg-card border border-border w-full max-w-md rounded-3xl shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] relative z-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-border flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold font-heading">New Room</h3>
                <p className="text-sm text-muted-foreground">Define your musical space</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="size-10 flex items-center justify-center rounded-full bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                <X className="size-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateRoom} className="p-8 space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-mono uppercase tracking-widest text-primary font-bold">Room Name</label>
                <input
                  autoFocus
                  type="text"
                  required
                  placeholder="e.g. Midnight Jazz Club"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full bg-background/50 border border-border rounded-xl px-5 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all font-heading text-lg"
                />
              </div>

              <div className="space-y-3">
                <label className="text-xs font-mono uppercase tracking-widest text-primary font-bold">Primary Genre</label>
                <div className="relative">
                  <select
                    value={selectedGenre}
                    onChange={(e) => setSelectedGenre(e.target.value)}
                    className="w-full bg-background/50 border border-border rounded-xl px-5 py-3.5 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all appearance-none font-heading"
                  >
                    {GENRES.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                  <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                    <Music className="size-4" />
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-14 text-lg mt-4 font-heading shadow-xl shadow-primary/20" 
                disabled={isCreating || !roomName}
              >
                {isCreating ? 'Creating Space...' : 'Launch Room'}
              </Button>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { signOut } from '@/app/login/actions'
import { LogOut, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export function UserMenu() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }

    getUser()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <div className="size-8 rounded-full bg-muted animate-pulse" />

  if (!user) {
    return (
      <Link href="/login">
        <Button variant="outline" size="sm" className="font-heading border-primary/50 hover:bg-primary/10">
          Sign In
        </Button>
      </Link>
    )
  }

  const initial = user.email?.charAt(0).toUpperCase() ?? 'U'

  return (
    <div className="relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="size-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold font-heading hover:ring-2 ring-primary/50 transition-all"
      >
        {initial}
      </button>

      {dropdownOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setDropdownOpen(false)} 
          />
          <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-2xl z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="px-4 py-2 border-b border-border mb-1">
              <p className="text-xs text-muted-foreground truncate font-sans">{user.email}</p>
            </div>
            <button
              onClick={() => signOut()}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="size-4" />
              Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  )
}

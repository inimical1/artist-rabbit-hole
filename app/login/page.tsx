'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { signIn, signUp, signInWithGoogle } from './actions'
import { Mail, Lock, Globe, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const formData = new FormData(e.currentTarget)
    
    if (mode === 'signup') {
      const password = formData.get('password') as string
      const confirmPassword = formData.get('confirmPassword') as string
      
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        setLoading(false)
        return
      }

      const result = await signUp(formData)
      if (result?.error) {
        setError(result.error)
      } else if (result?.message) {
        setMessage(result.message)
      }
    } else {
      const result = await signIn(formData)
      if (result?.error) {
        setError(result.error)
      }
      // Success redirect is handled by the server action
    }
    setLoading(false)
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError(null)
    const result = await signInWithGoogle()
    if (result?.error) {
      setError(result.error)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/20 blur-[120px] rounded-full pointer-events-none -z-10 opacity-50" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-accent/10 blur-[100px] rounded-full pointer-events-none -z-10 opacity-30" />
      
      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold font-heading tracking-tight text-foreground">
            Artist Rabbit Hole
          </h1>
          <p className="text-muted-foreground">
            {mode === 'signin' ? 'Welcome back to the void' : 'Join the exploration'}
          </p>
        </div>

        <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-2xl">
          <div className="flex p-1 bg-muted/30 rounded-lg mb-8">
            <button
              onClick={() => setMode('signin')}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                mode === 'signin' 
                  ? "bg-primary text-primary-foreground shadow-lg" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-md transition-all",
                mode === 'signup' 
                  ? "bg-primary text-primary-foreground shadow-lg" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  className="w-full bg-background border border-border/50 rounded-lg py-2.5 pl-10 pr-4 outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                  className="w-full bg-background border border-border/50 rounded-lg py-2.5 pl-10 pr-4 outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50"
                />
              </div>
            </div>

            {mode === 'signup' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
                <label className="text-sm font-medium text-muted-foreground ml-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <input
                    name="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    required
                    className="w-full bg-background border border-border/50 rounded-lg py-2.5 pl-10 pr-4 outline-none focus:border-primary transition-colors placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>
            )}

            {error && (
              <p className="text-destructive text-sm text-center font-medium animate-in fade-in zoom-in-95 duration-200">
                {error}
              </p>
            )}

            {message && (
              <p className="text-primary text-sm text-center font-medium animate-in fade-in zoom-in-95 duration-200">
                {message}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-all"
            >
              {loading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                mode === 'signin' ? 'Sign In' : 'Sign Up'
              )}
            </Button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/50"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full h-11 border-border/50 hover:bg-muted/50 transition-all gap-2"
          >
            <Globe className="size-5" />
            Google
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground px-8 leading-relaxed">
          {/* Note: In Supabase dashboard, enable Google OAuth provider and Email provider under Authentication → Providers */}
          By continuing, you agree to explore the infinite connections between artists and their influences.
        </p>
      </div>
    </div>
  )
}

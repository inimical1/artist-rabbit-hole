'use client'

interface LoadingOverlayProps {
  isVisible: boolean
}

export function LoadingOverlay({ isVisible }: LoadingOverlayProps) {
  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
      {/* Scanline effect */}
      <div className="absolute inset-0 scanlines pointer-events-none" />
      
      {/* Loading text */}
      <h2 className="font-mono font-bold text-[clamp(2rem,6vw,4rem)] tracking-[0.3em] text-foreground mb-12">
        DIGGING...
      </h2>
      
      {/* Progress line */}
      <div className="w-64 h-[2px] bg-white/10 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-primary to-accent progress-line" />
      </div>
    </div>
  )
}

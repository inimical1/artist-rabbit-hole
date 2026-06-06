'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, Share2, Music } from 'lucide-react'

const STEPS = [
  {
    icon: Search,
    title: 'THE SEARCH',
    desc: 'Enter an artist name to begin your descent. We pull from global archives to map their unique Sonic DNA.',
  },
  {
    icon: Music,
    title: 'THE STORY',
    desc: 'Read curated editorial narratives that connect the dots between eras, influences, and soundscapes.',
  },
  {
    icon: Share2,
    title: 'THE WEB',
    desc: 'Navigate the intricate web of influence. Discover who they inspired and who inspired them.',
  },
]

export function HowItWorksSection() {
  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true)
        }
      },
      { threshold: 0.1 }
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <section 
      ref={sectionRef}
      className="py-64 px-8 bg-black"
    >
      <div className="max-w-screen-xl mx-auto">
        <span className="text-muted-foreground text-[10px] uppercase tracking-[0.4em] mb-32 block text-center">HOW IT WORKS</span>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-24">
          {STEPS.map((step, i) => (
            <div 
              key={step.title}
              className="text-center space-y-8 transition-all duration-[1s] ease-out"
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
                transitionDelay: `${i * 200}ms`,
              }}
            >
              <div className="flex justify-center">
                <step.icon className="size-8 text-primary/40" strokeWidth={1} />
              </div>
              <h3 className="text-[11px] font-heading uppercase tracking-[0.5em] text-white">
                {step.title}
              </h3>
              <p className="text-[12px] text-muted-foreground leading-relaxed uppercase tracking-widest opacity-60 max-w-[280px] mx-auto">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

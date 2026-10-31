'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CalendarDays, Heart, Settings, Sparkles, BookOpen, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { flushQueue, queueSize } from '@/lib/client/offline-queue'
import { RegisterSW } from '@/components/pwa/register-sw'

const TABS = [
  { href: '/', label: 'Today', icon: Heart },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/insights', label: 'Insights', icon: Sparkles },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(8)
    } catch {}
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [discreet, setDiscreet] = useState(false)

  // Listen for and apply palette and discreet mode from localStorage
  useEffect(() => {
    const applyPreferences = () => {
      try {
        const pal = localStorage.getItem('ourcycle.palette') || 'rose'
        document.documentElement.setAttribute('data-palette', pal)
        const isDiscreet = localStorage.getItem('ourcycle.discreet') === 'true'
        setDiscreet(isDiscreet)
      } catch {}
    }

    applyPreferences()
    window.addEventListener('ourcycle:theme-change', applyPreferences)
    return () => window.removeEventListener('ourcycle:theme-change', applyPreferences)
  }, [])

  // Offline day-log queue: replay whenever the connection returns.
  useEffect(() => {
    const sync = async () => {
      if (queueSize() === 0) return
      const n = await flushQueue()
      if (n > 0) {
        toast.success(`Synced ${n} offline ${n === 1 ? 'entry' : 'entries'}`)
        router.refresh()
      }
    }
    window.addEventListener('online', sync)
    window.addEventListener('ourcycle:queue', sync as EventListener)
    void sync()
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('ourcycle:queue', sync as EventListener)
    }
  }, [router])

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md md:max-w-4xl lg:max-w-6xl flex-col px-4 sm:px-6 lg:px-8">
      <RegisterSW />
      <header className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-3.5 pb-3 bg-[#FDF2F4]/95 dark:bg-[#181514]/95 backdrop-blur-md border-b border-border/40 transition-colors">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            {discreet ? (
              <>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-200 dark:bg-zinc-800 text-stone-700 dark:text-stone-300">
                  <BookOpen className="h-4.5 w-4.5" aria-hidden />
                </span>
                <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">Personal Notes</h1>
              </>
            ) : (
              <>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  <Heart className="h-5 w-5 text-primary" fill="currentColor" aria-hidden />
                </span>
                <h1 className="font-display text-xl font-semibold tracking-tight">Our Cycle</h1>
              </>
            )}
          </Link>

          {/* Desktop & Tablet Navigation */}
          <nav aria-label="Desktop navigation" className="hidden md:flex items-center gap-1 bg-white/70 dark:bg-zinc-900/70 p-1.5 rounded-2xl border border-border/50 backdrop-blur-sm shadow-xs">
            {TABS.map(({ href, label, icon: Icon }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={triggerHaptic}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                    active
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-stone-100/70 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  <span>{label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Quick Doctor Report shortcut on Tablet & Laptop */}
          <div className="hidden md:flex items-center gap-2">
            <Link
              href="/report"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 transition-colors shadow-xs"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Doctor Report</span>
            </Link>
          </div>
        </div>
      </header>

      <motion.main
        key={pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="flex-1 pb-32 md:pb-12"
      >
        {children}
      </motion.main>

      <nav
        aria-label="Main navigation"
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-4 pb-1 md:hidden"
      >
        <div className="card-soft grid grid-cols-4 gap-1 p-1.5 backdrop-blur-md">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={triggerHaptic}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium transition-all active:scale-95 ${
                  active ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className={`h-5 w-5 transition-transform ${active ? 'scale-110' : ''}`} aria-hidden />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

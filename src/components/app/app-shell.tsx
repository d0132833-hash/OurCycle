'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarDays, Heart, Settings, Sparkles } from 'lucide-react'
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
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4">
      <RegisterSW />
      <header className="sticky top-0 z-30 -mx-4 px-4 pt-4 pb-2 bg-gradient-to-b from-[#FDF2F4ee] via-[#FDF2F4cc] to-transparent dark:from-[#181514ee] dark:via-[#181514cc] dark:to-transparent backdrop-blur-[2px]">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <Heart className="h-5 w-5 text-primary" fill="currentColor" aria-hidden />
          </span>
          <h1 className="font-display text-xl font-semibold tracking-tight">Our Cycle</h1>
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.main
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="flex-1 pb-28"
        >
          {children}
        </motion.main>
      </AnimatePresence>

      <nav
        aria-label="Main navigation"
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-4 pb-1"
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

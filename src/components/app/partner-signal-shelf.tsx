'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Coffee, Utensils, Moon, Heart, Cookie, Sparkles, Check } from 'lucide-react'
import { PARTNER_SIGNALS, type PartnerSignalDef } from '@/lib/partner-intelligence'
import type { DayEntry } from '@/lib/types'

interface PartnerSignalShelfProps {
  today: string
  todayEntry: DayEntry | null
}

const ICON_MAP: Record<PartnerSignalDef['icon'], React.ComponentType<{ className?: string }>> = {
  tea: Coffee,
  dinner: Utensils,
  quiet: Moon,
  hug: Heart,
  snack: Cookie,
  massage: Sparkles,
}

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(20)
    } catch {}
  }
}

export function PartnerSignalShelf({ today, todayEntry }: PartnerSignalShelfProps) {
  const router = useRouter()
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const currentTags = todayEntry?.tags ?? []
  const [localTags, setLocalTags] = useState<string[]>(currentTags)

  const activeSignals = PARTNER_SIGNALS.filter((s) => localTags.includes(s.key))

  async function toggleSignal(signalKey: string) {
    if (busyKey) return
    setBusyKey(signalKey)
    triggerHaptic()

    const exists = localTags.includes(signalKey)
    const newTags = exists
      ? localTags.filter((t) => t !== signalKey)
      : [...localTags, signalKey]

    setLocalTags(newTags)

    try {
      const res = await fetch('/api/days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          tags: newTags,
        }),
      })

      if (!res.ok) {
        throw new Error('Could not update signal')
      }

      toast.success(
        exists
          ? 'Signal cleared'
          : 'Signaled to partner 💕 Visible on the Partner tab',
      )
      router.refresh()
    } catch {
      // Revert local state on error
      setLocalTags(currentTags)
      toast.error('Failed to update signal')
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="card-soft p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5 text-primary fill-primary" />
            <span>Signal Your Partner</span>
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            1-tap signals so you never have to explain what you need
          </p>
        </div>
        {activeSignals.length > 0 && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {activeSignals.length} active
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {PARTNER_SIGNALS.map((signal) => {
          const isActive = localTags.includes(signal.key)
          const Icon = ICON_MAP[signal.icon]
          const isPending = busyKey === signal.key

          return (
            <button
              key={signal.key}
              disabled={isPending}
              onClick={() => toggleSignal(signal.key)}
              className={`relative flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all text-xs font-medium ${
                isActive
                  ? 'border-primary bg-primary/10 text-primary shadow-sm'
                  : 'border-border/70 bg-stone-50/50 hover:bg-stone-100/70 dark:bg-zinc-800/40 dark:hover:bg-zinc-800 text-foreground'
              } ${isPending ? 'opacity-50' : ''}`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'bg-white dark:bg-zinc-700 text-muted-foreground'
                }`}
              >
                {isActive ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
              </div>
              <span className="text-[11px] leading-tight line-clamp-2">{signal.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}


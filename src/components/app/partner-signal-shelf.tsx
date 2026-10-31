'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Coffee,
  Utensils,
  Moon,
  Heart,
  Cookie,
  Sparkles,
  Check,
  ShoppingCart,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  PARTNER_SIGNALS,
  parseCustomShoppingItems,
  addCustomShoppingTag,
  removeCustomShoppingTag,
  type PartnerSignalDef,
} from '@/lib/partner-intelligence'
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
  const [customItemInput, setCustomItemInput] = useState('')
  const [isAddingItem, setIsAddingItem] = useState(false)

  const activeSignals = PARTNER_SIGNALS.filter((s) => localTags.includes(s.key))
  const customItems = parseCustomShoppingItems(localTags)

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
      setLocalTags(currentTags)
      toast.error('Failed to update signal')
    } finally {
      setBusyKey(null)
    }
  }

  async function handleAddShoppingItem(e?: React.FormEvent) {
    if (e) e.preventDefault()
    const trimmed = customItemInput.trim()
    if (!trimmed) return
    if (trimmed.length > 80) {
      toast.error('Item name must be 80 characters or fewer')
      return
    }
    setIsAddingItem(true)
    triggerHaptic()
    const newTags = addCustomShoppingTag(localTags, trimmed)
    setLocalTags(newTags)
    setCustomItemInput('')

    try {
      const res = await fetch('/api/days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          tags: newTags,
        }),
      })
      if (!res.ok) throw new Error('Could not add item')
      toast.success(`Added "${trimmed}" to Care Shopping Checklist 💕`)
      router.refresh()
    } catch {
      setLocalTags(currentTags)
      toast.error('Failed to add item to shopping checklist')
    } finally {
      setIsAddingItem(false)
    }
  }

  async function handleRemoveShoppingItem(tag: string, name: string) {
    triggerHaptic()
    const newTags = removeCustomShoppingTag(localTags, tag)
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
      if (!res.ok) throw new Error('Could not remove item')
      toast.info(`Removed "${name}" from checklist`)
      router.refresh()
    } catch {
      setLocalTags(currentTags)
      toast.error('Failed to remove item')
    }
  }

  return (
    <div className="card-soft p-4 space-y-4">
      {/* Preset Care Signals Header */}
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

      {/* Preset Signal Buttons Grid */}
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

      {/* Care & Comfort Shopping Wishlist by Her */}
      <div className="pt-3 border-t border-border/60 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <ShoppingCart className="h-3.5 w-3.5 text-primary" />
            <span>Care &amp; Comfort Shopping Wishlist</span>
          </div>
          {customItems.length > 0 && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {customItems.length} on partner checklist
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Craving a treat or need supplies? Add them here—they appear instantly on his shopping checklist.
        </p>

        {/* Input Form */}
        <form onSubmit={handleAddShoppingItem} className="flex gap-1.5">
          <input
            type="text"
            value={customItemInput}
            onChange={(e) => setCustomItemInput(e.target.value)}
            placeholder="e.g., Salted caramel gelato, extra pads, iced matcha..."
            maxLength={80}
            className="flex-1 text-xs px-3 py-2 rounded-xl border border-border/80 bg-stone-50/70 dark:bg-zinc-800/70 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={isAddingItem || !customItemInput.trim()}
            className="px-3 py-2 text-xs font-medium bg-primary text-white rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-1 shadow-sm shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add</span>
          </button>
        </form>

        {/* Active Items List */}
        {customItems.length > 0 && (
          <div className="space-y-1.5 pt-1">
            {customItems.map((item) => (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs border ${
                  item.isDone
                    ? 'bg-stone-100/50 dark:bg-zinc-800/30 border-border/40 text-muted-foreground line-through'
                    : 'bg-primary/5 dark:bg-primary/10 border-primary/20 text-foreground font-medium'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-primary font-bold">•</span>
                  <span className="truncate">{item.name}</span>
                  {item.isDone ? (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold no-underline">
                      Bought by Partner ✓
                    </span>
                  ) : (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 font-semibold">
                      Waiting for him 💕
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveShoppingItem(item.tag, item.name)}
                  title="Remove item"
                  className="text-muted-foreground hover:text-rose-500 transition-colors p-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

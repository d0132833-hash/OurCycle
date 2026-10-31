'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Droplets, NotebookPen, PencilLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { saveWithOfflineFallback } from '@/lib/client/offline-queue'
import { DaySheet } from './day-sheet'
import type { DayEntry } from '@/lib/types'

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(25)
    } catch {
      // Ignore vibration errors if blocked by browser policy
    }
  }
}

/**
 * Quick actions on the Today screen.
 * Speed rule: "Period started today" = 1 tap. Logging a day = 2 taps.
 * Includes instant undo toast with 6-second window and subtle haptic feedback.
 */
export function PeriodActions({
  today,
  todayEntry,
  ongoingEpisodeId,
}: {
  today: string
  todayEntry: DayEntry | null
  ongoingEpisodeId: string | null
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  async function startPeriod() {
    if (busy) return
    setBusy(true)
    triggerHaptic()
    try {
      const where = await saveWithOfflineFallback('period-start', { start_date: today })
      router.refresh()

      toast.success(
        where === 'queued'
          ? 'Saved offline — syncs automatically'
          : 'Period started. Be gentle with yourself today.',
        {
          duration: 6000,
          action: {
            label: 'Undo',
            onClick: async () => {
              try {
                // Find period with start_date === today and delete
                const res = await fetch('/api/periods')
                if (res.ok) {
                  const data = await res.json()
                  const episode = (data.periods as any[])?.find((p) => p.start_date === today)
                  if (episode) {
                    await fetch(`/api/periods?id=${episode.id}`, { method: 'DELETE' })
                    toast.info('Period entry undone')
                    router.refresh()
                  }
                }
              } catch {
                toast.error('Could not undo')
              }
            },
          },
        },
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  async function endPeriod() {
    if (busy || !ongoingEpisodeId) return
    setBusy(true)
    triggerHaptic()
    const targetEpisodeId = ongoingEpisodeId
    try {
      const res = await fetch('/api/periods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: targetEpisodeId, end_date: today }),
      })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'Could not save')
      }
      router.refresh()

      toast.success('Period ended today — predictions updated', {
        duration: 6000,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await fetch('/api/periods', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: targetEpisodeId, end_date: null }),
              })
              toast.info('Period end date cleared')
              router.refresh()
            } catch {
              toast.error('Could not undo')
            }
          },
        },
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  const summaryChips = useMemo(() => {
    if (!todayEntry) return []
    const chips: string[] = []
    if (todayEntry.flow && todayEntry.flow !== 'none') {
      chips.push(`Flow: ${todayEntry.flow.charAt(0).toUpperCase() + todayEntry.flow.slice(1)}`)
    }
    const MOOD_EMOJI = ['', '😞', '😕', '😐', '🙂', '😄']
    const ENERGY_EMOJI = ['', '😴', '🥱', '😐', '😊', '⚡']
    const LIBIDO_EMOJI = ['', '🌙', '😶', '🙂', '😉', '🔥']
    const INTENSITY_LABEL = ['', 'Mild', 'Moderate', 'Strong']

    if (todayEntry.mood) chips.push(`Mood ${MOOD_EMOJI[todayEntry.mood] || ''}`)
    if (todayEntry.energy) chips.push(`Energy ${ENERGY_EMOJI[todayEntry.energy] || ''}`)
    if (todayEntry.libido) chips.push(`Libido ${LIBIDO_EMOJI[todayEntry.libido] || ''}`)

    const symptoms: { key: keyof DayEntry; label: string }[] = [
      { key: 'cramps', label: 'Cramps' },
      { key: 'headache', label: 'Headache' },
      { key: 'back_pain', label: 'Back pain' },
      { key: 'breast_tenderness', label: 'Tender breasts' },
      { key: 'bloating', label: 'Bloating' },
      { key: 'fatigue', label: 'Fatigue' },
      { key: 'acne', label: 'Acne' },
    ]
    for (const s of symptoms) {
      const val = todayEntry[s.key] as number | null | undefined
      if (val && val > 0) {
        chips.push(`${s.label}: ${INTENSITY_LABEL[val] || val}`)
      }
    }

    if (typeof todayEntry.sleep_hours === 'number') {
      chips.push(`${todayEntry.sleep_hours}h sleep`)
    }
    if (typeof todayEntry.water_glasses === 'number') {
      chips.push(`${todayEntry.water_glasses} glasses`)
    }
    if (todayEntry.note) {
      chips.push(`"${todayEntry.note.slice(0, 18)}${todayEntry.note.length > 18 ? '…' : ''}"`)
    }
    return chips
  }, [todayEntry])

  const hasLoggedToday = summaryChips.length > 0

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2.5">
        {ongoingEpisodeId ? (
          <Button
            onClick={endPeriod}
            disabled={busy}
            variant="outline"
            className="h-14 rounded-2xl border-[rgba(225,29,72,0.25)] bg-white/75 text-sm font-semibold text-primary transition-all duration-200 active:scale-95 dark:bg-zinc-900/80 dark:border-rose-900/40"
          >
            <Droplets className="mr-1.5 h-4 w-4" aria-hidden />
            Period ended today
          </Button>
        ) : (
          <Button
            onClick={startPeriod}
            disabled={busy}
            className="h-14 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-[0_8px_20px_rgba(225,29,72,0.3)] transition-all duration-200 active:scale-95"
          >
            <Droplets className="mr-1.5 h-4 w-4" aria-hidden />
            Period started today
          </Button>
        )}
        <Button
          onClick={() => {
            triggerHaptic()
            setSheetOpen(true)
          }}
          variant="outline"
          className="h-14 rounded-2xl border-[rgba(225,29,72,0.25)] bg-white/75 text-sm font-semibold text-primary transition-all duration-200 active:scale-95 dark:bg-zinc-900/80 dark:border-rose-900/40"
        >
          {hasLoggedToday ? (
            <>
              <PencilLine className="mr-1.5 h-4 w-4" aria-hidden />
              Edit today&apos;s log
            </>
          ) : (
            <>
              <NotebookPen className="mr-1.5 h-4 w-4" aria-hidden />
              Log today
            </>
          )}
        </Button>
      </div>

      {hasLoggedToday && (
        <div
          onClick={() => {
            triggerHaptic()
            setSheetOpen(true)
          }}
          className="card-soft p-3.5 flex items-center justify-between cursor-pointer hover:border-primary/40 transition-all group"
        >
          <div className="space-y-1.5 flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">Logged for Today</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                Saved
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {summaryChips.map((chip, idx) => (
                <span
                  key={idx}
                  className="text-[11px] px-2 py-0.5 rounded-lg bg-stone-100/90 dark:bg-zinc-800 text-stone-700 dark:text-stone-300 border border-border/40"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 shrink-0 gap-1 text-xs text-primary group-hover:bg-primary/10"
          >
            <PencilLine className="h-3.5 w-3.5" />
            <span>Edit</span>
          </Button>
        </div>
      )}

      <DaySheet date={today} entry={todayEntry} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  )
}

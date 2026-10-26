'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Droplets, NotebookPen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { saveWithOfflineFallback } from '@/lib/client/offline-queue'
import { DaySheet } from './day-sheet'
import type { DayEntry } from '@/lib/types'

/**
 * Quick actions on the Today screen.
 * Speed rule: "Period started today" = 1 tap. Logging a day = 2 taps.
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
    try {
      const where = await saveWithOfflineFallback('period-start', { start_date: today })
      toast.success(
        where === 'queued'
          ? 'Saved offline — syncs automatically'
          : 'Logged. Be gentle with yourself today.',
      )
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  async function endPeriod() {
    if (busy || !ongoingEpisodeId) return
    setBusy(true)
    try {
      const res = await fetch('/api/periods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ongoingEpisodeId, end_date: today }),
      })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'Could not save')
      }
      toast.success('Period end logged — predictions updated')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        {ongoingEpisodeId ? (
          <Button
            onClick={endPeriod}
            disabled={busy}
            variant="outline"
            className="h-14 rounded-2xl border-[rgba(225,29,72,0.25)] bg-white/75 text-sm font-semibold text-primary"
          >
            <Droplets className="mr-1.5 h-4 w-4" aria-hidden />
            Period ended today
          </Button>
        ) : (
          <Button
            onClick={startPeriod}
            disabled={busy}
            className="h-14 rounded-2xl bg-primary text-sm font-semibold text-primary-foreground shadow-[0_8px_20px_rgba(225,29,72,0.3)]"
          >
            <Droplets className="mr-1.5 h-4 w-4" aria-hidden />
            Period started today
          </Button>
        )}
        <Button
          onClick={() => setSheetOpen(true)}
          variant="outline"
          className="h-14 rounded-2xl border-[rgba(225,29,72,0.25)] bg-white/75 text-sm font-semibold text-primary"
        >
          <NotebookPen className="mr-1.5 h-4 w-4" aria-hidden />
          Log today
        </Button>
      </div>

      <DaySheet date={today} entry={todayEntry} open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  )
}

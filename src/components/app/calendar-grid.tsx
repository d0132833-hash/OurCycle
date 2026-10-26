'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DayEntry, PeriodEpisode } from '@/lib/types'
import type { Prediction } from '@/lib/predictions'
import { addDays } from '@/lib/dates'
import { DaySheet } from './day-sheet'
import { fmtShort } from './phase-copy'

interface Props {
  episodes: PeriodEpisode[]
  entries: DayEntry[]
  prediction: Prediction
}

type CellKind = 'period' | 'spotting' | 'predicted' | 'fertile' | 'plain'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const MONTH_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
})

function dayKey(offset: number, iso: string) {
  return offset === 0 ? iso : addDays(iso, offset)
}

export function CalendarGrid({ episodes, entries, prediction }: Props) {
  const today = prediction.today
  const [view, setView] = useState(() => today.slice(0, 7)) // YYYY-MM
  const [selected, setSelected] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const entryByDate = useMemo(() => {
    const m = new Map<string, DayEntry>()
    for (const e of entries) m.set(e.date, e)
    return m
  }, [entries])

  const episodeDay = useMemo(() => {
    // actual logged bleeding days (ongoing episodes capped at today)
    const m = new Map<string, PeriodEpisode>()
    for (const e of episodes) {
      const end = e.end_date ?? (e.start_date <= today ? today : null)
      if (!end) continue
      for (let d = e.start_date; d <= end; d = addDays(d, 1)) m.set(d, e)
    }
    return m
  }, [episodes, today])

  const marks = useMemo(() => {
    const predicted = new Set<string>()
    const fertile = new Set<string>()
    if (prediction.nextPeriodStart && prediction.range) {
      if (prediction.irregular) {
        // σ ≥ 3 → ranges only, never a single predicted date
        for (let d = prediction.range[0]; d <= prediction.range[1]; d = addDays(d, 1))
          predicted.add(d)
      } else {
        for (let i = 0; i < prediction.predictedPeriodDuration; i++)
          predicted.add(addDays(prediction.nextPeriodStart, i))
      }
    }
    // fertile band: this cycle's window plus the next projected one, so the
    // calendar stays useful mid-cycle (the current window is often already past)
    const fwCur = prediction.irregular ? prediction.fertileWindowRange : prediction.fertileWindow
    const ovu = new Set<string>()
    if (!prediction.irregular && prediction.ovulationDate) ovu.add(prediction.ovulationDate)
    if (fwCur) for (let d = fwCur[0]; d <= fwCur[1]; d = addDays(d, 1)) fertile.add(d)
    if (prediction.nextPeriodStart && prediction.cycleLength) {
      const shift = prediction.cycleLength
      if (prediction.irregular && fwCur) {
        for (let d = addDays(fwCur[0], shift); d <= addDays(fwCur[1], shift); d = addDays(d, 1))
          fertile.add(d)
      } else if (!prediction.irregular) {
        const ovu2 = addDays(prediction.nextPeriodStart, shift - 14)
        for (let d = addDays(ovu2, -5); d <= addDays(ovu2, 1); d = addDays(d, 1)) fertile.add(d)
        ovu.add(ovu2)
      }
    }
    return { predicted, fertile, ovu }
  }, [prediction])

  const cells = useMemo(() => {
    const first = `${view}-01`
    const lead = new Date(`${first}T12:00:00Z`).getUTCDay() // 0 = Sunday
    const daysInMonth = new Date(
      Number(view.slice(0, 4)),
      Number(view.slice(5, 7)),
      0,
    ).getUTCDate()
    const out: (string | null)[] = Array.from({ length: lead }, () => null)
    for (let i = 0; i < daysInMonth; i++) out.push(dayKey(i, first))
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [view])

  function cellKind(d: string): CellKind {
    if (episodeDay.has(d)) return 'period'
    const flow = entryByDate.get(d)?.flow
    if (flow === 'spotting' || flow === 'light' || flow === 'medium' || flow === 'heavy')
      return 'spotting'
    if (marks.predicted.has(d)) return 'predicted'
    if (marks.fertile.has(d)) return 'fertile'
    return 'plain'
  }

  function shiftMonth(delta: number) {
    const y = Number(view.slice(0, 4))
    const m = Number(view.slice(5, 7)) - 1 + delta
    const nd = new Date(Date.UTC(y, m, 15))
    setView(`${nd.getUTCFullYear()}-${String(nd.getUTCMonth() + 1).padStart(2, '0')}`)
  }

  function openDay(d: string) {
    if (d > today) {
      toast.info('You can log a day once it begins')
      return
    }
    setSelected(d)
    setOpen(true)
  }

  const selectedEntry = selected ? (entryByDate.get(selected) ?? null) : null

  return (
    <div className="card-soft p-4">
      <div className="mb-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          className="rounded-full text-muted-foreground"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </Button>
        <div className="text-center">
          <h2 className="font-display text-lg font-semibold">{MONTH_FMT.format(new Date(`${view}-15T12:00:00Z`))}</h2>
          {prediction.irregular ? (
            <p className="text-[11px] text-muted-foreground">
              Irregular pattern — ranges shown. Logging sharpens predictions.
            </p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="rounded-full text-muted-foreground"
        >
          <ChevronRight className="h-5 w-5" aria-hidden />
        </Button>
      </div>

      <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((d, i) => {
          if (!d) return <span key={`empty-${i}`} />
          const kind = cellKind(d)
          const isToday = d === today
          const hasEntry = entryByDate.has(d)
          const isOvu = marks.ovu.has(d) && kind === 'plain'
          const inFuture = d > today
          return (
            <div key={d} className="flex justify-center">
              <button
                type="button"
                onClick={() => openDay(d)}
                aria-label={`${fmtShort(d)}${kind === 'period' ? ', period day' : kind === 'predicted' ? ', predicted period' : kind === 'fertile' ? ', fertile window' : ''}`}
                className={[
                  'relative flex h-10 w-10 items-center justify-center rounded-full text-sm transition-transform active:scale-95',
                  kind === 'period' ? 'bg-[#E11D48] font-semibold text-white shadow-[0_4px_10px_rgba(225,29,72,0.35)]' : '',
                  kind === 'spotting' ? 'bg-[#FDA4AF]/50 text-[#9F1239]' : '',
                  kind === 'predicted' ? 'cell-predicted text-primary' : '',
                  kind === 'fertile' ? 'bg-[#FDBA74]/30 text-[#9A3412]' : '',
                  kind === 'plain' ? (inFuture ? 'text-muted-foreground' : 'text-foreground') : '',
                  isToday && kind !== 'period' ? 'ring-2 ring-[#E11D48] ring-offset-1 ring-offset-transparent' : '',
                  isToday && kind === 'period' ? 'ring-2 ring-[#E11D48]/50 ring-offset-1 ring-offset-transparent' : '',
                ].join(' ')}
              >
                {Number(d.slice(8))}
                {isOvu ? (
                  <span
                    className="absolute bottom-0.5 h-1.5 w-1.5 rounded-full bg-[#F97316]"
                    aria-hidden
                  />
                ) : null}
                {hasEntry && kind === 'plain' ? (
                  <span
                    className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[#E11D48]/40"
                    aria-hidden
                  />
                ) : null}
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
        <Legend className="bg-[#E11D48]" label="Period" />
        <Legend className="cell-predicted" label="Predicted" />
        <Legend className="bg-[#FDBA74]/60" label="Fertile" />
        <Legend className="bg-white border border-border" dot label="Ovulation" />
        <Legend className="bg-white ring-1 ring-[#E11D48]" label="Today" />
      </div>

      <DaySheet date={selected} entry={selectedEntry} open={open} onOpenChange={setOpen} />
    </div>
  )
}

function Legend({ className, label, dot }: { className: string; label: string; dot?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-3.5 w-3.5 rounded-full ${className}`} aria-hidden>
        {dot ? (
          <span className="mx-auto mt-[5px] block h-1 w-1 rounded-full bg-[#F97316]" />
        ) : null}
      </span>
      {label}
    </span>
  )
}

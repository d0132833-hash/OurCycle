'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, Download, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DayEntry, PeriodEpisode } from '@/lib/types'
import type { Prediction } from '@/lib/predictions'
import { addDays, dayRange, getDaysInMonth } from '@/lib/dates'
import { DaySheet } from './day-sheet'
import { fmtShort } from './phase-copy'

interface Props {
  episodes: PeriodEpisode[]
  entries: DayEntry[]
  prediction: Prediction
  periodLength?: number
}

type CellKind = 'period' | 'spotting' | 'predicted' | 'fertile' | 'plain'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const MONTH_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'UTC',
  month: 'long',
  year: 'numeric',
})

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(10)
    } catch {}
  }
}

export function CalendarGrid({
  episodes,
  entries,
  prediction,
  periodLength = 5,
}: Props) {
  const today = prediction.today
  const [localEpisodes, setLocalEpisodes] = useState(episodes)
  const [localEntries, setLocalEntries] = useState(entries)
  const [view, setView] = useState(() => today.slice(0, 7)) // YYYY-MM
  const [selected, setSelected] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  useEffect(() => {
    setLocalEpisodes(episodes)
  }, [episodes])

  useEffect(() => {
    setLocalEntries(entries)
  }, [entries])

  const entryByDate = useMemo(() => {
    const m = new Map<string, DayEntry>()
    for (const e of localEntries) m.set(e.date, e)
    return m
  }, [localEntries])

  const episodeDay = useMemo(() => {
    // actual logged bleeding days (ongoing episodes capped at today if open-ended)
    const m = new Map<string, PeriodEpisode>()
    for (const e of localEpisodes) {
      const end = e.end_date ?? (e.start_date <= today ? today : null)
      if (!end) continue
      for (let d = e.start_date; d <= end; d = addDays(d, 1)) m.set(d, e)
    }
    return m
  }, [localEpisodes, today])

  const marks = useMemo(() => {
    const predicted = new Set<string>()
    const fertile = new Set<string>()
    const ovu = new Set<string>()

    const dur = prediction.predictedPeriodDuration || 5

    // Current next period prediction
    if (prediction.nextPeriodStart) {
      if (prediction.irregular && prediction.range) {
        // σ ≥ 3 → ranges only, never a single predicted date
        for (let d = prediction.range[0]; d <= prediction.range[1]; d = addDays(d, 1))
          predicted.add(d)
      } else {
        for (let i = 0; i < dur; i++)
          predicted.add(addDays(prediction.nextPeriodStart, i))
      }
    }

    // Current fertile band & estimated ovulation
    const fwCur = prediction.irregular ? prediction.fertileWindowRange : prediction.fertileWindow
    if (!prediction.irregular && prediction.ovulationDate) ovu.add(prediction.ovulationDate)
    if (fwCur) for (let d = fwCur[0]; d <= fwCur[1]; d = addDays(d, 1)) fertile.add(d)

    // Forward cycle projections (next 3 cycles) so browsing future months stays complete
    if (prediction.nextPeriodStart && prediction.cycleLength) {
      const shift = prediction.cycleLength
      for (let c = 1; c <= 3; c++) {
        const nextStart = addDays(prediction.nextPeriodStart, c * shift)

        if (!prediction.irregular) {
          for (let i = 0; i < dur; i++) {
            predicted.add(addDays(nextStart, i))
          }
          const ovuDate = addDays(nextStart, -14)
          ovu.add(ovuDate)
          for (let d = addDays(ovuDate, -5); d <= addDays(ovuDate, 1); d = addDays(d, 1)) {
            fertile.add(d)
          }
        } else if (prediction.range) {
          const r0 = addDays(prediction.range[0], c * shift)
          const r1 = addDays(prediction.range[1], c * shift)
          for (let d = r0; d <= r1; d = addDays(d, 1)) predicted.add(d)
          if (fwCur) {
            for (let d = addDays(fwCur[0], c * shift); d <= addDays(fwCur[1], c * shift); d = addDays(d, 1)) {
              fertile.add(d)
            }
          }
        }
      }
    }
    return { predicted, fertile, ovu }
  }, [prediction])

  const cells = useMemo(() => {
    const first = `${view}-01`
    const lead = new Date(`${first}T12:00:00Z`).getUTCDay() // 0 = Sunday
    const daysInMonth = getDaysInMonth(view)
    const out: (string | null)[] = Array.from({ length: lead }, () => null)
    for (let i = 1; i <= daysInMonth; i++) {
      out.push(`${view}-${String(i).padStart(2, '0')}`)
    }
    while (out.length % 7 !== 0) out.push(null)
    return out
  }, [view])

  function cellKind(d: string): CellKind {
    if (episodeDay.has(d)) return 'period'
    const flow = entryByDate.get(d)?.flow
    if (flow === 'light' || flow === 'medium' || flow === 'heavy') return 'period'
    if (flow === 'spotting') return 'spotting'
    if (marks.predicted.has(d) && d >= today) return 'predicted'
    if (marks.fertile.has(d) && d >= today) return 'fertile'
    return 'plain'
  }

  function shiftMonth(delta: number) {
    triggerHaptic()
    const y = Number(view.slice(0, 4))
    const m = Number(view.slice(5, 7)) - 1 + delta
    const nd = new Date(Date.UTC(y, m, 15))
    setView(`${nd.getUTCFullYear()}-${String(nd.getUTCMonth() + 1).padStart(2, '0')}`)
  }

  function openDay(d: string) {
    triggerHaptic()
    setSelected(d)
    setOpen(true)
  }

  function handleTouchStart(e: React.TouchEvent) {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  function handleTouchMove(e: React.TouchEvent) {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  function handleTouchEnd() {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    if (distance > 45) {
      shiftMonth(1) // swipe left -> next month
    } else if (distance < -45) {
      shiftMonth(-1) // swipe right -> prev month
    }
  }

  const selectedEntry = selected ? (entryByDate.get(selected) ?? null) : null

  const handleDayCleared = (clearedDate: string) => {
    // 1. Find if clearedDate starts or belongs to any episode in localEpisodes
    let affectedRange: string[] = [clearedDate]

    setLocalEpisodes((prev) => {
      const ep = prev.find(
        (e) =>
          e.start_date === clearedDate ||
          (e.start_date <= clearedDate && (e.end_date === null || e.end_date >= clearedDate)),
      )
      if (!ep) return prev

      if (ep.start_date === clearedDate) {
        // Clearing period start -> remove entire episode!
        const oldEnd = ep.end_date ?? ep.start_date
        affectedRange = dayRange(ep.start_date, oldEnd)
        return prev.filter((p) => p.id !== ep.id)
      } else {
        // Shorten episode
        const newEnd = addDays(clearedDate, -1)
        const oldEnd = ep.end_date ?? clearedDate
        affectedRange = dayRange(clearedDate, oldEnd)
        if (newEnd < ep.start_date) {
          return prev.filter((p) => p.id !== ep.id)
        } else {
          return prev.map((p) => (p.id === ep.id ? { ...p, end_date: newEnd } : p))
        }
      }
    })

    // 2. Clear flow and entry for affected dates from localEntries
    setLocalEntries((prev) => {
      const affectedSet = new Set(affectedRange)
      affectedSet.add(clearedDate)

      return prev
        .filter((e) => {
          if (e.date === clearedDate) {
            return false
          }
          if (affectedSet.has(e.date)) {
            const hasOther =
              e.mood !== null ||
              e.energy !== null ||
              e.libido !== null ||
              e.cramps !== null ||
              e.headache !== null ||
              e.back_pain !== null ||
              e.breast_tenderness !== null ||
              e.acne !== null ||
              e.bloating !== null ||
              e.fatigue !== null ||
              e.bbt !== null ||
              e.weight !== null ||
              e.sleep_hours !== null ||
              e.water_glasses !== null ||
              (e.tags && e.tags.length > 0) ||
              (e.note && e.note.trim() !== '')
            return Boolean(hasOther)
          }
          return true
        })
        .map((e) => {
          if (affectedSet.has(e.date)) {
            return { ...e, flow: null }
          }
          return e
        })
    })
  }

  const handleDaySaved = (
    savedDate: string,
    savedFlow: string | null,
    isPeriodStart: boolean,
    savedPeriodLen: number,
  ) => {
    if (savedFlow === 'none' || savedFlow === null) {
      handleDayCleared(savedDate)
      return
    }

    setLocalEntries((prev) => {
      const map = new Map(prev.map((e) => [e.date, e]))
      const cur = map.get(savedDate)
      map.set(savedDate, {
        date: savedDate,
        flow: (savedFlow as any) ?? null,
        mood: cur?.mood ?? null,
        energy: cur?.energy ?? null,
        libido: cur?.libido ?? null,
        cramps: cur?.cramps ?? null,
        headache: cur?.headache ?? null,
        back_pain: cur?.back_pain ?? null,
        breast_tenderness: cur?.breast_tenderness ?? null,
        acne: cur?.acne ?? null,
        bloating: cur?.bloating ?? null,
        fatigue: cur?.fatigue ?? null,
        bbt: cur?.bbt ?? null,
        weight: cur?.weight ?? null,
        sleep_hours: cur?.sleep_hours ?? null,
        water_glasses: cur?.water_glasses ?? null,
        exercise: cur?.exercise ?? null,
        tags: cur?.tags ?? null,
        note: cur?.note ?? null,
        created_at: cur?.created_at ?? new Date().toISOString(),
      })

      if (isPeriodStart && savedFlow && savedFlow !== 'none') {
        const endDate = addDays(savedDate, savedPeriodLen - 1)
        const range = dayRange(savedDate, endDate)
        for (const d of range) {
          const existing = map.get(d)
          if (existing) {
            map.set(d, { ...existing, flow: savedFlow as any })
          } else {
            map.set(d, {
              date: d,
              flow: savedFlow as any,
              mood: null,
              energy: null,
              libido: null,
              cramps: null,
              headache: null,
              back_pain: null,
              breast_tenderness: null,
              acne: null,
              bloating: null,
              fatigue: null,
              bbt: null,
              weight: null,
              sleep_hours: null,
              water_glasses: null,
              exercise: null,
              tags: null,
              note: null,
              created_at: new Date().toISOString(),
            })
          }
        }
      }
      return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
    })

    if (isPeriodStart && savedFlow && savedFlow !== 'none') {
      const endDate = addDays(savedDate, savedPeriodLen - 1)
      setLocalEpisodes((prev) => {
        const filtered = prev.filter((p) => p.start_date !== savedDate)
        return [
          ...filtered,
          {
            id: 'local-' + Date.now(),
            start_date: savedDate,
            end_date: endDate,
            flow: savedFlow as any,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ].sort((a, b) => a.start_date.localeCompare(b.start_date))
      })
    }
  }

  return (
    <div
      className="card-soft p-4 sm:p-6 md:p-8 select-none max-w-4xl mx-auto"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
          className="h-9 w-9 sm:h-10 sm:w-10 md:h-11 md:w-11 rounded-full text-muted-foreground transition-transform active:scale-90"
        >
          <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
        </Button>
        <div className="text-center flex flex-col items-center">
          <h2 className="font-display text-lg sm:text-xl md:text-2xl font-bold">
            {MONTH_FMT.format(new Date(`${view}-15T12:00:00Z`))}
          </h2>
          {view !== today.slice(0, 7) ? (
            <button
              type="button"
              onClick={() => {
                triggerHaptic()
                setView(today.slice(0, 7))
              }}
              className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold text-primary bg-primary/10 hover:bg-primary/20 transition-all cursor-pointer"
            >
              <span>Back to Today</span>
            </button>
          ) : prediction.irregular ? (
            <p className="text-[11px] sm:text-xs text-muted-foreground">
              Irregular pattern — ranges shown. Logging sharpens predictions.
            </p>
          ) : (
            <p className="text-[10px] sm:text-xs text-muted-foreground/80 md:hidden">
              Swipe left/right to change month
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
          className="h-9 w-9 sm:h-10 sm:w-10 md:h-11 md:w-11 rounded-full text-muted-foreground transition-transform active:scale-90"
        >
          <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
        </Button>
      </div>

      <div className="mb-2 grid grid-cols-7 text-center text-[11px] sm:text-xs md:text-sm font-semibold text-muted-foreground py-1">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-7 gap-y-1.5 sm:gap-y-2"
        >
          {cells.map((d, i) => {
            if (!d) return <span key={`empty-${i}`} />
            const kind = cellKind(d)
            const isToday = d === today
            const hasEntry = entryByDate.has(d)
            const isOvu = marks.ovu.has(d) && (kind === 'fertile' || kind === 'plain')
            const inFuture = d > today
            return (
              <div key={d} className="flex justify-center">
                <button
                  type="button"
                  onClick={() => openDay(d)}
                  aria-label={`${fmtShort(d)}${kind === 'period' ? ', period day' : kind === 'predicted' ? ', predicted period' : kind === 'fertile' ? ', fertile window' : ''}${isOvu ? ', estimated ovulation' : ''}`}
                  className={[
                    'relative flex h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 items-center justify-center rounded-2xl text-sm sm:text-base font-medium transition-all active:scale-95 cursor-pointer',
                    kind === 'period' ? 'bg-[#E11D48] font-semibold text-white shadow-[0_4px_12px_rgba(225,29,72,0.35)]' : '',
                    kind === 'spotting' ? 'bg-[#FDA4AF]/50 text-[#9F1239] dark:bg-rose-900/50 dark:text-rose-200' : '',
                    kind === 'predicted' ? 'cell-predicted text-primary' : '',
                    kind === 'fertile' ? 'bg-[#FDBA74]/30 text-[#9A3412] dark:bg-amber-950/40 dark:text-amber-200' : '',
                    kind === 'plain' ? (inFuture ? 'text-muted-foreground' : 'text-foreground hover:bg-black/5 dark:hover:bg-white/5') : '',
                    isToday && kind !== 'period' ? 'ring-2 ring-[#E11D48] ring-offset-1 ring-offset-transparent font-bold' : '',
                    isToday && kind === 'period' ? 'ring-2 ring-white ring-offset-2 ring-offset-[#E11D48] font-bold' : '',
                  ].join(' ')}
                >
                  {Number(d.slice(8))}
                  {isOvu ? (
                    <span
                      className="absolute bottom-1 sm:bottom-1.5 md:bottom-2 h-1.5 w-1.5 rounded-full bg-[#F97316] ring-1 ring-white/60 dark:ring-black/40"
                      aria-hidden
                    />
                  ) : null}
                  {hasEntry && kind !== 'period' && !isOvu ? (
                    <span
                      className="absolute bottom-1 sm:bottom-1.5 md:bottom-2 h-1 w-1 rounded-full bg-[#E11D48]/70"
                      aria-hidden
                    />
                  ) : null}
                </button>
              </div>
            )
          })}
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex flex-wrap items-center justify-center sm:justify-start gap-x-5 gap-y-2 border-t border-border/60 pt-4 text-[11px] sm:text-xs md:text-sm text-muted-foreground">
        <Legend className="bg-[#E11D48]" label="Period" />
        <Legend className="cell-predicted" label="Predicted" />
        <Legend className="bg-[#FDBA74]/60 dark:bg-amber-700/60" label="Fertile" />
        <Legend className="bg-card border border-border" dot label="Ovulation" />
        <Legend className="bg-card ring-1 ring-[#E11D48]" label="Today" />
      </div>

      <div className="mt-5 pt-1">
        <a
          href="/api/calendar/ics"
          download="our-cycle.ics"
          className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold bg-stone-100 hover:bg-stone-200/80 dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-stone-700 dark:text-stone-200 transition-colors border border-border/50 shadow-2xs"
        >
          <Calendar className="h-4 w-4 text-primary" />
          <span>Export Forecast to Phone Calendar (.ics)</span>
          <Download className="h-3.5 w-3.5 opacity-60 ml-auto" />
        </a>
      </div>

      <DaySheet
        date={selected}
        entry={selectedEntry}
        existingEpisode={selected ? (episodeDay.get(selected) ?? null) : null}
        open={open}
        onOpenChange={setOpen}
        periodLength={periodLength}
        onSaved={handleDaySaved}
        onCleared={handleDayCleared}
      />
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

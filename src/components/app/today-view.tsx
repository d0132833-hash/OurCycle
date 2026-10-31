'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, Users } from 'lucide-react'
import type { DayEntry, PeriodEpisode } from '@/lib/types'
import type { Prediction } from '@/lib/predictions'
import { CountdownRing } from '@/components/app/countdown-ring'
import { PeriodActions } from '@/components/app/period-actions'
import { PartnerView } from '@/components/app/partner-view'
import { PartnerSignalShelf } from '@/components/app/partner-signal-shelf'
import {
  PHASE_COPY,
  expectationLine,
  fmtShort,
  fertileHint,
  pmsHint,
} from '@/components/app/phase-copy'

const DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'UTC',
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

interface TodayViewProps {
  prediction: Prediction
  todayEntry: DayEntry | null
  ongoing: PeriodEpisode | null
}

export function TodayView({ prediction, todayEntry, ongoing }: TodayViewProps) {
  const [perspective, setPerspective] = useState<'tracker' | 'partner'>('tracker')

  const phase = prediction.todayPhase
  const copy = phase ? PHASE_COPY[phase] : null
  const pms = pmsHint(prediction)
  const fertile = fertileHint(prediction)

  return (
    <div className="space-y-4 pt-2">
      {/* Header & Perspective Switcher */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold">Today</h2>
          <p className="text-xs text-muted-foreground">
            {DATE_FMT.format(new Date(`${prediction.today}T12:00:00Z`))}
          </p>
        </div>

        {/* Perspective toggle pills */}
        <div className="flex items-center rounded-full bg-stone-100 dark:bg-zinc-800/80 p-1 border border-border/50">
          <button
            onClick={() => setPerspective('tracker')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              perspective === 'tracker'
                ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Heart className="h-3.5 w-3.5" fill={perspective === 'tracker' ? 'currentColor' : 'none'} />
            <span>Her View</span>
          </button>
          <button
            onClick={() => setPerspective('partner')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              perspective === 'partner'
                ? 'bg-white dark:bg-zinc-700 text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Partner</span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {perspective === 'tracker' ? (
          <motion.div
            key="tracker"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-6 items-start"
          >
            {/* Left Column: Countdown ring, status & expectation */}
            <div className="md:col-span-5 lg:col-span-5 space-y-4 md:sticky md:top-24">
              {prediction.irregular ? (
                <div className="rounded-2xl bg-amber-100/70 px-4 py-2.5 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/50">
                  <span className="font-semibold">Irregular pattern</span> — dates below are ranges.
                  Keep logging and predictions will sharpen.
                </div>
              ) : null}

              <section className="card-soft p-6 text-center" aria-live="polite">
                {prediction.isLate ? (
                  <>
                    <CountdownRing
                      today={prediction.today}
                      nextPeriodStart={prediction.nextPeriodStart}
                      cycleLength={prediction.cycleLength}
                      bleedingToday={prediction.bleedingToday}
                      periodDay={prediction.periodDay}
                      predictedPeriodDuration={prediction.predictedPeriodDuration}
                      isLate={prediction.isLate}
                    />
                    <h2 className="font-display mt-3 text-lg md:text-xl font-semibold">No period logged yet</h2>
                    <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
                      Cycles vary month to month — this happens to everyone sometimes. Whenever
                      it arrives, log it below and the predictions will re-align.
                    </p>
                  </>
                ) : (
                  <>
                    <CountdownRing
                      today={prediction.today}
                      nextPeriodStart={prediction.nextPeriodStart}
                      cycleLength={prediction.cycleLength}
                      bleedingToday={prediction.bleedingToday}
                      periodDay={prediction.periodDay}
                      predictedPeriodDuration={prediction.predictedPeriodDuration}
                      isLate={false}
                    />
                    <h2 className="font-display mt-3 text-lg md:text-xl font-semibold">{copy?.title}</h2>
                    {copy ? (
                      <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">{copy.body}</p>
                    ) : null}
                  </>
                )}

                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {prediction.nextPeriodStart && !prediction.bleedingToday && !prediction.irregular ? (
                    <span className="chip text-[#9F1239] dark:text-rose-300">
                      Next period {fmtShort(prediction.nextPeriodStart)}
                    </span>
                  ) : null}
                  {pms ? (
                    <span className="chip bg-[#FFF7ED] text-[#9A3412] dark:bg-amber-950/40 dark:text-amber-300">
                      {pms}
                    </span>
                  ) : null}
                  {fertile ? (
                    <span className="chip bg-[#FDBA74]/25 text-[#9A3412] dark:bg-amber-950/40 dark:text-amber-300">
                      {fertile} · estimate
                    </span>
                  ) : null}
                  {prediction.regularity.sigma !== null && !prediction.isLate ? (
                    <span className="chip text-[#44403C] dark:text-stone-300">
                      {prediction.regularity.label} · σ {prediction.regularity.sigma.toFixed(1)}d
                    </span>
                  ) : null}
                </div>

                <p className="mx-auto mt-4 max-w-xs text-xs leading-relaxed text-muted-foreground">
                  {expectationLine(prediction)}
                </p>
              </section>

              <p className="hidden md:block px-2 text-center text-[11px] text-muted-foreground">
                Estimates only — not medical advice, not contraception.
              </p>
            </div>

            {/* Right Column: Actions, today's log & partner signals */}
            <div className="md:col-span-7 lg:col-span-7 space-y-4">
              <PeriodActions
                today={prediction.today}
                todayEntry={todayEntry}
                ongoingEpisodeId={ongoing?.id ?? null}
              />

              <PartnerSignalShelf
                today={prediction.today}
                todayEntry={todayEntry}
              />

              <p className="md:hidden px-2 pb-2 text-center text-[11px] text-muted-foreground">
                Estimates only — not medical advice, not contraception.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="partner"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            <PartnerView
              prediction={prediction}
              todayEntry={todayEntry}
              today={prediction.today}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}


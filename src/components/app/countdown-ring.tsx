'use client'

import { motion } from 'framer-motion'
import { diffDays } from '@/lib/dates'

interface Props {
  today: string
  nextPeriodStart: string | null
  cycleLength: number | null
  bleedingToday: boolean
  periodDay: number | null
  predictedPeriodDuration: number
  isLate: boolean
}

export function CountdownRing({
  today,
  nextPeriodStart,
  cycleLength,
  bleedingToday,
  periodDay,
  predictedPeriodDuration,
  isLate,
}: Props) {
  const daysUntil = nextPeriodStart && !bleedingToday ? diffDays(nextPeriodStart, today) : null

  const progress = bleedingToday
    ? Math.min(1, (periodDay ?? 1) / Math.max(1, predictedPeriodDuration))
    : daysUntil !== null && cycleLength
      ? Math.min(1, Math.max(0, (cycleLength - daysUntil) / cycleLength))
      : 0.1

  const R = 78
  const C = 2 * Math.PI * R

  let center = '—'
  let sub = ''
  if (bleedingToday) {
    center = `Day ${periodDay ?? 1}`
    sub = 'of your period'
  } else if (isLate) {
    center = '–'
    sub = 'no period logged yet'
  } else if (daysUntil !== null) {
    if (daysUntil > 1) {
      center = `~${daysUntil}`
      sub = 'days to go'
    } else if (daysUntil === 1) {
      center = '~1'
      sub = 'day to go'
    } else if (daysUntil === 0) {
      center = 'Today'
      sub = 'expected today'
    } else {
      center = '–'
      sub = 'any day now'
    }
  }

  return (
    <div className="relative mx-auto h-48 w-48" role="img" aria-label={`${center} ${sub}`}>
      <svg viewBox="0 0 176 176" className="h-full w-full -rotate-90">
        <defs>
          <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E11D48" />
            <stop offset="100%" stopColor="#FB7185" />
          </linearGradient>
        </defs>
        {/* Background track */}
        <circle
          cx="88"
          cy="88"
          r={R}
          fill="none"
          stroke="currentColor"
          className="text-rose-500/10 dark:text-rose-500/15"
          strokeWidth="12"
        />
        {/* Animated progress ring */}
        <motion.circle
          cx="88"
          cy="88"
          r={R}
          fill="none"
          stroke="url(#ringGradient)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - progress) }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <motion.div
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <span className="font-display text-3xl font-semibold text-primary">{center}</span>
        <span className="mt-0.5 text-xs text-muted-foreground">{sub}</span>
      </motion.div>
    </div>
  )
}

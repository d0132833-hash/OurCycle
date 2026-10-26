import { diffDays } from '@/lib/dates'

// Countdown ring: shows how far through the cycle she is, with the number
// of days until the next period in the middle. Calm by design — never red,
// never the word "late".

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
        <circle cx="88" cy="88" r={R} fill="none" stroke="rgba(225,29,72,0.10)" strokeWidth="12" />
        <circle
          cx="88"
          cy="88"
          r={R}
          fill="none"
          stroke="#E11D48"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - progress)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-semibold text-primary">{center}</span>
        <span className="mt-0.5 text-xs text-muted-foreground">{sub}</span>
      </div>
    </div>
  )
}

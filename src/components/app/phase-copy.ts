import { addDays, diffDays } from '@/lib/dates'
import type { Prediction } from '@/lib/predictions'
import type { Phase } from '@/lib/types'

export const PHASE_COPY: Record<Phase, { title: string; body: string }> = {
  menstrual: {
    title: 'Menstrual phase',
    body: 'Rest counts as progress today. Warmth, water and gentle movement usually help.',
  },
  follicular: {
    title: 'Follicular phase',
    body: 'Energy is often on the rise now — a good window for plans that need momentum.',
  },
  ovulation: {
    title: 'Ovulation window',
    body: 'Estimated fertile days. An estimate — never a contraceptive method.',
  },
  luteal: {
    title: 'Luteal phase',
    body: 'If PMS feelings surface, they typically ease once the next period begins.',
  },
}

/** One-line expectation under the ring, always honest about uncertainty. */
export function expectationLine(p: Prediction): string {
  if (!p.nextPeriodStart || !p.range) return 'Start logging periods to unlock predictions.'
  const [low, high] = p.range
  if (p.irregular) {
    return `Expected between ${fmtShort(low)} and ${fmtShort(high)} — your pattern varies, so keep logging to sharpen this.`
  }
  return `Expected ${fmtShort(p.nextPeriodStart)} (likely between ${fmtShort(low)} and ${fmtShort(high)}).`
}

export function inWindow(day: string, w: [string, string] | null): boolean {
  return !!w && day >= w[0] && day <= w[1]
}

export function daysIntoWindow(day: string, w: [string, string] | null): number {
  return w ? diffDays(day, w[0]) : -1
}

const SHORT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
})

export function fmtShort(iso: string): string {
  return SHORT.format(new Date(`${iso}T12:00:00Z`))
}

/** Today + N business-free helper used in chips like "PMS window · 2 days" */
export function pmsHint(p: Prediction): string | null {
  if (!p.pmsWindow || p.bleedingToday) return null
  const len = diffDays(p.pmsWindow[1], p.pmsWindow[0]) + 1
  if (inWindow(p.today, p.pmsWindow)) {
    const day = daysIntoWindow(p.today, p.pmsWindow) + 1
    return `PMS window · day ${day} of ${len}`
  }
  const until = diffDays(p.pmsWindow[0], p.today)
  if (until > 0 && until <= 10) return `PMS window in ~${until} days`
  return null
}

export function fertileHint(p: Prediction): string | null {
  const w = p.irregular ? p.fertileWindowRange : p.fertileWindow
  if (!w) return null
  if (inWindow(p.today, w)) return 'Estimated fertile window now'
  const until = diffDays(w[0], p.today)
  if (until > 0 && until <= 14) return `Fertile window in ~${until} days`
  return null
}

export function nextPeriodChip(p: Prediction): { label: string; tone: 'rose' | 'peach' } | null {
  if (!p.nextPeriodStart) return null
  if (p.todayPhase === 'menstrual') return null
  return { label: `Next period ${fmtShort(p.nextPeriodStart)}`, tone: 'rose' }
}

export function phaseOfDate(p: Prediction, d: string): Phase | null {
  // light local re-derivation for chips on other screens
  if (d === p.today) return p.todayPhase
  return null
}

export { addDays }

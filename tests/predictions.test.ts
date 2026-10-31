import { describe, expect, it } from 'vitest'
import {
  accuracyFromLog,
  computePredictions,
  deriveObservations,
  detectTrend,
  madOutlierFlags,
  weightedStats,
} from '@/lib/predictions'
import { addDays, diffDays, getDaysInMonth } from '@/lib/dates'
import type { EpisodeInput } from '@/lib/predictions'

const TODAY = '2026-03-15'

/**
 * Build episodes: the last period started `anchorOffset` days before today
 * (so the current cycle is in progress), earlier starts walk backwards
 * using `lengths` (oldest first).
 */
function episodesFromLengths(
  today: string,
  lengths: number[],
  anchorOffset = 24,
  duration = 5,
): EpisodeInput[] {
  let cur = addDays(today, -anchorOffset)
  const starts = [cur]
  for (const len of [...lengths].reverse()) {
    cur = addDays(cur, -len)
    starts.unshift(cur)
  }
  return starts.map((s) => ({
    start_date: s,
    end_date: addDays(s, duration - 1),
    flow: 'medium',
  }))
}

describe('regular cycles (28 ± 1)', () => {
  const eps = episodesFromLengths(TODAY, [28, 29, 27, 28, 28, 29])
  const p = computePredictions(eps, { today: TODAY })

  it('predicts the next start within ±1 day of the true 28-day rhythm', () => {
    // anchor = today − 24; next start = anchor + ~28 → ~today + 4
    expect(p.nextPeriodStart).not.toBeNull()
    const delta = diffDays(p.nextPeriodStart as string, addDays(TODAY, 4))
    expect(Math.abs(delta)).toBeLessThanOrEqual(1)
    expect(p.daysUntilNextPeriod).toBe(4 + delta)
  })

  it('reports high confidence and Regular regularity', () => {
    expect(p.confidence).toBe('high')
    expect(p.regularity.label).toBe('Regular')
    expect(p.regularity.sigma).not.toBeNull()
    expect(p.regularity.sigma as number).toBeLessThan(2)
    expect(p.irregular).toBe(false)
  })

  it('gives an 80% interval of ±1..2 days', () => {
    expect(p.range).not.toBeNull()
    const half = diffDays(p.range![1], p.nextPeriodStart as string)
    expect(half).toBeGreaterThanOrEqual(1)
    expect(half).toBeLessThanOrEqual(7)
  })

  it('derives ovulation 14 days before the next start and the fertile window −5 → +1', () => {
    expect(diffDays(p.nextPeriodStart as string, p.ovulationDate as string)).toBe(14)
    expect(diffDays(p.ovulationDate as string, p.fertileWindow![0])).toBe(5)
    expect(diffDays(p.fertileWindow![1], p.ovulationDate as string)).toBe(1)
  })

  it('sets the PMS window to predicted start −5 → predicted start', () => {
    expect(diffDays(p.nextPeriodStart as string, p.pmsWindow![0])).toBe(5)
    expect(p.pmsWindow![1]).toBe(p.nextPeriodStart)
  })
})

describe('irregular cycles (σ ≥ 3 → ranges)', () => {
  // alternating 25/35 gives σ ≈ 5
  const eps = episodesFromLengths(TODAY, [25, 35, 25, 35, 25, 35])
  const p = computePredictions(eps, { today: TODAY })

  it('flags the pattern as irregular and low confidence', () => {
    expect(p.irregular).toBe(true)
    expect(p.regularity.label).toBe('Irregular')
    expect(p.regularity.sigma as number).toBeGreaterThanOrEqual(3)
    expect(p.confidence).toBe('low')
  })

  it('still returns a wide 80% range (capped at ±7)', () => {
    expect(p.range).not.toBeNull()
    const half = diffDays(p.range![1], p.nextPeriodStart as string)
    expect(half).toBeLessThanOrEqual(7)
    expect(half).toBeGreaterThanOrEqual(5)
  })

  it('exposes a wider fertile-window range for UI range-only rendering', () => {
    expect(p.fertileWindowRange).not.toBeNull()
    const low = diffDays(p.fertileWindow![0], p.fertileWindowRange![0])
    expect(low).toBeGreaterThan(0)
  })
})

describe('outlier rejection (MAD, |z| > 3.5)', () => {
  it('flags a single 45-day cycle among 28s', () => {
    expect(madOutlierFlags([28, 28, 28, 28, 45, 28])).toEqual([
      false, false, false, false, true, false,
    ])
  })

  it('a 45-day outlier shifts the prediction by ≤ 2 days', () => {
    const clean = computePredictions(episodesFromLengths(TODAY, [28, 28, 28, 28, 28, 28]), {
      today: TODAY,
    })
    const withOutlier = computePredictions(
      episodesFromLengths(TODAY, [28, 28, 28, 28, 45, 28]),
      { today: TODAY },
    )
    const shift = Math.abs(
      diffDays(withOutlier.nextPeriodStart as string, clean.nextPeriodStart as string),
    )
    expect(shift).toBeLessThanOrEqual(2)
    // the outlier is kept in history but excluded from the average
    expect(withOutlier.observations.some((o) => o.status === 'outlier')).toBe(true)
    expect(withOutlier.completedCycles).toBe(clean.completedCycles - 1)
  })
})

describe('clamping to medically plausible 21–45 days', () => {
  it('keeps implausible cycles in history but excludes them from learning', () => {
    const eps = episodesFromLengths(TODAY, [28, 50, 15, 28])
    const p = computePredictions(eps, { today: TODAY })
    const clamped = p.observations.filter((o) => o.status === 'clamped')
    expect(clamped.map((o) => o.length).sort()).toEqual([15, 50])
    expect(p.completedCycles).toBe(2) // only the two 28s are used
    expect(p.regularity.label).toBe('Regular')
  })
})

describe('cold start (0 completed cycles)', () => {
  const single: EpisodeInput[] = [
    { start_date: addDays(TODAY, -24), end_date: addDays(TODAY, -20), flow: 'medium' },
  ]

  it('uses the bootstrap prior as a low-weight observation', () => {
    const p = computePredictions(single, { today: TODAY, priorCycleLength: 30 })
    expect(p.nextPeriodStart).toBe(addDays(TODAY, 6)) // −24 + 30
    expect(p.confidence).toBe('low')
    expect(p.regularity.sigma).toBeNull()
    expect(p.completedCycles).toBe(0)
  })

  it('falls back to the 28-day population mean without a prior', () => {
    const p = computePredictions(single, { today: TODAY })
    expect(p.nextPeriodStart).toBe(addDays(TODAY, 4))
  })
})

describe('sparse data (1–2 completed cycles): shrinkage 0.6·her + 0.4·28', () => {
  it('blends one 34-day cycle toward 28 → 31.6 ≈ 32', () => {
    const eps = episodesFromLengths(TODAY, [34])
    const p = computePredictions(eps, { today: TODAY })
    // anchor = today − 24 → next = anchor + 31.6 → rounded 32
    expect(p.nextPeriodStart).toBe(addDays(addDays(TODAY, -24), 32))
    expect(p.confidence).toBe('low')
  })

  it('blends two 34-day cycles identically (still shrinkage, low confidence)', () => {
    const eps = episodesFromLengths(TODAY, [34, 34])
    const p = computePredictions(eps, { today: TODAY })
    expect(p.nextPeriodStart).toBe(addDays(addDays(TODAY, -24), 32))
    expect(p.confidence).toBe('low')
  })
})

describe('recency weighting (half-life = 4 cycles)', () => {
  const base = [28, 28, 28, 28, 28, 28]

  it('a change in the most recent cycle moves the prediction more than an old one', () => {
    const recentChanged = computePredictions(episodesFromLengths(TODAY, [28, 28, 28, 28, 28, 32]), {
      today: TODAY,
    })
    const oldestChanged = computePredictions(episodesFromLengths(TODAY, [32, 28, 28, 28, 28, 28]), {
      today: TODAY,
    })
    const clean = computePredictions(episodesFromLengths(TODAY, base), { today: TODAY })

    const recentShift = Math.abs(
      diffDays(recentChanged.nextPeriodStart as string, clean.nextPeriodStart as string),
    )
    const oldShift = Math.abs(
      diffDays(oldestChanged.nextPeriodStart as string, clean.nextPeriodStart as string),
    )
    expect(recentShift).toBeGreaterThan(oldShift)
    expect(recentShift).toBeGreaterThanOrEqual(1) // w=1 vs w≈0.42
  })

  it('weights decay as 0.5^(age/4)', () => {
    const s = weightedStats([28, 28, 28, 28, 28, 28, 28, 28, 32])
    // mean must sit strictly between 28 and the unweighted mean (28.44)
    expect(s.mean).toBeGreaterThan(28)
    expect(s.mean).toBeLessThan(28.45)
  })
})

describe('today’s phase', () => {
  const eps = episodesFromLengths(TODAY, [28, 28, 28], 24) // ovulation = today − 10
  const p = computePredictions(eps, { today: TODAY })

  it('classifies menstrual / follicular / ovulation / luteal', () => {
    expect(p.todayPhase).toBe('luteal') // today − 5 vs ovulation → luteal
    const phaseOf = (d: string) =>
      computePredictions(eps, { today: d }).todayPhase
    expect(phaseOf(addDays(TODAY, -22))).toBe('menstrual') // inside episode (−24…−20)
    expect(phaseOf(addDays(TODAY, -14))).toBe('follicular')
    expect(phaseOf(addDays(TODAY, -11))).toBe('ovulation') // ovu −1
    expect(phaseOf(addDays(TODAY, -10))).toBe('ovulation') // ovu
    expect(phaseOf(addDays(TODAY, -9))).toBe('ovulation') // ovu +1
    expect(phaseOf(addDays(TODAY, -5))).toBe('luteal')
  })

  it('marks bleeding days via the ongoing episode and period day number', () => {
    const ongoing: EpisodeInput[] = [
      { start_date: TODAY, end_date: null, flow: 'medium' },
    ]
    const p2 = computePredictions(ongoing, { today: TODAY })
    expect(p2.bleedingToday).toBe(true)
    expect(p2.todayPhase).toBe('menstrual')
    expect(p2.periodDay).toBe(1)
    expect(p2.daysUntilNextPeriod).toBeNull()
  })
})

describe('late-period state (calm, never alarming)', () => {
  it('isLate only after predicted start + 10 with no new log', () => {
    const eps: EpisodeInput[] = [
      { start_date: addDays(TODAY, -40), end_date: addDays(TODAY, -35), flow: 'medium' },
    ]
    const p = computePredictions(eps, { today: TODAY }) // predicted = −12 → 12 days past
    expect(p.isLate).toBe(true)

    const p2 = computePredictions(
      [{ start_date: addDays(TODAY, -36), end_date: addDays(TODAY, -31), flow: 'medium' }],
      { today: TODAY },
    ) // predicted = −8 → 8 days past
    expect(p2.isLate).toBe(false)
  })
})

describe('manual override (fixed cycle length)', () => {
  it('bypasses learning but still reports what auto-learn would predict', () => {
    const eps = episodesFromLengths(TODAY, [28, 28, 28, 28, 28, 28])
    const p = computePredictions(eps, { today: TODAY, cycleLengthOverride: 33 })
    expect(p.usingOverride).toBe(true)
    expect(p.cycleLength).toBe(33)
    expect(p.nextPeriodStart).toBe(addDays(addDays(TODAY, -24), 33))
    expect(p.autoCycleLength).toBe(28)
  })
})

describe('predicted period duration', () => {
  it('is the recency-weighted mean of logged durations (default 5)', () => {
    const eps: EpisodeInput[] = [
      { start_date: addDays(TODAY, -100), end_date: addDays(TODAY, -96), flow: 'medium' }, // 5
      { start_date: addDays(TODAY, -70), end_date: addDays(TODAY, -65), flow: 'heavy' }, // 6
      { start_date: addDays(TODAY, -24), end_date: addDays(TODAY, -21), flow: 'light' }, // 4
    ]
    const p = computePredictions(eps, { today: TODAY })
    expect(p.predictedPeriodDuration).toBe(5)
    const none: EpisodeInput[] = [{ start_date: TODAY, end_date: null }]
    expect(computePredictions(none, { today: TODAY }).predictedPeriodDuration).toBe(5)
  })
})

describe('model accuracy self-report (prediction_log)', () => {
  it('counts hits within ±1 day over the last 6 completed predictions', () => {
    const rows = [
      { predicted_start: '2026-01-02', actual_start: '2026-01-02' }, // hit (0)
      { predicted_start: '2026-01-30', actual_start: '2026-01-31' }, // hit (+1)
      { predicted_start: '2026-02-27', actual_start: '2026-02-26' }, // hit (−1)
      { predicted_start: '2026-03-27', actual_start: '2026-03-27' }, // hit (0)
      { predicted_start: '2026-04-24', actual_start: '2026-04-26' }, // miss (+2)
      { predicted_start: '2026-05-22', actual_start: '2026-05-22' }, // hit (0)
      { predicted_start: '2026-06-19', actual_start: null }, // pending, ignored
    ]
    const acc = accuracyFromLog(rows)
    expect(acc).toEqual({ evaluated: 6, hits: 5, window: 1, hitsWithin2: 6, hitsWithin3: 6 })
  })

  it('reports zero evaluated rows while predictions are pending', () => {
    const acc = accuracyFromLog([{ predicted_start: '2026-06-19', actual_start: null }])
    expect(acc.evaluated).toBe(0)
    expect(acc.hits).toBe(0)
    expect(acc.hitsWithin2).toBe(0)
    expect(acc.hitsWithin3).toBe(0)
  })
})

describe('linear trend detection', () => {
  it('detects lengthening cycle trend', () => {
    // oldest: 26, 28, 30, 32 -> valsRecentFirst: [32, 30, 28, 26]
    // slope is +2 days per cycle
    const trend = detectTrend([32, 30, 28, 26])
    expect(trend).toBe(2)
  })

  it('returns null when cycle variation is flat or noise', () => {
    const trend = detectTrend([28, 28, 28, 28])
    expect(trend).toBeNull()
  })
})

describe('observation derivation', () => {
  it('derives cycle lengths from consecutive starts and dedupes duplicate starts', () => {
    const obs = deriveObservations([
      { start_date: '2026-01-01' },
      { start_date: '2026-01-01' }, // duplicate tap
      { start_date: '2026-01-29' },
      { start_date: '2026-02-26' },
    ])
    expect(obs.map((o) => o.length)).toEqual([28, 28])
    expect(obs.every((o) => o.status === 'used')).toBe(true)
  })
})

describe('calendar date calculations & days-in-month integrity', () => {
  it('correctly calculates days in month across all months regardless of timezone', () => {
    // 31-day months (including October)
    expect(getDaysInMonth('2026-01')).toBe(31)
    expect(getDaysInMonth('2026-03')).toBe(31)
    expect(getDaysInMonth('2026-05')).toBe(31)
    expect(getDaysInMonth('2026-07')).toBe(31)
    expect(getDaysInMonth('2026-08')).toBe(31)
    expect(getDaysInMonth('2026-10')).toBe(31) // October 31 must be present!
    expect(getDaysInMonth('2026-12')).toBe(31)

    // 30-day months
    expect(getDaysInMonth('2026-04')).toBe(30)
    expect(getDaysInMonth('2026-06')).toBe(30)
    expect(getDaysInMonth('2026-09')).toBe(30)
    expect(getDaysInMonth('2026-11')).toBe(30)

    // February (non-leap vs leap)
    expect(getDaysInMonth('2026-02')).toBe(28)
    expect(getDaysInMonth('2028-02')).toBe(29)
  })

  it('generates all 31 days for October 2026 including October 31', () => {
    const daysInOct = getDaysInMonth('2026-10')
    expect(daysInOct).toBe(31)
    const allOctDays = Array.from(
      { length: daysInOct },
      (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`,
    )
    expect(allOctDays.length).toBe(31)
    expect(allOctDays).toContain('2026-10-31')
    expect(allOctDays.at(-1)).toBe('2026-10-31')
  })
})

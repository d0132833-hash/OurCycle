// ============================================================================
// Our Cycle — prediction engine (PRIORITY 1)
// Pure TypeScript, ZERO I/O: every function takes data in and returns results.
// Runs on the server after every write to period_logs; imported by unit tests.
//
// Algorithm (per spec §2.2):
//   1. Cycle lengths from consecutive start_dates, clamped to 21–45 d
//   2. Outlier rejection: modified Z-score via MAD, |z| > 3.5 excluded
//   3. Recency-weighted mean: exponential decay, half-life = 4 cycles
//   4. 80% interval: mean ± max(1.28σ, 1) rounded, capped ±7
//   5. Cold start: bootstrap "typical length" as a low-weight observation
//   6. Sparse data (1–2 cycles): blend 0.6 × weightedMean + 0.4 × 28
//   7. Ovulation = nextStart − 14 (constant luteal in v1)
//   8. Fertile window = ovulation −5 → +1
//   9. Phases: menstrual / follicular / ovulation / luteal
//  10. PMS window = predicted start −5 → predicted start
// ============================================================================

import { addDays, diffDays, parseDay } from './dates'
import type { AccuracyReport, Confidence, Phase, PeriodEpisode, PredictionLogRow } from './types'

export const MIN_CYCLE = 21
export const MAX_CYCLE = 45
export const LUTEAL_LENGTH = 14
export const HALF_LIFE_CYCLES = 4
export const POPULATION_MEAN = 28
/** base weight of the bootstrap prior; decays as real data accumulates */
export const PRIOR_WEIGHT_BASE = 0.3
/** assumed ±days when we have no σ at all (cold start / single cycle) */
export const DEFAULT_HALF_RANGE = 3
/** graduated shrinkage: converge to 100% data over this many cycles */
export const SHRINKAGE_FULL_CYCLES = 5

export interface EpisodeInput {
  start_date: string
  end_date?: string | null
  flow?: string | null
}

export interface EngineOptions {
  today: string
  /** settings "Use fixed cycle length" (21–45); bypasses learning */
  cycleLengthOverride?: number | null
  /** cold-start prior from bootstrap ("typical length") */
  priorCycleLength?: number | null
}

export type CycleStatus = 'used' | 'clamped' | 'outlier'

export interface CycleObservation {
  /** start of the cycle (previous period start) */
  from: string
  /** start of the next period */
  to: string
  length: number
  status: CycleStatus
  weight: number
}

export interface Regularity {
  /** weighted std-dev in days; null while still learning (fewer than 2 usable cycles) */
  sigma: number | null
  label: 'Regular' | 'Varies' | 'Irregular'
}

export interface Prediction {
  today: string
  hasEpisodes: boolean
  /** start date of the most recent logged period (forecast anchor) */
  anchorStart: string | null
  nextPeriodStart: string | null
  range: [string, string] | null
  confidence: Confidence
  /** effective cycle length used for the forecast (override wins) */
  cycleLength: number | null
  /** what auto-learn would predict even when the override is active */
  autoCycleLength: number | null
  usingOverride: boolean
  ovulationDate: string | null
  fertileWindow: [string, string] | null
  /** wider fertile window for irregular mode (σ ≥ 3): range_low−19 → range_high−13 */
  fertileWindowRange: [string, string] | null
  todayPhase: Phase | null
  pmsWindow: [string, string] | null
  predictedPeriodDuration: number
  daysUntilNextPeriod: number | null
  /** today > predicted start + 10 with no new log → calm "no period yet" state */
  isLate: boolean
  /** σ ≥ 3 — the UI must render ranges only, never a single predicted date */
  irregular: boolean
  regularity: Regularity
  completedCycles: number
  observations: CycleObservation[]
  /** true while today is inside a logged bleeding episode */
  bleedingToday: boolean
  /** 1-based day number of the ongoing/current period */
  periodDay: number | null
}

// ---------------------------------------------------------------------------
// small math helpers
// ---------------------------------------------------------------------------

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Modified Z-score outlier rejection using MAD (Iglewicz & Hoaglin).
 * |z| = 0.6745 · (x − median) / MAD > 3.5 → outlier.
 * Falls back to mean absolute deviation when MAD = 0 (more than half the
 * values identical); there a deviation must ALSO exceed 6 days to be
 * rejected, so plausible variation (e.g. one 32-day cycle among 28s) is
 * kept while genuine spikes (illness/travel, e.g. 45 among 28s) are dropped.
 */
export function madOutlierFlags(lengths: number[]): boolean[] {
  const n = lengths.length
  if (n < 3) return lengths.map(() => false)
  const med = median(lengths)
  const absDev = lengths.map((x) => Math.abs(x - med))
  const mad = median(absDev)
  if (mad > 0) {
    return absDev.map((d) => (0.6745 * d) / mad > 3.5)
  }
  const meanAD = absDev.reduce((a, b) => a + b, 0) / n
  if (meanAD === 0) return lengths.map(() => false)
  return absDev.map((d) => (0.7979 * d) / meanAD > 3.5 && d > 6)
}

export interface WeightedStats {
  mean: number
  sigma: number | null
  count: number
}

/** Exponential recency weighting: most recent observation has age 0, w = 0.5^(age/4). */
export function weightedStats(values: number[]): WeightedStats {
  if (values.length === 0) return { mean: 0, sigma: null, count: 0 }
  let wSum = 0
  let wx = 0
  values.forEach((x, age) => {
    const w = Math.pow(0.5, age / HALF_LIFE_CYCLES)
    wSum += w
    wx += w * x
  })
  const mean = wx / wSum
  if (values.length < 2) return { mean, sigma: null, count: values.length }
  let wVar = 0
  let wSqSum = 0
  values.forEach((x, age) => {
    const w = Math.pow(0.5, age / HALF_LIFE_CYCLES)
    wVar += w * (x - mean) * (x - mean)
    wSqSum += w * w
  })
  // Bessel-like reliability weight correction: wSum - (sum w_i^2)/wSum
  const denom = wSum - wSqSum / wSum
  const sigma = denom > 0 ? Math.sqrt(wVar / denom) : Math.sqrt(wVar / wSum)
  return { mean, sigma, count: values.length }
}

/**
 * Simple linear trend detection for cycle lengths over time.
 * If cycles are systematically lengthening or shortening (e.g. perimenopause),
 * returns an adjustment in days (clamped to [-3, 3]), or null if trend is negligible.
 * Expects `valsRecentFirst` with most recent cycle first (age 0).
 */
export function detectTrend(valsRecentFirst: number[]): number | null {
  const n = valsRecentFirst.length
  if (n < 4) return null
  // Chronological order: 0 is oldest, n-1 is most recent
  const chrono = [...valsRecentFirst].reverse()
  const xMean = (n - 1) / 2
  const yMean = chrono.reduce((a, b) => a + b, 0) / n

  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    const dx = i - xMean
    num += dx * (chrono[i] - yMean)
    den += dx * dx
  }
  if (den === 0) return null
  const slope = num / den // days per cycle
  // Only apply if trend is noticeable (|slope| >= 0.25 days/cycle)
  if (Math.abs(slope) < 0.25) return null
  // Clamp adjustment to [-3, 3] to prevent extreme extrapolation
  return Math.max(-3, Math.min(3, Math.round(slope * 10) / 10))
}

// ---------------------------------------------------------------------------
// core computation
// ---------------------------------------------------------------------------

/** Sort episodes ascending and derive cycle-length observations from consecutive starts. */
export function deriveObservations(episodes: EpisodeInput[]): CycleObservation[] {
  const starts = [...episodes]
    .map((e) => e.start_date)
    .filter((s, i, arr): s is string => typeof s === 'string' && s.length === 10 && arr.indexOf(s) === i)
    .sort()
  const obs: CycleObservation[] = []
  for (let i = 1; i < starts.length; i++) {
    const length = diffDays(starts[i], starts[i - 1])
    if (length <= 0) continue // defensive: duplicate/backwards data
    obs.push({
      from: starts[i - 1],
      to: starts[i],
      length,
      status: length >= MIN_CYCLE && length <= MAX_CYCLE ? 'used' : 'clamped',
      weight: 0,
    })
  }
  return obs
}

/**
 * Main entry point. Everything any screen needs comes from this object.
 */
export function computePredictions(
  episodes: EpisodeInput[],
  opts: EngineOptions,
): Prediction {
  const today = opts.today
  const sorted = [...episodes].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const anchorStart = sorted.length ? sorted[sorted.length - 1].start_date : null

  // ---- bleeding state ------------------------------------------------------
  const activeEpisode = sorted.find(
    (e) => e.start_date <= today && (e.end_date == null || today <= e.end_date),
  )
  const bleedingToday = activeEpisode !== undefined
  const periodDay = activeEpisode ? diffDays(today, activeEpisode.start_date) + 1 : null

  // ---- cycle-length observations --------------------------------------------
  const observations = deriveObservations(episodes)
  const inRange = observations.filter((o) => o.status === 'used')
  const outlierFlags = madOutlierFlags(inRange.map((o) => o.length))
  inRange.forEach((o, i) => {
    if (outlierFlags[i]) o.status = 'outlier'
  })
  const used = inRange.filter((o) => o.status === 'used') // most recent last
  used.forEach((o, i) => {
    o.weight = Math.pow(0.5, (used.length - 1 - i) / HALF_LIFE_CYCLES)
  })

  const completedCycles = used.length
  const usingOverride =
    opts.cycleLengthOverride !== null &&
    opts.cycleLengthOverride !== undefined &&
    Number.isFinite(opts.cycleLengthOverride)

  // ---- learned mean + σ (auto-learn result, always computed) ------------------
  let autoMean: number | null = null
  let sigma: number | null = null

  if (completedCycles === 0) {
    // Cold start: the bootstrap "typical length" acts as a low-weight observation.
    autoMean = opts.priorCycleLength ?? POPULATION_MEAN
    sigma = null
  } else {
    // real observations, most recent first for weighting
    const realVals = [...used].reverse().map((o) => o.length)
    const stats = weightedStats(realVals)
    let her = stats.mean
    if (opts.priorCycleLength) {
      // cold-start prior decays as real data accumulates
      const priorW = PRIOR_WEIGHT_BASE / (1 + completedCycles)
      let wSum = 0
      let wx = 0
      realVals.forEach((x, age) => {
        const w = Math.pow(0.5, age / HALF_LIFE_CYCLES)
        wSum += w
        wx += w * x
      })
      wSum += priorW
      wx += priorW * opts.priorCycleLength
      her = wx / wSum
    }
    // Graduated shrinkage: smoothly converge from prior to data
    const blend =
      completedCycles <= 2
        ? 0.6
        : completedCycles === 3
          ? 0.75
          : completedCycles === 4
            ? 0.9
            : 1.0
    autoMean = blend * her + (1 - blend) * POPULATION_MEAN

    // Trend detection: if cycles are systematically changing, adjust
    if (completedCycles >= 4) {
      const trend = detectTrend(realVals)
      if (trend !== null) autoMean += trend
    }
    sigma = stats.sigma
  }

  // ---- forecast ---------------------------------------------------------------
  const effectiveLength = usingOverride
    ? (opts.cycleLengthOverride as number)
    : autoMean

  let nextPeriodStart: string | null = null
  let range: [string, string] | null = null

  if (effectiveLength && anchorStart) {
    nextPeriodStart = addDays(anchorStart, Math.round(effectiveLength))
    let half: number
    if (sigma !== null) {
      half = Math.min(7, Math.max(1, Math.round(1.28 * sigma)))
    } else {
      half = DEFAULT_HALF_RANGE
    }
    range = [addDays(nextPeriodStart, -half), addDays(nextPeriodStart, half)]
  }

  // ---- confidence ---------------------------------------------------------------
  let confidence: Confidence = 'low'
  if (usingOverride) {
    confidence = completedCycles >= 3 && sigma !== null && sigma < 2 ? 'medium' : 'low'
  } else if (completedCycles >= 3 && sigma !== null) {
    confidence = sigma < 2 ? 'high' : sigma < 3 ? 'medium' : 'low'
  }

  const irregular = sigma !== null && sigma >= 3

  // ---- derived dates ----------------------------------------------------------------
  const ovulationDate = nextPeriodStart ? addDays(nextPeriodStart, -LUTEAL_LENGTH) : null
  const fertileWindow: [string, string] | null = ovulationDate
    ? [addDays(ovulationDate, -5), addDays(ovulationDate, 1)]
    : null
  const fertileWindowRange: [string, string] | null =
    range && nextPeriodStart
      ? [
          addDays(range[0], -LUTEAL_LENGTH - 5),
          addDays(range[1], -LUTEAL_LENGTH + 1),
        ]
      : null
  const pmsWindow: [string, string] | null = nextPeriodStart
    ? [addDays(nextPeriodStart, -5), nextPeriodStart]
    : null

  // ---- predicted period duration (recency-weighted over ended episodes) ---------------
  const durations = sorted
    .filter((e) => e.end_date && e.end_date >= e.start_date)
    .map((e) => diffDays(e.end_date as string, e.start_date) + 1)
    .reverse()
  const durationStats = weightedStats(durations)
  const predictedPeriodDuration =
    durations.length > 0 ? Math.max(1, Math.round(durationStats.mean)) : 5

  // ---- countdown / lateness --------------------------------------------------------------
  const daysUntilNextPeriod =
    nextPeriodStart && !bleedingToday ? diffDays(nextPeriodStart, today) : null
  const isLate =
    !bleedingToday &&
    nextPeriodStart !== null &&
    diffDays(today, nextPeriodStart) > 10

  // ---- today's phase ----------------------------------------------------------------------
  const todayPhase = bleedingToday
    ? 'menstrual'
    : phaseForDay(today, sorted, nextPeriodStart)

  return {
    today,
    hasEpisodes: sorted.length > 0,
    anchorStart,
    nextPeriodStart,
    range,
    confidence,
    cycleLength: effectiveLength ? Math.round(effectiveLength) : null,
    autoCycleLength: autoMean ? Math.round(autoMean) : null,
    usingOverride,
    ovulationDate,
    fertileWindow,
    fertileWindowRange,
    todayPhase,
    pmsWindow,
    predictedPeriodDuration,
    daysUntilNextPeriod,
    isLate,
    irregular,
    regularity: {
      sigma,
      label: sigma === null ? 'Varies' : sigma < 2 ? 'Regular' : sigma < 3 ? 'Varies' : 'Irregular',
    },
    completedCycles,
    observations,
    bleedingToday,
    periodDay,
  }
}

/**
 * Phase for an arbitrary day. `predictedNext` is the forecast start of the
 * period that follows the last logged episode (used for the open-ended,
 * most-recent cycle). Falls back to the population mean when unavailable.
 */
export function phaseForDay(
  day: string,
  sortedEpisodes: EpisodeInput[],
  predictedNext: string | null,
): Phase | null {
  const starts = sortedEpisodes.map((e) => e.start_date).sort()
  const nextStart = starts.find((s) => s > day)
  if (nextStart) {
    // historical day inside a completed cycle → ovulation = next start − 14
    return phaseRelativeToOvulation(day, addDays(nextStart, -LUTEAL_LENGTH), nextStart)
  }
  if (predictedNext && day >= (starts.at(-1) ?? '')) {
    if (day >= predictedNext) return 'luteal' // overdue: still waiting
    return phaseRelativeToOvulation(day, addDays(predictedNext, -LUTEAL_LENGTH), predictedNext)
  }
  return null
}

function phaseRelativeToOvulation(day: string, ovulation: string, nextStart: string): Phase {
  const d = diffDays(day, ovulation) // negative = before ovulation
  if (Math.abs(d) <= 1) return 'ovulation'
  if (d < -1) return 'follicular'
  return 'luteal'
}

/**
 * Phase map over an inclusive day range (for Insights charts).
 * Uses each historical cycle's own ovulation (next start − 14) and the
 * prediction's forecast for the current, still-open cycle.
 */
export function buildPhaseMap(
  episodes: EpisodeInput[],
  from: string,
  to: string,
  prediction: Prediction,
): Record<string, Phase> {
  const sorted = [...episodes].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const map: Record<string, Phase> = {}

  // bleeding days come straight from episodes (end null → treat as ongoing to today)
  for (const e of sorted) {
    const end = e.end_date ?? (e.start_date <= prediction.today ? prediction.today : e.start_date)
    for (let d = e.start_date; d <= end; d = addDays(d, 1)) {
      if (d >= from && d <= to) map[d] = 'menstrual'
    }
  }

  let cur = from
  while (cur <= to) {
    if (!map[cur]) {
      const p = phaseForDay(cur, sorted, prediction.nextPeriodStart)
      if (p) map[cur] = p
    }
    cur = addDays(cur, 1)
  }
  return map
}

/**
 * Model hit-rate: of the last `n` completed predictions in prediction_log,
 * how many landed within ±window days of the actual start.
 * Copy: "Model accuracy: 5/6 within ±1 day".
 */
export function accuracyFromLog(
  rows: Pick<PredictionLogRow, 'predicted_start' | 'actual_start'>[],
  n = 6,
  window = 1,
): AccuracyReport {
  const completed = rows
    .filter((r) => r.actual_start)
    .sort((a, b) => b.predicted_start.localeCompare(a.predicted_start))
    .slice(0, n)
  const hits = completed.filter(
    (r) => Math.abs(diffDays(r.actual_start as string, r.predicted_start)) <= window,
  ).length
  const hitsWithin2 = completed.filter(
    (r) => Math.abs(diffDays(r.actual_start as string, r.predicted_start)) <= 2,
  ).length
  const hitsWithin3 = completed.filter(
    (r) => Math.abs(diffDays(r.actual_start as string, r.predicted_start)) <= 3,
  ).length
  return { evaluated: completed.length, hits, window, hitsWithin2, hitsWithin3 }
}

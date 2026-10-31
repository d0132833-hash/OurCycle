/**
 * Our Cycle — demo data seeder.
 *
 * Seeds 8 realistic completed cycles (27–31 days, one 34-day outlier),
 * day entries across the whole span, and a backfilled prediction_log so
 * the Insights accuracy card has data immediately. The current cycle is
 * 24 days in, so the Today screen shows "period expected in ~4 days".
 *
 * Usage:
 *   npm run seed                → local dev store (.data/db.json)
 *   SUPABASE_URL=… SUPABASE_SERVICE_KEY=… npm run seed   → your Supabase project
 * If data already exists the script refuses; for Supabase run first:
 *   TRUNCATE period_logs, day_entries, prediction_log;  (SQL editor)
 */

import { getStore } from '../src/lib/db'
import { hashPassphrase } from '../src/lib/crypto'
import { addDays, diffDays, todayInTz } from '../src/lib/dates'
import { syncPredictionLog } from '../src/lib/recompute'
import type { SymptomKey } from '../src/lib/types'

// deterministic RNG so the demo always looks the same
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20261026)
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]
const between = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))

async function main() {
  const store = getStore()
  console.log(`seeding into: ${store.kind === 'local' ? 'local dev store' : 'Supabase project'}`)

  if (!(await store.getSecret())) {
    const seedPin = process.env.SEED_VAULT_PIN || process.env.VAULT_PIN
    if (seedPin) {
      await store.createSecret(hashPassphrase(seedPin))
      console.log('initialized vault secret with PIN from environment variable')
    } else {
      console.log('No existing vault secret found. Vault remains uninitialized for first-time setup at /setup.')
    }
  }

  const existing = await store.listPeriods()
  if (existing.length > 0) {
    console.error(
      `\nData already exists (${existing.length} periods). Refusing to seed over it.\n` +
        `For a fresh demo on the LOCAL dev store: rm .data/db.json && npm run seed\n` +
        `For Supabase: TRUNCATE period_logs, day_entries, prediction_log; then re-run.\n`,
    )
    process.exit(1)
  }

  const today = todayInTz('Asia/Calcutta')

  // 8 completed cycle lengths: 27–31 range with a single 34-day outlier.
  // MAD outlier rejection will flag the 34 and exclude it from forecasts.
  const lengths = [28, 29, 27, 30, 28, 34, 29, 28] // oldest → newest
  const durations = [5, 4, 5, 6, 4, 5, 5, 4, 5]
  const flows = ['heavy', 'medium', 'medium', 'heavy', 'light', 'medium', 'medium', 'light', 'medium'] as const

  // walk backwards from "today − 24" so the current cycle sits mid-luteal
  const starts: string[] = [addDays(today, -24)]
  for (let i = lengths.length - 1; i >= 0; i--) {
    starts.unshift(addDays(starts[0], -lengths[i]))
  }

  // --- episodes --------------------------------------------------------------
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i]
    // every episode is fully in the past — the current cycle is mid-luteal
    await store.insertPeriod({
      start_date: start,
      end_date: addDays(start, durations[i] - 1),
      flow: flows[i],
    })
  }
  console.log(`inserted ${starts.length} period episodes`)

  // --- day entries -------------------------------------------------------------
  const NOTES = [
    'Long day at work, but the evening walk helped.',
    'Slept really well — felt reset.',
    'Cramps after lunch, heating pad saved the evening.',
    'Yoga before breakfast made a difference.',
    'Irritable for no clear reason, was fine after tea.',
    'Dinner out — rich food, a bit bloated now.',
    'Quiet Sunday, lots of reading.',
    'Headache started around 3pm, gone by night.',
    'Good gym session, felt strong.',
    'Skipped coffee today, surprisingly fine.',
  ]

  let noteBudget = Math.floor(diffDays(today, starts[0]) / 12) // ~1 note per 12 days
  const symptoms: SymptomKey[] = [
    'cramps',
    'headache',
    'back_pain',
    'breast_tenderness',
    'acne',
    'bloating',
    'fatigue',
  ]

  let count = 0
  for (let d = starts[0]; d <= today; d = addDays(d, 1)) {
    // which episode does this day belong to?
    const epIdx = starts.findIndex((s, i) => d >= s && (i === starts.length - 1 || d < starts[i + 1]))
    const epStart = starts[epIdx]
    const epDur = durations[epIdx]
    const dayInCycle = diffDays(d, epStart) + 1
    const dayOfPeriod = diffDays(d, epStart) + 1
    const epEnd = addDays(epStart, epDur - 1)
    const isPeriod = d <= epEnd
    // ovulation of this cycle = next start − 14 (last cycle: +28 − 14)
    const nextStart = epIdx < starts.length - 1 ? starts[epIdx + 1] : addDays(epStart, 28)
    const daysToOvu = diffDays(addDays(nextStart, -14), d)
    const daysToNext = diffDays(nextStart, d)

    // flow
    let flow: string | null = null
    if (isPeriod) {
      flow =
        dayOfPeriod === 1 ? 'heavy'
        : dayOfPeriod === 2 ? (rnd() < 0.7 ? 'heavy' : 'medium')
        : dayOfPeriod === 3 ? 'medium'
        : dayOfPeriod === 4 ? 'light'
        : rnd() < 0.5 ? 'light' : 'spotting'
    } else {
      flow = 'none'
    }

    // mood / energy / libido with phase flavor
    let mood = between(3, 4)
    let energy = between(3, 4)
    let libido = between(2, 3)
    if (isPeriod) {
      energy = Math.max(1, energy - 1)
      mood = between(2, 3)
    } else if (daysToOvu >= -2 && daysToOvu <= 3) {
      libido = Math.min(5, libido + between(1, 2))
      mood = Math.min(5, mood + 1)
      energy = Math.min(5, energy + between(0, 1))
    } else if (daysToNext <= 6 && daysToNext >= 0) {
      mood = Math.max(1, mood - between(0, 1))
      energy = Math.max(1, energy - between(0, 1))
    }
    mood = Math.min(5, Math.max(1, mood + (rnd() < 0.15 ? pick([-1, 1]) : 0)))

    // symptoms
    const sVals: Partial<Record<SymptomKey, number | null>> = {}
    for (const s of symptoms) sVals[s] = null
    if (isPeriod) {
      if (dayOfPeriod <= 2) sVals.cramps = between(2, 3)
      else if (dayOfPeriod <= 4) sVals.cramps = between(1, 2)
      sVals.back_pain = dayOfPeriod <= 3 ? between(1, 2) : null
      sVals.fatigue = dayOfPeriod <= 3 ? between(1, 2) : null
      sVals.bloating = rnd() < 0.5 ? 1 : null
    } else {
      if (daysToNext <= 6 && daysToNext >= 1) {
        if (rnd() < 0.45) sVals.headache = between(1, 2)
        if (rnd() < 0.4) sVals.breast_tenderness = between(1, 2)
        if (rnd() < 0.4) sVals.bloating = between(1, 2)
        if (rnd() < 0.3) sVals.acne = 1
      }
      if (rnd() < 0.15) sVals.headache = 1
      if (rnd() < 0.1) sVals.fatigue = 1
    }

    const note = !isPeriod && noteBudget > 0 && rnd() < 0.12 ? (noteBudget--, pick(NOTES)) : null

    await store.upsertDay({
      date: d,
      flow,
      mood,
      energy,
      libido,
      cramps: sVals.cramps,
      headache: sVals.headache,
      back_pain: sVals.back_pain,
      breast_tenderness: sVals.breast_tenderness,
      acne: sVals.acne,
      bloating: sVals.bloating,
      fatigue: sVals.fatigue,
      note,
    })
    count++
  }
  console.log(`inserted ${count} day entries`)

  // --- prediction_log backfill ---------------------------------------------------
  // six completed forecasts with plausible errors → accuracy card shows 5/6 ±1
  const errors = [0, 1, -1, 0, -1, 2]
  const anchorIdx0 = starts.length - 7 // anchors for cycles 3..8
  for (let i = 0; i < 6; i++) {
    const anchor = starts[anchorIdx0 + i]
    const actual = starts[anchorIdx0 + i + 1]
    const predicted = addDays(actual, -errors[i])
    await store.upsertPredictionByAnchor({
      anchor_start: anchor,
      predicted_start: predicted,
      range_low: addDays(predicted, -3),
      range_high: addDays(predicted, 3),
    })
    await store.fillPendingActuals([actual])
  }
  console.log('backfilled 6 completed forecasts (5/6 within ±1 day)')

  // current pending forecast for the latest anchor
  const prediction = await syncPredictionLog()
  console.log(
    `current forecast: next start ${prediction.nextPeriodStart} ` +
      `(range ${prediction.range?.[0]} → ${prediction.range?.[1]}, ${prediction.confidence})`,
  )
  console.log('seed complete ✔')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

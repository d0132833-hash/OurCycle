import { getStore } from './db'
import { computePredictions, accuracyFromLog } from './predictions'
import { todayInTz } from './dates'
import type { Prediction } from './predictions'
import type { AccuracyReport } from './types'

/**
 * Fresh prediction for the current data + settings. Read-only.
 */
export async function computeCurrentPrediction(): Promise<Prediction> {
  const store = getStore()
  const [episodes, settings] = await Promise.all([store.listPeriods(), store.getSettings()])
  return computePredictions(episodes, {
    today: todayInTz(settings.timezone),
    cycleLengthOverride: settings.cycle_length_override,
    priorCycleLength: settings.bootstrap_cycle_length,
  })
}

/**
 * Self-healing recompute — called after EVERY write to period_logs
 * (add / edit / delete, including backdated edits):
 *   1. fill actual_start on any pending forecast whose real period now exists
 *   2. upsert the current forecast row anchored at the latest period start
 */
export async function syncPredictionLog(): Promise<Prediction> {
  const store = getStore()
  const prediction = await computeCurrentPrediction()
  const episodes = await store.listPeriods()
  await store.fillPendingActuals(episodes.map((e) => e.start_date))
  if (prediction.anchorStart && prediction.nextPeriodStart && prediction.range) {
    await store.upsertPredictionByAnchor({
      anchor_start: prediction.anchorStart,
      predicted_start: prediction.nextPeriodStart,
      range_low: prediction.range[0],
      range_high: prediction.range[1],
    })
  }
  return prediction
}

export async function getAccuracy(): Promise<AccuracyReport> {
  const rows = await getStore().listPredictions()
  return accuracyFromLog(rows)
}

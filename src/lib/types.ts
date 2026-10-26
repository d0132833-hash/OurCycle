// Shared domain types for Our Cycle.
// All dates in the domain layer are plain 'YYYY-MM-DD' strings (see dates.ts).

export type EpisodeFlow = 'spotting' | 'light' | 'medium' | 'heavy'
export type DayFlow = 'none' | 'spotting' | 'light' | 'medium' | 'heavy'

export const FLOWS: EpisodeFlow[] = ['spotting', 'light', 'medium', 'heavy']
export const DAY_FLOWS: DayFlow[] = ['none', 'spotting', 'light', 'medium', 'heavy']

export const SYMPTOM_KEYS = [
  'cramps',
  'headache',
  'back_pain',
  'breast_tenderness',
  'acne',
  'bloating',
  'fatigue',
] as const
export type SymptomKey = (typeof SYMPTOM_KEYS)[number]

export const SYMPTOM_LABELS: Record<SymptomKey, string> = {
  cramps: 'Cramps',
  headache: 'Headache',
  back_pain: 'Back pain',
  breast_tenderness: 'Breast tenderness',
  acne: 'Acne',
  bloating: 'Bloating',
  fatigue: 'Fatigue',
}

/** One logged period episode (period_logs row). */
export interface PeriodEpisode {
  id: string
  start_date: string
  /** null = ongoing (last bleeding day not yet logged) */
  end_date: string | null
  flow: EpisodeFlow | null
  created_at?: string
  updated_at?: string
}

export interface DayEntry {
  date: string
  flow: DayFlow | null
  mood: number | null
  energy: number | null
  libido: number | null
  cramps: number | null
  headache: number | null
  back_pain: number | null
  breast_tenderness: number | null
  acne: number | null
  bloating: number | null
  fatigue: number | null
  bbt?: number | null
  weight?: number | null
  note: string | null
  created_at?: string
  updated_at?: string
}

export interface AppSettings {
  id: number
  /** user-chosen fixed length; null = learn automatically */
  cycle_length_override: number | null
  timezone: string
  /** cold-start prior from bootstrap form; null once enough real cycles exist */
  bootstrap_cycle_length: number | null
}

export interface AppSecretRow {
  passphrase_hash: string
  session_epoch: number
}

export interface LoginThrottleRow {
  fail_count: number
  locked_until: string | null // ISO timestamp
}

export interface PredictionLogRow {
  id: string
  anchor_start: string
  predicted_start: string
  range_low: string | null
  range_high: string | null
  made_at: string
  actual_start: string | null
}

export type Phase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal'
export type Confidence = 'high' | 'medium' | 'low'

export interface AccuracyReport {
  evaluated: number // completed predictions looked at (max 6)
  hits: number // within ±1 day
  window: number // ±days that counts as a hit
  hitsWithin2?: number // within ±2 days
  hitsWithin3?: number // within ±3 days
}

export interface SessionPayload {
  /** session epoch — must match app_secrets.session_epoch */
  v: number
  /** issued at (unix seconds) */
  iat: number
  /** expiry (unix seconds) */
  exp: number
  /** random token id */
  j: string
}

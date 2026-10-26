import type {
  AppSecretRow,
  AppSettings,
  DayEntry,
  LoginThrottleRow,
  PeriodEpisode,
  PredictionLogRow,
  SymptomKey,
} from './types'

export interface PeriodInput {
  start_date: string
  end_date?: string | null
  flow?: string | null
}

export interface DayInput {
  date: string
  flow?: string | null
  mood?: number | null
  energy?: number | null
  libido?: number | null
  cramps?: number | null
  headache?: number | null
  back_pain?: number | null
  breast_tenderness?: number | null
  acne?: number | null
  bloating?: number | null
  fatigue?: number | null
  note?: string | null
}

export interface PredictionUpsert {
  anchor_start: string
  predicted_start: string
  range_low: string | null
  range_high: string | null
}

/**
 * Storage contract used by every server route and server component.
 * Implementations:
 *  - SupabaseStore  (production: service-role key, RLS deny-all)
 *  - LocalFileStore (local dev / preview only, no Supabase env configured)
 *
 * The rest of the codebase never knows which one is active.
 */
export interface Store {
  readonly kind: 'supabase' | 'local'

  // --- secrets & throttle -------------------------------------------------
  getSecret(): Promise<AppSecretRow | null>
  /** First-run: store the argon2id hash. No-op/fails if it already exists. */
  createSecret(passphraseHash: string): Promise<AppSecretRow>
  /** Vault rotation: re-hash + bump epoch so every old session dies. */
  rotateSecret(passphraseHash: string): Promise<AppSecretRow>
  getThrottle(): Promise<LoginThrottleRow>
  saveThrottle(row: LoginThrottleRow): Promise<void>

  // --- period episodes ----------------------------------------------------
  listPeriods(): Promise<PeriodEpisode[]>
  insertPeriod(input: PeriodInput): Promise<PeriodEpisode>
  updatePeriod(
    id: string,
    patch: Partial<Pick<PeriodEpisode, 'start_date' | 'end_date' | 'flow'>>,
  ): Promise<PeriodEpisode | null>
  deletePeriod(id: string): Promise<void>
  hasPeriodOn(start: string): Promise<boolean>

  // --- day entries ----------------------------------------------------------
  listDays(from?: string, to?: string): Promise<DayEntry[]>
  /** Merge-upsert: only provided fields are overwritten. */
  upsertDay(input: DayInput): Promise<DayEntry>
  deleteDay(date: string): Promise<void>

  // --- settings -------------------------------------------------------------
  getSettings(): Promise<AppSettings>
  updateSettings(
    patch: Partial<Pick<AppSettings, 'cycle_length_override' | 'timezone' | 'bootstrap_cycle_length'>>,
  ): Promise<AppSettings>

  // --- prediction log -------------------------------------------------------
  listPredictions(): Promise<PredictionLogRow[]>
  /** Insert or update the pending forecast anchored at anchor_start. */
  upsertPredictionByAnchor(row: PredictionUpsert): Promise<void>
  /**
   * Self-healing: for every forecast without an actual yet, fill in the
   * first real period start that came after its anchor.
   */
  fillPendingActuals(actualStarts: string[]): Promise<void>

  // --- misc & data reset -----------------------------------------------------
  deleteAllData(): Promise<void>
  initialized(): Promise<boolean>
}

export const DAY_INT_FIELDS: (keyof DayInput)[] = [
  'mood',
  'energy',
  'libido',
  'cramps',
  'headache',
  'back_pain',
  'breast_tenderness',
  'acne',
  'bloating',
  'fatigue',
]

export const SYMPTOM_FIELDS: SymptomKey[] = [
  'cramps',
  'headache',
  'back_pain',
  'breast_tenderness',
  'acne',
  'bloating',
  'fatigue',
]

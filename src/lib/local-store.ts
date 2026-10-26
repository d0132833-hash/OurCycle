import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  AppSecretRow,
  AppSettings,
  DayEntry,
  LoginThrottleRow,
  PeriodEpisode,
  PredictionLogRow,
} from './types'
import { DAY_INT_FIELDS, type DayInput, type PeriodInput, type PredictionUpsert, type Store } from './storage'

interface DatabaseSchema {
  secret: AppSecretRow | null
  throttle: LoginThrottleRow
  settings: AppSettings
  periods: PeriodEpisode[]
  days: Record<string, DayEntry>
  predictions: PredictionLogRow[]
}

const DEFAULT_DB: DatabaseSchema = {
  secret: null,
  throttle: { fail_count: 0, locked_until: null },
  settings: {
    id: 1,
    cycle_length_override: null,
    timezone: 'Asia/Calcutta',
    bootstrap_cycle_length: null,
  },
  periods: [],
  days: {},
  predictions: [],
}

/**
 * LocalFileStore (.data/db.json) — enables running and testing OurCycle
 * completely offline without requiring Supabase or external dependencies.
 */
export class LocalFileStore implements Store {
  readonly kind = 'local' as const
  private filePath: string
  private memData: DatabaseSchema | null = null

  constructor(filePath?: string) {
    this.filePath = filePath || path.join(process.cwd(), '.data', 'db.json')
    if (this.filePath === ':memory:') {
      this.memData = structuredClone(DEFAULT_DB)
    }
  }

  private read(): DatabaseSchema {
    if (this.filePath === ':memory:') {
      return this.memData || structuredClone(DEFAULT_DB)
    }
    try {
      if (!fs.existsSync(this.filePath)) {
        return structuredClone(DEFAULT_DB)
      }
      const raw = fs.readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      return {
        ...structuredClone(DEFAULT_DB),
        ...parsed,
        settings: { ...DEFAULT_DB.settings, ...(parsed.settings || {}) },
      }
    } catch {
      return structuredClone(DEFAULT_DB)
    }
  }

  private write(data: DatabaseSchema): void {
    if (this.filePath === ':memory:') {
      this.memData = data
      return
    }
    try {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8')
    } catch {
      // Ignore write errors in restricted envs
    }
  }

  // --- secrets & throttle ---------------------------------------------------
  async getSecret(): Promise<AppSecretRow | null> {
    const db = this.read()
    return db.secret
  }

  async createSecret(passphraseHash: string): Promise<AppSecretRow> {
    const db = this.read()
    const secret: AppSecretRow = { passphrase_hash: passphraseHash, session_epoch: 1 }
    db.secret = secret
    this.write(db)
    return secret
  }

  async rotateSecret(passphraseHash: string): Promise<AppSecretRow> {
    const db = this.read()
    const nextEpoch = (db.secret?.session_epoch ?? 0) + 1
    const secret: AppSecretRow = { passphrase_hash: passphraseHash, session_epoch: nextEpoch }
    db.secret = secret
    this.write(db)
    return secret
  }

  async getThrottle(): Promise<LoginThrottleRow> {
    const db = this.read()
    return db.throttle ?? { fail_count: 0, locked_until: null }
  }

  async saveThrottle(row: LoginThrottleRow): Promise<void> {
    const db = this.read()
    db.throttle = { ...row }
    this.write(db)
  }

  // --- periods ---------------------------------------------------------------
  async listPeriods(): Promise<PeriodEpisode[]> {
    const db = this.read()
    return [...db.periods].sort((a, b) => a.start_date.localeCompare(b.start_date))
  }

  async hasPeriodOn(start: string): Promise<boolean> {
    const db = this.read()
    return db.periods.some((p) => p.start_date === start)
  }

  async insertPeriod(input: PeriodInput): Promise<PeriodEpisode> {
    const db = this.read()
    const episode: PeriodEpisode = {
      id: randomUUID(),
      start_date: input.start_date,
      end_date: input.end_date ?? null,
      flow: (input.flow as PeriodEpisode['flow']) ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    db.periods.push(episode)
    this.write(db)
    return episode
  }

  async updatePeriod(
    id: string,
    patch: Partial<Pick<PeriodEpisode, 'start_date' | 'end_date' | 'flow'>>,
  ): Promise<PeriodEpisode | null> {
    const db = this.read()
    const idx = db.periods.findIndex((p) => p.id === id)
    if (idx === -1) return null
    const existing = db.periods[idx]
    const updated: PeriodEpisode = {
      ...existing,
      ...patch,
      updated_at: new Date().toISOString(),
    }
    db.periods[idx] = updated
    this.write(db)
    return updated
  }

  async deletePeriod(id: string): Promise<void> {
    const db = this.read()
    db.periods = db.periods.filter((p) => p.id !== id)
    this.write(db)
  }

  // --- days --------------------------------------------------------------------
  async listDays(from?: string, to?: string): Promise<DayEntry[]> {
    const db = this.read()
    const entries = Object.values(db.days)
    let filtered = entries
    if (from) filtered = filtered.filter((d) => d.date >= from)
    if (to) filtered = filtered.filter((d) => d.date <= to)
    return filtered.sort((a, b) => a.date.localeCompare(b.date))
  }

  async upsertDay(input: DayInput): Promise<DayEntry> {
    const db = this.read()
    const existing = db.days[input.date]
    const row: DayEntry = existing
      ? { ...existing }
      : {
          date: input.date,
          flow: null,
          mood: null,
          energy: null,
          libido: null,
          cramps: null,
          headache: null,
          back_pain: null,
          breast_tenderness: null,
          acne: null,
          bloating: null,
          fatigue: null,
          bbt: null,
          weight: null,
          note: null,
          created_at: new Date().toISOString(),
        }

    if (input.flow !== undefined) row.flow = (input.flow as DayEntry['flow']) ?? null
    for (const f of DAY_INT_FIELDS) {
      const v = input[f as keyof DayInput]
      if (v !== undefined) {
        ;(row as any)[f] = v
      }
    }
    if ((input as any).bbt !== undefined) row.bbt = (input as any).bbt
    if ((input as any).weight !== undefined) row.weight = (input as any).weight
    if (input.note !== undefined) row.note = input.note
    row.updated_at = new Date().toISOString()

    db.days[input.date] = row
    this.write(db)
    return row
  }

  async deleteDay(date: string): Promise<void> {
    const db = this.read()
    delete db.days[date]
    this.write(db)
  }

  // --- settings -----------------------------------------------------------------
  async getSettings(): Promise<AppSettings> {
    const db = this.read()
    return db.settings
  }

  async updateSettings(
    patch: Partial<Pick<AppSettings, 'cycle_length_override' | 'timezone' | 'bootstrap_cycle_length'>>,
  ): Promise<AppSettings> {
    const db = this.read()
    db.settings = { ...db.settings, ...patch }
    this.write(db)
    return db.settings
  }

  // --- prediction log --------------------------------------------------------------
  async listPredictions(): Promise<PredictionLogRow[]> {
    const db = this.read()
    return [...db.predictions].sort((a, b) => a.anchor_start.localeCompare(b.anchor_start))
  }

  async upsertPredictionByAnchor(row: PredictionUpsert): Promise<void> {
    const db = this.read()
    const pendingIdx = db.predictions.findIndex(
      (p) => p.anchor_start === row.anchor_start && p.actual_start === null,
    )
    if (pendingIdx !== -1) {
      db.predictions[pendingIdx] = {
        ...db.predictions[pendingIdx],
        predicted_start: row.predicted_start,
        range_low: row.range_low,
        range_high: row.range_high,
      }
    } else {
      db.predictions.push({
        id: randomUUID(),
        anchor_start: row.anchor_start,
        predicted_start: row.predicted_start,
        range_low: row.range_low,
        range_high: row.range_high,
        made_at: new Date().toISOString(),
        actual_start: null,
      })
    }
    this.write(db)
  }

  async fillPendingActuals(actualStarts: string[]): Promise<void> {
    if (actualStarts.length === 0) return
    const db = this.read()
    let changed = false
    for (const p of db.predictions) {
      if (p.actual_start) continue
      const actual = actualStarts.filter((s) => s > p.anchor_start).sort().at(0)
      if (actual) {
        p.actual_start = actual
        changed = true
      }
    }
    if (changed) {
      this.write(db)
    }
  }

  // --- reset all data ---------------------------------------------------------
  async deleteAllData(): Promise<void> {
    const db = this.read()
    db.periods = []
    db.days = {}
    db.predictions = []
    db.settings.cycle_length_override = null
    db.settings.bootstrap_cycle_length = null
    this.write(db)
  }

  async initialized(): Promise<boolean> {
    return (await this.getSecret()) !== null
  }
}

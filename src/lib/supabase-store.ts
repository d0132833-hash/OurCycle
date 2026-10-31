import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import type {
  AppSecretRow,
  AppSettings,
  DayEntry,
  LoginThrottleRow,
  PeriodEpisode,
  PredictionLogRow,
} from './types'
import { DAY_INT_FIELDS, type DayInput, type PeriodInput, type Store } from './storage'

/**
 * Production store: talks to Supabase Postgres with the SERVICE-ROLE key
 * from Next.js server code only. RLS is deny-all so even a leaked anon
 * key reads nothing. This module must never be imported by client code.
 */
export class SupabaseStore implements Store {
  readonly kind = 'supabase' as const
  private sb: SupabaseClient

  constructor(url: string, serviceKey: string) {
    this.sb = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  // --- secrets & throttle ---------------------------------------------------
  async getSecret(): Promise<AppSecretRow | null> {
    const { data, error } = await this.sb
      .from('app_secrets')
      .select('passphrase_hash, session_epoch')
      .eq('id', 1)
      .maybeSingle()
    if (error) throw error
    return (data as AppSecretRow | null) ?? null
  }

  async createSecret(passphraseHash: string): Promise<AppSecretRow> {
    const { data, error } = await this.sb
      .from('app_secrets')
      .upsert({ id: 1, passphrase_hash: passphraseHash, session_epoch: 1 })
      .select('passphrase_hash, session_epoch')
      .single()
    if (error) throw error
    return data as AppSecretRow
  }

  async rotateSecret(passphraseHash: string): Promise<AppSecretRow> {
    const current = await this.getSecret()
    const nextEpoch = (current?.session_epoch ?? 0) + 1
    const { data, error } = await this.sb
      .from('app_secrets')
      .upsert({ id: 1, passphrase_hash: passphraseHash, session_epoch: nextEpoch })
      .select('passphrase_hash, session_epoch')
      .single()
    if (error) throw error
    return data as AppSecretRow
  }

  async getThrottle(): Promise<LoginThrottleRow> {
    const { data, error } = await this.sb
      .from('login_throttle')
      .select('fail_count, locked_until')
      .eq('id', 1)
      .maybeSingle()
    if (error) throw error
    return (data as LoginThrottleRow | null) ?? { fail_count: 0, locked_until: null }
  }

  async saveThrottle(row: LoginThrottleRow): Promise<void> {
    const { error } = await this.sb.from('login_throttle').upsert({ id: 1, ...row })
    if (error) throw error
  }

  // --- periods ---------------------------------------------------------------
  async listPeriods(): Promise<PeriodEpisode[]> {
    const { data, error } = await this.sb
      .from('period_logs')
      .select('*')
      .order('start_date', { ascending: true })
    if (error) throw error
    return (data ?? []) as PeriodEpisode[]
  }

  async hasPeriodOn(start: string): Promise<boolean> {
    const { data, error } = await this.sb
      .from('period_logs')
      .select('id')
      .eq('start_date', start)
      .maybeSingle()
    if (error) throw error
    return data !== null
  }

  async insertPeriod(input: PeriodInput): Promise<PeriodEpisode> {
    const { data, error } = await this.sb
      .from('period_logs')
      .insert({
        start_date: input.start_date,
        end_date: input.end_date ?? null,
        flow: input.flow ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    return data as PeriodEpisode
  }

  async updatePeriod(
    id: string,
    patch: Partial<Pick<PeriodEpisode, 'start_date' | 'end_date' | 'flow'>>,
  ): Promise<PeriodEpisode | null> {
    const { data, error } = await this.sb
      .from('period_logs')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle()
    if (error) throw error
    return (data as PeriodEpisode | null) ?? null
  }

  async deletePeriod(id: string): Promise<void> {
    const { error } = await this.sb.from('period_logs').delete().eq('id', id)
    if (error) throw error
  }

  // --- days --------------------------------------------------------------------
  async listDays(from?: string, to?: string): Promise<DayEntry[]> {
    let q = this.sb.from('day_entries').select('*').order('date', { ascending: true })
    if (from) q = q.gte('date', from)
    if (to) q = q.lte('date', to)
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as DayEntry[]
  }

  async upsertDay(input: DayInput): Promise<DayEntry> {
    // merge semantics: read existing row, apply provided fields only
    const { data: existing } = await this.sb
      .from('day_entries')
      .select('*')
      .eq('date', input.date)
      .maybeSingle()
    const row: Record<string, unknown> = existing
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
          sleep_hours: null,
          water_glasses: null,
          exercise: null,
          tags: null,
          note: null,
        }
    if (input.flow !== undefined) row.flow = input.flow
    for (const f of DAY_INT_FIELDS) {
      const v = input[f as keyof DayInput]
      if (v !== undefined) row[f] = v
    }
    if (input.bbt !== undefined) row.bbt = input.bbt
    if (input.weight !== undefined) row.weight = input.weight
    if (input.sleep_hours !== undefined) row.sleep_hours = input.sleep_hours
    if (input.water_glasses !== undefined) row.water_glasses = input.water_glasses
    if (input.exercise !== undefined) row.exercise = input.exercise
    if (input.tags !== undefined) row.tags = input.tags
    if (input.note !== undefined) row.note = input.note
    row.updated_at = new Date().toISOString()

    const { data, error } = await this.sb
      .from('day_entries')
      .upsert(row, { onConflict: 'date' })
      .select('*')
      .single()
    if (error) throw error
    return data as DayEntry
  }

  async deleteDay(date: string): Promise<void> {
    const { error } = await this.sb.from('day_entries').delete().eq('date', date)
    if (error) throw error
  }

  // --- settings -----------------------------------------------------------------
  async getSettings(): Promise<AppSettings> {
    const { data, error } = await this.sb
      .from('settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    if (error) throw error
    if (data) {
      return {
        ...data,
        period_length: data.period_length ?? 5,
      } as AppSettings
    }
    const { data: created, error: insErr } = await this.sb
      .from('settings')
      .upsert({ id: 1, cycle_length_override: null, timezone: 'Asia/Calcutta', period_length: 5 })
      .select('*')
      .single()
    if (insErr) throw insErr
    return created as AppSettings
  }

  async updateSettings(
    patch: Partial<
      Pick<AppSettings, 'cycle_length_override' | 'timezone' | 'bootstrap_cycle_length' | 'period_length'>
    >,
  ): Promise<AppSettings> {
    await this.getSettings() // ensure row
    const { data, error } = await this.sb
      .from('settings')
      .update(patch)
      .eq('id', 1)
      .select('*')
      .single()
    if (error) throw error
    return data as AppSettings
  }

  // --- prediction log --------------------------------------------------------------
  async listPredictions(): Promise<PredictionLogRow[]> {
    const { data, error } = await this.sb
      .from('prediction_log')
      .select('*')
      .order('anchor_start', { ascending: true })
    if (error) throw error
    return (data ?? []) as PredictionLogRow[]
  }

  async upsertPredictionByAnchor(row: {
    anchor_start: string
    predicted_start: string
    range_low: string | null
    range_high: string | null
  }): Promise<void> {
    const { data: pending } = await this.sb
      .from('prediction_log')
      .select('id')
      .eq('anchor_start', row.anchor_start)
      .is('actual_start', null)
      .maybeSingle()
    if (pending) {
      const { error } = await this.sb
        .from('prediction_log')
        .update({
          predicted_start: row.predicted_start,
          range_low: row.range_low,
          range_high: row.range_high,
          made_at: new Date().toISOString(),
        })
        .eq('id', pending.id)
      if (error) throw error
    } else {
      const { error } = await this.sb.from('prediction_log').insert({
        id: randomUUID(),
        anchor_start: row.anchor_start,
        predicted_start: row.predicted_start,
        range_low: row.range_low,
        range_high: row.range_high,
      })
      if (error) throw error
    }
  }

  async fillPendingActuals(actualStarts: string[]): Promise<void> {
    if (actualStarts.length === 0) return
    const rows = await this.listPredictions()
    const updates: Promise<{ error: any }>[] = []
    for (const row of rows) {
      if (row.actual_start) continue
      const actual = actualStarts.filter((s) => s > row.anchor_start).sort().at(0)
      if (!actual) continue
      updates.push(
        this.sb
          .from('prediction_log')
          .update({ actual_start: actual })
          .eq('id', row.id) as unknown as Promise<{ error: any }>,
      )
    }
    if (updates.length > 0) {
      const results = await Promise.all(updates)
      for (const res of results) {
        if (res.error) throw res.error
      }
    }
  }

  async deleteAllData(): Promise<void> {
    await this.sb.from('period_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await this.sb.from('day_entries').delete().neq('date', '')
    await this.sb.from('prediction_log').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await this.sb.from('settings').update({ cycle_length_override: null, bootstrap_cycle_length: null }).eq('id', 1)
  }

  async initialized(): Promise<boolean> {
    return (await this.getSecret()) !== null
  }
}

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as calendarIcsGet } from '@/app/api/calendar/ics/route'
import { GET as periodsGet, POST as periodsPost, PATCH as periodsPatch, DELETE as periodsDelete } from '@/app/api/periods/route'
import { GET as daysGet, POST as daysPost, PATCH as daysPatch, DELETE as daysDelete } from '@/app/api/days/route'
import { GET as predictionsGet } from '@/app/api/predictions/route'
import { GET as settingsGet, PATCH as settingsPatch } from '@/app/api/settings/route'
import { POST as setupPost } from '@/app/api/auth/setup/route'
import { POST as loginPost } from '@/app/api/auth/login/route'
import { POST as rotatePost } from '@/app/api/auth/rotate/route'
import { POST as logoutPost } from '@/app/api/auth/logout/route'
import { LocalFileStore } from '@/lib/local-store'
import { setStore } from '@/lib/db'
import * as apiAuth from '@/lib/api-auth'
import { deriveObservations, computePredictions } from '@/lib/predictions'
import { diffDays } from '@/lib/dates'

describe('Rigorous Feature & API Test Suite', () => {
  let store: LocalFileStore

  beforeEach(() => {
    store = new LocalFileStore(':memory:')
    setStore(store)
    vi.restoreAllMocks()
  })

  // --------------------------------------------------------------------------
  // Feature 1 & Predictions Engine Tests
  // --------------------------------------------------------------------------
  describe('Feature 1: Partner View & Daily Care Engine', () => {
    it('correctly determines biological phases for partner care', () => {
      const today = '2026-03-20'
      const episodes = [
        { start_date: '2026-02-20', end_date: '2026-02-24', flow: 'medium' },
        { start_date: '2026-01-23', end_date: '2026-01-27', flow: 'heavy' },
      ]
      const prediction = computePredictions(episodes, { today })

      expect(prediction.hasEpisodes).toBe(true)
      expect(prediction.cycleLength).toBeGreaterThanOrEqual(21)
      expect(prediction.cycleLength).toBeLessThanOrEqual(45)
      expect(prediction.todayPhase).toBeDefined()
      expect(['menstrual', 'follicular', 'ovulation', 'luteal']).toContain(prediction.todayPhase)
    })

    it('identifies bleeding state and ongoing period day', () => {
      const today = '2026-03-02'
      const episodes = [
        { start_date: '2026-03-01', end_date: null, flow: 'heavy' },
        { start_date: '2026-02-01', end_date: '2026-02-05', flow: 'medium' },
      ]
      const prediction = computePredictions(episodes, { today })

      expect(prediction.bleedingToday).toBe(true)
      expect(prediction.periodDay).toBe(2)
      expect(prediction.todayPhase).toBe('menstrual')
    })
  })

  // --------------------------------------------------------------------------
  // Feature 2: Calendar Integration (.ics Feed)
  // --------------------------------------------------------------------------
  describe('Feature 2: Calendar Integration (/api/calendar/ics)', () => {
    it('rejects unauthenticated requests with 401', async () => {
      vi.spyOn(apiAuth, 'getSession').mockResolvedValue(null)
      const req = new NextRequest('http://localhost:3000/api/calendar/ics')
      const res = await calendarIcsGet(req)
      expect(res.status).toBe(401)
    })

    it('generates a valid RFC 5545 iCalendar file with alarms & forecasts', async () => {
      vi.spyOn(apiAuth, 'getSession').mockResolvedValue({
        v: 1,
        iat: 1000,
        exp: 2000,
        j: 'test-j',
      })

      // Seed 2 past periods
      await store.insertPeriod({ start_date: '2026-01-10', end_date: '2026-01-14', flow: 'heavy' })
      await store.insertPeriod({ start_date: '2026-02-07', end_date: '2026-02-11', flow: 'medium' })

      const req = new NextRequest('http://localhost:3000/api/calendar/ics')
      const res = await calendarIcsGet(req)

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toContain('text/calendar')
      expect(res.headers.get('Content-Disposition')).toContain('attachment; filename="our-cycle.ics"')

      const ics = await res.text()

      // RFC 5545 core structure assertions
      expect(ics).toContain('BEGIN:VCALENDAR')
      expect(ics).toContain('VERSION:2.0')
      expect(ics).toContain('PRODID:-//Our Cycle//Menstrual Health Tracker//EN')
      expect(ics).toContain('END:VCALENDAR')

      // Past logged events
      expect(ics).toContain('SUMMARY:🩸 Period (Logged)')
      expect(ics).toContain('DTSTART;VALUE=DATE:20260110')
      expect(ics).toContain('DTSTART;VALUE=DATE:20260207')

      // Predicted future events with VALARM reminder
      expect(ics).toContain('SUMMARY:🌸 Predicted Period')
      expect(ics).toContain('BEGIN:VALARM')
      expect(ics).toContain('TRIGGER:-P1D')
      expect(ics).toContain('SUMMARY:✨ Estimated Fertile Window')
      expect(ics).toContain('SUMMARY:🌙 PMS Window Heads-Up')
    })
  })

  // --------------------------------------------------------------------------
  // Feature 3 & 4: Doctor Report & Analytics calculations
  // --------------------------------------------------------------------------
  describe('Feature 3 & 4: Analytics & Doctor Report Metrics', () => {
    it('computes cycle stats, durations, and regularity correctly', () => {
      const episodes = [
        { start_date: '2026-01-01', end_date: '2026-01-05', flow: 'heavy' },
        { start_date: '2026-01-29', end_date: '2026-02-02', flow: 'medium' }, // 28d
        { start_date: '2026-02-27', end_date: '2026-03-03', flow: 'medium' }, // 29d
      ]

      const obs = deriveObservations(episodes)
      expect(obs.length).toBe(2)
      expect(obs[0].length).toBe(28)
      expect(obs[1].length).toBe(29)

      const durations = episodes.map((e) => diffDays(e.end_date, e.start_date) + 1)
      expect(durations).toEqual([5, 5, 5])

      const avgLength = obs.reduce((acc, o) => acc + o.length, 0) / obs.length
      expect(avgLength).toBe(28.5)
    })
  })

  // --------------------------------------------------------------------------
  // Feature 5: Quick-Log & Extended Lifestyle Fields in API
  // --------------------------------------------------------------------------
  describe('Feature 5: Extended Day Logging (/api/days)', () => {
    beforeEach(() => {
      vi.spyOn(apiAuth, 'getSession').mockResolvedValue({
        v: 1,
        iat: 1000,
        exp: 2000,
        j: 'test-j',
      })
    })

    it('saves and retrieves extended lifestyle fields: sleep, water, bbt, weight, tags', async () => {
      const payload = {
        date: '2026-03-10',
        flow: 'spotting',
        mood: 4,
        energy: 5,
        bbt: 36.65,
        weight: 61.8,
        sleep_hours: 8.5,
        water_glasses: 9,
        exercise: 'Yoga',
        tags: ['#heatingpad', '#tea'],
        note: 'Feeling well rested #tea',
      }

      const req = new NextRequest('http://localhost:3000/api/days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
        body: JSON.stringify(payload),
      })

      const res = await daysPost(req)
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.entry.date).toBe('2026-03-10')
      expect(data.entry.bbt).toBe(36.65)
      expect(data.entry.weight).toBe(61.8)
      expect(data.entry.sleep_hours).toBe(8.5)
      expect(data.entry.water_glasses).toBe(9)
      expect(data.entry.tags).toEqual(['#heatingpad', '#tea'])
      expect(data.entry.note).toBe('Feeling well rested #tea')

      // Query via GET
      const getReq = new NextRequest('http://localhost:3000/api/days?from=2026-03-10&to=2026-03-10')
      const getRes = await daysGet(getReq)
      expect(getRes.status).toBe(200)
      const listData = await getRes.json()
      expect(listData.days.length).toBe(1)
      expect(listData.days[0].sleep_hours).toBe(8.5)
      expect(listData.days[0].water_glasses).toBe(9)
    })

    it('enforces merge semantics on partial update', async () => {
      // First save mood and sleep
      await store.upsertDay({ date: '2026-03-11', mood: 4, sleep_hours: 7 })

      // Partial patch with water only
      const patchReq = new NextRequest('http://localhost:3000/api/days', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
        body: JSON.stringify({ date: '2026-03-11', water_glasses: 8 }),
      })

      const patchRes = await daysPatch(patchReq)
      expect(patchRes.status).toBe(200)
      const patchData = await patchRes.json()

      // Mood and sleep must be preserved
      expect(patchData.entry.mood).toBe(4)
      expect(patchData.entry.sleep_hours).toBe(7)
      expect(patchData.entry.water_glasses).toBe(8)
    })

    it('rejects out-of-range sleep hours (>24h)', async () => {
      const badReq = new NextRequest('http://localhost:3000/api/days', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
        body: JSON.stringify({ date: '2026-03-12', sleep_hours: 28 }),
      })
      const badRes = await daysPost(badReq)
      expect(badRes.status).toBe(400)
    })

    it('deletes a day entry properly', async () => {
      await store.upsertDay({ date: '2026-03-13', mood: 3 })
      const delReq = new NextRequest('http://localhost:3000/api/days?date=2026-03-13', {
        method: 'DELETE',
        headers: { Origin: 'http://localhost:3000' },
      })
      const delRes = await daysDelete(delReq)
      expect(delRes.status).toBe(200)

      const remaining = await store.listDays('2026-03-13', '2026-03-13')
      expect(remaining.length).toBe(0)
    })
  })

  // --------------------------------------------------------------------------
  // Periods API & Lifecycle
  // --------------------------------------------------------------------------
  describe('Period Episodes CRUD (/api/periods)', () => {
    beforeEach(() => {
      vi.spyOn(apiAuth, 'getSession').mockResolvedValue({
        v: 1,
        iat: 1000,
        exp: 2000,
        j: 'test-j',
      })
    })

    it('creates, updates, and deletes period episodes with auto-predictions', async () => {
      // POST new period
      const postReq = new NextRequest('http://localhost:3000/api/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
        body: JSON.stringify({ start_date: '2026-02-15', flow: 'medium' }),
      })
      const postRes = await periodsPost(postReq)
      expect(postRes.status).toBe(201)
      const postData = await postRes.json()
      expect(postData.period.start_date).toBe('2026-02-15')
      expect(postData.prediction).toBeDefined()
      const episodeId = postData.period.id

      // PATCH period end date
      const patchReq = new NextRequest('http://localhost:3000/api/periods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
        body: JSON.stringify({ id: episodeId, end_date: '2026-02-19' }),
      })
      const patchRes = await periodsPatch(patchReq)
      expect(patchRes.status).toBe(200)
      const patchData = await patchRes.json()
      expect(patchData.period.end_date).toBe('2026-02-19')

      // GET periods
      const getRes = await periodsGet()
      expect(getRes.status).toBe(200)
      const getData = await getRes.json()
      expect(getData.periods.length).toBe(1)

      // DELETE period
      const delReq = new NextRequest(`http://localhost:3000/api/periods?id=${episodeId}`, {
        method: 'DELETE',
        headers: { Origin: 'http://localhost:3000' },
      })
      const delRes = await periodsDelete(delReq)
      expect(delRes.status).toBe(200)

      const remaining = await store.listPeriods()
      expect(remaining.length).toBe(0)
    })

    it('rejects duplicate start date on period creation', async () => {
      await store.insertPeriod({ start_date: '2026-02-15' })
      const dupReq = new NextRequest('http://localhost:3000/api/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
        body: JSON.stringify({ start_date: '2026-02-15' }),
      })
      const dupRes = await periodsPost(dupReq)
      expect(dupRes.status).toBe(409) // Conflict
    })
  })

  // --------------------------------------------------------------------------
  // Settings API
  // --------------------------------------------------------------------------
  describe('Settings API (/api/settings)', () => {
    beforeEach(() => {
      vi.spyOn(apiAuth, 'getSession').mockResolvedValue({
        v: 1,
        iat: 1000,
        exp: 2000,
        j: 'test-j',
      })
    })

    it('reads and updates settings', async () => {
      const getRes = await settingsGet()
      expect(getRes.status).toBe(200)
      const data = await getRes.json()
      expect(data.settings.timezone).toBe('Asia/Calcutta')

      // Update override and timezone
      const patchReq = new NextRequest('http://localhost:3000/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
        body: JSON.stringify({ cycle_length_override: 30, timezone: 'America/New_York' }),
      })
      const patchRes = await settingsPatch(patchReq)
      expect(patchRes.status).toBe(200)
      const patchData = await patchRes.json()
      expect(patchData.settings.cycle_length_override).toBe(30)
      expect(patchData.settings.timezone).toBe('America/New_York')
    })
  })

  // --------------------------------------------------------------------------
  // Predictions API
  // --------------------------------------------------------------------------
  describe('Predictions API (/api/predictions)', () => {
    it('returns prediction object and accuracy metrics', async () => {
      vi.spyOn(apiAuth, 'getSession').mockResolvedValue({
        v: 1,
        iat: 1000,
        exp: 2000,
        j: 'test-j',
      })

      const res = await predictionsGet()
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.prediction).toBeDefined()
      expect(data.accuracy).toBeDefined()
      expect(typeof data.accuracy.evaluated).toBe('number')
      expect(typeof data.accuracy.hits).toBe('number')
    })
  })

  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // Authentication Lifecycle & Numerical Vault PIN Security
  // --------------------------------------------------------------------------
  describe('Authentication Lifecycle & Vault Operations', () => {
    it('creates vault with setup, unlocks via login, rejects non-numerical PINs, and logs out', async () => {
      // Reject non-numerical or too-short PIN on setup
      const nonNumericReq = new NextRequest('http://localhost:3000/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
        body: JSON.stringify({ code: 'abc' }),
      })
      const nonNumericRes = await setupPost(nonNumericReq)
      expect(nonNumericRes.status).toBe(400)

      // 1. Setup with valid numerical PIN
      const setupReq = new NextRequest('http://localhost:3000/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
        body: JSON.stringify({ code: '5821' }),
      })
      const setupRes = await setupPost(setupReq)
      expect(setupRes.status).toBe(200)
      expect(setupRes.headers.get('set-cookie')).toContain('oc_session')

      // Vault is initialized
      const secret = await store.getSecret()
      expect(secret).not.toBeNull()
      expect(secret?.session_epoch).toBe(1)

      // 2. Login with correct numerical PIN
      const loginReq = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '5821' }),
      })
      const loginRes = await loginPost(loginReq)
      expect(loginRes.status).toBe(200)
      expect(loginRes.headers.get('set-cookie')).toContain('oc_session')

      // 3. Login with wrong numerical PIN
      const badLoginReq = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '9999' }),
      })
      const badLoginRes = await loginPost(badLoginReq)
      expect(badLoginRes.status).toBe(401)

      // 4. Logout
      const logoutRes = await logoutPost()
      expect(logoutRes.status).toBe(200)
      expect(logoutRes.headers.get('set-cookie')).toContain('Max-Age=0')
    })

    it('rotates vault code and bumps session epoch', async () => {
      // Setup vault first
      const setupReq = new NextRequest('http://localhost:3000/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
        body: JSON.stringify({ code: '5821' }),
      })
      await setupPost(setupReq)

      // Mock authenticated session
      vi.spyOn(apiAuth, 'getSession').mockResolvedValue({
        v: 1,
        iat: 1000,
        exp: 2000,
        j: 'test-j',
      })

      // Reject non-numerical rotation
      const badRotateReq = new NextRequest('http://localhost:3000/api/auth/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
        body: JSON.stringify({
          current: '5821',
          next: 'letters-not-allowed',
        }),
      })
      const badRotateRes = await rotatePost(badRotateReq)
      expect(badRotateRes.status).toBe(400)

      // Rotate with valid numerical PIN
      const rotateReq = new NextRequest('http://localhost:3000/api/auth/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
        body: JSON.stringify({
          current: '5821',
          next: '9432',
        }),
      })

      const rotateRes = await rotatePost(rotateReq)
      expect(rotateRes.status).toBe(200)

      // Epoch incremented
      const secret = await store.getSecret()
      expect(secret?.session_epoch).toBe(2)
    })
  })
})


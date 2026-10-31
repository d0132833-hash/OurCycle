import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as healthGet } from '@/app/api/health/route'
import { GET as exportGet } from '@/app/api/export/route'
import { POST as resetPost } from '@/app/api/reset/route'
import { POST as setupPost } from '@/app/api/auth/setup/route'
import { LocalFileStore } from '@/lib/local-store'
import { setStore } from '@/lib/db'
import { hashPassphrase } from '@/lib/crypto'
import * as apiAuth from '@/lib/api-auth'

describe('API Route Handlers', () => {
  let store: LocalFileStore

  beforeEach(() => {
    store = new LocalFileStore(':memory:')
    setStore(store)
    vi.restoreAllMocks()
  })

  describe('GET /api/health', () => {
    it('returns healthy status and metadata', async () => {
      const res = await healthGet()
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.status).toBe('healthy')
      expect(data.storeKind).toBe('local')
      expect(typeof data.latencyMs).toBe('number')
    })
  })

  describe('GET /api/export', () => {
    it('rejects unauthenticated requests with 401', async () => {
      vi.spyOn(apiAuth, 'getSession').mockResolvedValue(null)
      const req = new NextRequest('http://localhost:3000/api/export')
      const res = await exportGet(req)
      expect(res.status).toBe(401)
    })

    it('exports complete JSON payload when authenticated', async () => {
      vi.spyOn(apiAuth, 'getSession').mockResolvedValue({
        v: 1,
        iat: 1000,
        exp: 2000,
        j: 'test-j',
      })

      await store.insertPeriod({ start_date: '2026-01-01', end_date: '2026-01-05', flow: 'medium' })
      await store.upsertDay({ date: '2026-01-01', mood: 4, note: 'Feeling calm' })

      const req = new NextRequest('http://localhost:3000/api/export?format=json')
      const res = await exportGet(req)

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toContain('application/json')

      const data = await res.json()
      expect(data.version).toBe('1.0')
      expect(data.periods.length).toBe(1)
      expect(data.days.length).toBe(1)
      expect(data.days[0].note).toBe('Feeling calm')
    })

    it('exports CSV formatted data when format=csv requested', async () => {
      vi.spyOn(apiAuth, 'getSession').mockResolvedValue({
        v: 1,
        iat: 1000,
        exp: 2000,
        j: 'test-j',
      })

      await store.insertPeriod({ start_date: '2026-02-01', end_date: '2026-02-05' })
      await store.upsertDay({ date: '2026-02-01', mood: 3 })

      const req = new NextRequest('http://localhost:3000/api/export?format=csv')
      const res = await exportGet(req)

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toContain('text/csv')

      const text = await res.text()
      expect(text).toContain('# OURCYCLE DATA EXPORT')
      expect(text).toContain('### PERIOD EPISODES')
      expect(text).toContain('2026-02-01')
      expect(res.headers.get('Cache-Control')).toContain('no-store')
    })

    it('neutralizes CSV formula injection triggers', async () => {
      vi.spyOn(apiAuth, 'getSession').mockResolvedValue({
        v: 1,
        iat: 1000,
        exp: 2000,
        j: 'test-j',
      })

      // Note with formula prefixes (=, +, -, @)
      await store.upsertDay({ date: '2026-02-01', note: '=CMD|" /C calc"!A0' })
      await store.upsertDay({ date: '2026-02-02', note: '+HYPERLINK("http://evil.com")' })
      await store.upsertDay({ date: '2026-02-03', note: '@SUM(1+1)' })

      const req = new NextRequest('http://localhost:3000/api/export?format=csv')
      const res = await exportGet(req)
      expect(res.status).toBe(200)

      const text = await res.text()
      // All formula triggers must be neutralized with leading single quote inside quotes
      expect(text).toContain(`"'=CMD|"" /C calc""!A0"`)
      expect(text).toContain(`"'+HYPERLINK(""http://evil.com"")"`)
      expect(text).toContain(`"'@SUM(1+1)"`)
    })
  })

  describe('POST /api/reset (Sudo Mode Verification)', () => {
    beforeEach(async () => {
      await store.createSecret(hashPassphrase('5821'))
      await store.insertPeriod({ start_date: '2026-03-01' })
      await store.upsertDay({ date: '2026-03-01', mood: 5 })
    })

    it('rejects reset without correct vault PIN', async () => {
      vi.spyOn(apiAuth, 'getSession').mockResolvedValue({
        v: 1,
        iat: 1000,
        exp: 2000,
        j: 'test-j',
      })

      const wrongReq = new NextRequest('http://localhost:3000/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '0000' }),
      })
      const wrongRes = await resetPost(wrongReq)
      expect(wrongRes.status).toBe(401)
      expect((await store.listPeriods()).length).toBe(1)
    })

    it('wipes all data when verified with correct vault PIN', async () => {
      vi.spyOn(apiAuth, 'getSession').mockResolvedValue({
        v: 1,
        iat: 1000,
        exp: 2000,
        j: 'test-j',
      })

      const validReq = new NextRequest('http://localhost:3000/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '5821' }),
      })
      const validRes = await resetPost(validReq)
      expect(validRes.status).toBe(200)
      expect((await store.listPeriods()).length).toBe(0)
      expect((await store.listDays()).length).toBe(0)
    })
  })

  describe('POST /api/auth/setup validation', () => {
    it('rejects PINs shorter than 4 digits', async () => {
      const shortReq = new NextRequest('http://localhost:3000/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '12' }),
      })
      const res = await setupPost(shortReq)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('PIN must be at least 4 digits')
    })
  })

  describe('LocalFileStore operations', () => {
    it('manages periods and deletion cleanly', async () => {
      const p = await store.insertPeriod({ start_date: '2026-03-01' })
      expect(p.start_date).toBe('2026-03-01')

      let list = await store.listPeriods()
      expect(list.length).toBe(1)

      await store.updatePeriod(p.id, { end_date: '2026-03-05' })
      list = await store.listPeriods()
      expect(list[0].end_date).toBe('2026-03-05')

      await store.deletePeriod(p.id)
      list = await store.listPeriods()
      expect(list.length).toBe(0)
    })

    it('supports deleteAllData reset', async () => {
      await store.insertPeriod({ start_date: '2026-03-01' })
      await store.upsertDay({ date: '2026-03-01', mood: 5 })

      expect((await store.listPeriods()).length).toBe(1)
      expect((await store.listDays()).length).toBe(1)

      await store.deleteAllData()

      expect((await store.listPeriods()).length).toBe(0)
      expect((await store.listDays()).length).toBe(0)
    })
  })
})

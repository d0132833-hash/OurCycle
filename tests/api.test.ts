import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as healthGet } from '@/app/api/health/route'
import { GET as exportGet } from '@/app/api/export/route'
import { LocalFileStore } from '@/lib/local-store'
import { setStore } from '@/lib/db'
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

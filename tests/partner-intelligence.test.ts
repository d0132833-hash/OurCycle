import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  calculateEnergyBattery,
  getMindsetGuidance,
  generateContextualTexts,
  getPhaseDateIdeas,
  getCareGroceryList,
  generateDiscreetCalendarIcs,
  PARTNER_SIGNALS,
} from '@/lib/partner-intelligence'
import type { DayEntry, Phase } from '@/lib/types'
import { computePredictions } from '@/lib/predictions'
import { GET as partnerCalendarGet } from '@/app/api/partner/calendar/route'
import { LocalFileStore } from '@/lib/local-store'
import { setStore } from '@/lib/db'
import * as apiAuth from '@/lib/api-auth'

describe('Partner Intelligence & Empathy Engine', () => {
  let store: LocalFileStore

  beforeEach(() => {
    store = new LocalFileStore(':memory:')
    setStore(store)
    vi.restoreAllMocks()
  })

  // --------------------------------------------------------------------------
  // 1. Social Battery & Energy Calculation
  // --------------------------------------------------------------------------
  describe('calculateEnergyBattery', () => {
    it('calculates high baseline battery during ovulation and follicular', () => {
      const ov = calculateEnergyBattery('ovulation', null)
      expect(ov.percentage).toBeGreaterThanOrEqual(85)
      expect(ov.label).toBe('Peak')

      const fol = calculateEnergyBattery('follicular', null)
      expect(fol.percentage).toBeGreaterThanOrEqual(75)
      expect(['High', 'Peak']).toContain(fol.label)
    })

    it('calculates lower baseline battery during menstrual and luteal', () => {
      const men = calculateEnergyBattery('menstrual', null)
      expect(men.percentage).toBeLessThanOrEqual(45)
      expect(['Low', 'Very Low', 'Moderate']).toContain(men.label)

      const lut = calculateEnergyBattery('luteal', null)
      expect(lut.percentage).toBeLessThan(70)
    })

    it('penalizes battery when symptoms and poor sleep are logged', () => {
      const entry: DayEntry = {
        date: '2026-03-20',
        flow: null,
        mood: 2,
        energy: 1, // exhausted
        libido: null,
        cramps: 3, // severe
        headache: 2,
        back_pain: 2,
        breast_tenderness: 1,
        acne: null,
        bloating: 2,
        fatigue: 3,
        sleep_hours: 4.5, // short sleep
        note: null,
      }

      const battery = calculateEnergyBattery('luteal', entry)
      expect(battery.percentage).toBeLessThanOrEqual(25)
      expect(battery.label).toBe('Very Low')
      expect(battery.summary).toContain('Rest mode critical')
    })

    it('boosts battery when high energy and good sleep are logged', () => {
      const entry: DayEntry = {
        date: '2026-03-20',
        flow: null,
        mood: 5,
        energy: 5,
        libido: 4,
        cramps: 0,
        headache: 0,
        back_pain: 0,
        breast_tenderness: 0,
        acne: 0,
        bloating: 0,
        fatigue: 0,
        sleep_hours: 9,
        note: null,
      }

      const battery = calculateEnergyBattery('follicular', entry)
      expect(battery.percentage).toBeGreaterThanOrEqual(90)
      expect(battery.label).toBe('Peak')
    })
  })

  // --------------------------------------------------------------------------
  // 2. Mindset Guidance & Golden Rule
  // --------------------------------------------------------------------------
  describe('getMindsetGuidance', () => {
    it('sets Tender Care mode during menstrual phase or severe cramps', () => {
      const guide = getMindsetGuidance('menstrual', null)
      expect(guide.mode).toBe('Tender Care')
      expect(guide.goldenRule).toContain('without asking first')

      const crampGuide = getMindsetGuidance('follicular', {
        date: '2026-03-20',
        flow: null,
        mood: 3,
        energy: 3,
        libido: null,
        cramps: 2,
        headache: 0,
        back_pain: 0,
        breast_tenderness: 0,
        acne: 0,
        bloating: 0,
        fatigue: 0,
        note: null,
      })
      expect(crampGuide.mode).toBe('Tender Care')
    })

    it('sets Hold Space mode during luteal phase or low mood', () => {
      const guide = getMindsetGuidance('luteal', null)
      expect(guide.mode).toBe('Hold Space')
      expect(guide.goldenRule).toContain('Never debate logic')

      const lowMoodGuide = getMindsetGuidance('follicular', {
        date: '2026-03-20',
        flow: null,
        mood: 1,
        energy: 3,
        libido: null,
        cramps: 0,
        headache: 0,
        back_pain: 0,
        breast_tenderness: 0,
        acne: 0,
        bloating: 0,
        fatigue: 0,
        note: null,
      })
      expect(lowMoodGuide.mode).toBe('Hold Space')
    })

    it('sets Peak Connection during ovulation', () => {
      const guide = getMindsetGuidance('ovulation', null)
      expect(guide.mode).toBe('Peak Connection')
      expect(guide.goldenRule).toContain('undivided attention')
    })
  })

  // --------------------------------------------------------------------------
  // 3. Dynamic Contextual Messages
  // --------------------------------------------------------------------------
  describe('generateContextualTexts', () => {
    it('includes cramp-tailored messages when cramps are logged', () => {
      const entry: DayEntry = {
        date: '2026-03-20',
        flow: null,
        mood: 3,
        energy: 2,
        libido: null,
        cramps: 2,
        headache: 0,
        back_pain: 0,
        breast_tenderness: 0,
        acne: 0,
        bloating: 0,
        fatigue: 0,
        note: null,
      }

      const texts = generateContextualTexts('menstrual', entry)
      expect(texts.some((t) => t.id.startsWith('cramps-'))).toBe(true)
      expect(texts.some((t) => t.text.toLowerCase().includes('cramps'))).toBe(true)
    })

    it('includes fatigue & chore relief messages when fatigue is logged', () => {
      const entry: DayEntry = {
        date: '2026-03-20',
        flow: null,
        mood: 3,
        energy: 1,
        libido: null,
        cramps: 0,
        headache: 0,
        back_pain: 0,
        breast_tenderness: 0,
        acne: 0,
        bloating: 0,
        fatigue: 2,
        note: null,
      }

      const texts = generateContextualTexts('luteal', entry)
      expect(texts.some((t) => t.id.startsWith('fatigue-'))).toBe(true)
      expect(texts.some((t) => t.text.toLowerCase().includes('bed') || t.text.toLowerCase().includes('dinner'))).toBe(true)
    })

    it('includes romance and date texts during ovulation', () => {
      const texts = generateContextualTexts('ovulation', null)
      expect(texts.some((t) => t.category === 'fun' || t.category === 'affirmation')).toBe(true)
      expect(texts.some((t) => t.text.toLowerCase().includes('dressed up') || t.text.toLowerCase().includes('see you'))).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // 4. Phase Date Matchmaker
  // --------------------------------------------------------------------------
  describe('getPhaseDateIdeas', () => {
    it('returns low-key restorative dates during menstrual phase', () => {
      const ideas = getPhaseDateIdeas('menstrual')
      expect(ideas.length).toBeGreaterThanOrEqual(2)
      expect(ideas.some((i) => i.title.toLowerCase().includes('cozy') || i.title.toLowerCase().includes('massage'))).toBe(true)
      expect(ideas[0].sampleInvite).toBeDefined()
      expect(ideas[0].whyItWorks).toBeDefined()
    })

    it('returns adventurous, novelty dates during follicular phase', () => {
      const ideas = getPhaseDateIdeas('follicular')
      expect(ideas.some((i) => i.title.toLowerCase().includes('cuisine') || i.title.toLowerCase().includes('walk') || i.title.toLowerCase().includes('cooking'))).toBe(true)
    })

    it('returns vibrant dressed-up romance during ovulation', () => {
      const ideas = getPhaseDateIdeas('ovulation')
      expect(ideas.some((i) => i.title.toLowerCase().includes('dressed-up') || i.title.toLowerCase().includes('live music'))).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // 5. Care Grocery & Comfort Shopping List
  // --------------------------------------------------------------------------
  describe('getCareGroceryList', () => {
    it('prioritizes cramp essentials (heating pad, tea, dark chocolate) when cramps are logged', () => {
      const entry: DayEntry = {
        date: '2026-03-20',
        flow: null,
        mood: 3,
        energy: 2,
        libido: null,
        cramps: 2,
        headache: 0,
        back_pain: 0,
        breast_tenderness: 0,
        acne: 0,
        bloating: 0,
        fatigue: 0,
        note: null,
      }

      const list = getCareGroceryList('menstrual', entry)
      expect(list.some((item) => item.name.toLowerCase().includes('heating pad'))).toBe(true)
      expect(list.some((item) => item.name.toLowerCase().includes('chocolate'))).toBe(true)
      expect(list.some((item) => item.name.toLowerCase().includes('tea'))).toBe(true)
      expect(list.some((item) => item.isUrgent === true)).toBe(true)
    })

    it('includes digestive relief when bloating is logged', () => {
      const entry: DayEntry = {
        date: '2026-03-20',
        flow: null,
        mood: 3,
        energy: 3,
        libido: null,
        cramps: 0,
        headache: 0,
        back_pain: 0,
        breast_tenderness: 0,
        acne: 0,
        bloating: 2,
        fatigue: 0,
        note: null,
      }

      const list = getCareGroceryList('luteal', entry)
      expect(list.some((item) => item.name.toLowerCase().includes('ginger'))).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // 6. Discreet Calendar Sync (.ics export)
  // --------------------------------------------------------------------------
  describe('generateDiscreetCalendarIcs', () => {
    it('generates a valid RFC 5545 calendar with discreet cycle blocks', () => {
      const episodes = [
        { start_date: '2026-03-01', end_date: '2026-03-05', flow: 'medium' },
        { start_date: '2026-02-01', end_date: '2026-02-05', flow: 'medium' },
      ]
      const prediction = computePredictions(episodes, { today: '2026-03-10' })
      const ics = generateDiscreetCalendarIcs(prediction, 2)

      expect(ics).toContain('BEGIN:VCALENDAR')
      expect(ics).toContain('END:VCALENDAR')
      expect(ics).toContain('SUMMARY:Cycle: Rest & Comfort Window')
      expect(ics).toContain('SUMMARY:Cycle: Peak Vitality & Romance')
      expect(ics).toContain('SUMMARY:Cycle: Gentle Care & Support')
      // Must not leak private or clinical terms
      expect(ics).not.toContain('Cramps')
      expect(ics).not.toContain('Bleeding heavy')
    })
  })

  // --------------------------------------------------------------------------
  // 7. Partner Signals Definitions
  // --------------------------------------------------------------------------
  describe('PARTNER_SIGNALS', () => {
    it('defines 6 essential partner signals with clear tips', () => {
      expect(PARTNER_SIGNALS.length).toBe(6)
      const keys = PARTNER_SIGNALS.map((s) => s.key)
      expect(keys).toContain('need:tea')
      expect(keys).toContain('need:dinner')
      expect(keys).toContain('need:quiet')
      expect(keys).toContain('need:hug')
      expect(keys).toContain('need:snack')
      expect(keys).toContain('need:massage')
    })
  })

  // --------------------------------------------------------------------------
  // 8. /api/partner/calendar Route Endpoint
  // --------------------------------------------------------------------------
  describe('GET /api/partner/calendar', () => {
    it('returns 401 when unauthorized', async () => {
      vi.spyOn(apiAuth, 'getSession').mockResolvedValue(null)
      const res = await partnerCalendarGet()
      expect(res.status).toBe(401)
    })

    it('returns text/calendar ics file when authorized', async () => {
      vi.spyOn(apiAuth, 'getSession').mockResolvedValue({ v: 1, iat: 100, exp: 999, j: 'test' })
      await store.insertPeriod({ start_date: '2026-02-01', end_date: '2026-02-05' })
      await store.insertPeriod({ start_date: '2026-03-01', end_date: '2026-03-05' })

      const res = await partnerCalendarGet()
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/calendar')
      expect(res.headers.get('content-disposition')).toContain('ourcycle-partner-companion.ics')

      const body = await res.text()
      expect(body).toContain('BEGIN:VCALENDAR')
      expect(body).toContain('Cycle: Rest & Comfort Window')
    })
  })
})


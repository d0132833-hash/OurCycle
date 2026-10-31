import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/db'
import { getSession, unauthorizedResponse } from '@/lib/api-auth'
import {
  badRequest,
  checkRateLimit,
  daySchema,
  dayFlowSchema,
  intensity3,
  isSameOrigin,
  readJson,
  score5,
  tooMany,
} from '@/lib/api-helpers'
import { syncPredictionLog } from '@/lib/recompute'
import { addDays, dayRange } from '@/lib/dates'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const upsertSchema = z.object({
  date: daySchema,
  flow: dayFlowSchema.optional(),
  is_period_start: z.boolean().optional(),
  period_length: z.number().int().min(1).max(14).optional(),
  mood: score5.optional(),
  energy: score5.optional(),
  libido: score5.optional(),
  cramps: intensity3.optional(),
  headache: intensity3.optional(),
  back_pain: intensity3.optional(),
  breast_tenderness: intensity3.optional(),
  acne: intensity3.optional(),
  bloating: intensity3.optional(),
  fatigue: intensity3.optional(),
  bbt: z.number().min(30).max(110).nullable().optional(),
  weight: z.number().min(20).max(300).nullable().optional(),
  sleep_hours: z.number().min(0).max(24).nullable().optional(),
  water_glasses: z.number().min(0).max(30).nullable().optional(),
  exercise: z.string().max(100).nullable().optional(),
  tags: z.array(z.string().max(100)).nullable().optional(),
  note: z.string().max(4000).nullable().optional(),
})

async function cleanupDayFlow(store: ReturnType<typeof getStore>, date: string) {
  const days = await store.listDays(date, date)
  const entry = days[0]
  if (!entry) return
  const hasOtherData =
    entry.mood !== null ||
    entry.energy !== null ||
    entry.libido !== null ||
    entry.cramps !== null ||
    entry.headache !== null ||
    entry.back_pain !== null ||
    entry.breast_tenderness !== null ||
    entry.acne !== null ||
    entry.bloating !== null ||
    entry.fatigue !== null ||
    entry.bbt != null ||
    entry.weight != null ||
    entry.sleep_hours != null ||
    entry.water_glasses != null ||
    entry.exercise != null ||
    (entry.tags && entry.tags.length > 0) ||
    (entry.note && entry.note.trim() !== '')
  if (hasOtherData) {
    await store.upsertDay({ date, flow: 'none' })
  } else {
    await store.deleteDay(date)
  }
}

async function handlePeriodSyncForDay(
  store: ReturnType<typeof getStore>,
  input: z.infer<typeof upsertSchema>,
) {
  const isMenstrual =
    input.flow === 'light' || input.flow === 'medium' || input.flow === 'heavy'

  // Check if a period starts on input.date or already contains input.date
  const periods = await store.listPeriods()
  const existing = periods.find((p) => p.start_date === input.date)
  const containing = periods.find(
    (p) => p.start_date <= input.date && (p.end_date === null || p.end_date >= input.date),
  )

  const shouldStartPeriod =
    input.is_period_start === true ||
    (input.is_period_start === undefined && isMenstrual && (!containing || existing !== undefined))

  if (shouldStartPeriod && isMenstrual) {
    const settings = await store.getSettings()
    const periodLen = input.period_length ?? settings.period_length ?? 5
    const episodeFlow = (input.flow as 'light' | 'medium' | 'heavy') || 'medium'
    const endDate = addDays(input.date, periodLen - 1)

    if (existing) {
      await store.updatePeriod(existing.id, {
        end_date: endDate,
        flow: episodeFlow,
      })
    } else {
      await store.insertPeriod({
        start_date: input.date,
        end_date: endDate,
        flow: episodeFlow,
      })
    }

    // Auto-upsert following days in range with this flow
    const dates = dayRange(input.date, endDate)
    for (const d of dates) {
      if (d === input.date) continue
      await store.upsertDay({ date: d, flow: episodeFlow })
    }

    await syncPredictionLog()
  } else if (input.flow === 'none' || input.flow === null) {
    // Flow was cleared or set to none on this date
    const periods = await store.listPeriods()
    const episode = periods.find(
      (e) =>
        e.start_date === input.date ||
        (e.start_date <= input.date && (e.end_date === null || e.end_date >= input.date)),
    )

    if (episode) {
      if (episode.start_date === input.date) {
        // Clearing flow on period start date cancels the entire period cycle
        await store.deletePeriod(episode.id)
        const oldEnd = episode.end_date ?? episode.start_date
        const dates = dayRange(episode.start_date, oldEnd)
        for (const d of dates) {
          if (d !== input.date) await cleanupDayFlow(store, d)
        }
      } else {
        // Clearing flow on intermediate or ending day shortens the period
        const newEnd = addDays(input.date, -1)
        if (newEnd < episode.start_date) {
          await store.deletePeriod(episode.id)
        } else {
          await store.updatePeriod(episode.id, { end_date: newEnd })
        }
        const oldEnd = episode.end_date ?? input.date
        const dates = dayRange(input.date, oldEnd)
        for (const d of dates) {
          if (d !== input.date) await cleanupDayFlow(store, d)
        }
      }
      await syncPredictionLog()
    }
  }
}

export async function GET(req: NextRequest) {
  if (!(await getSession())) return unauthorizedResponse()
  const from = req.nextUrl.searchParams.get('from') ?? undefined
  const to = req.nextUrl.searchParams.get('to') ?? undefined
  const days = await getStore().listDays(from ?? undefined, to ?? undefined)
  return NextResponse.json({ days })
}

/** Upsert-merge: only the fields present in the body are overwritten. */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  if (!checkRateLimit('days-write', 120, 60)) return tooMany(60)
  if (!(await getSession())) return unauthorizedResponse()
  const parsed = upsertSchema.safeParse(await readJson(req))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const { is_period_start, period_length, ...dayFields } = parsed.data
  const store = getStore()
  const entry = await store.upsertDay(dayFields)

  await handlePeriodSyncForDay(store, parsed.data)

  return NextResponse.json({ entry }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  if (!checkRateLimit('days-write', 120, 60)) return tooMany(60)
  if (!(await getSession())) return unauthorizedResponse()
  const parsed = upsertSchema.safeParse(await readJson(req))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const { is_period_start, period_length, ...dayFields } = parsed.data
  const store = getStore()
  const entry = await store.upsertDay(dayFields)

  await handlePeriodSyncForDay(store, parsed.data)

  return NextResponse.json({ entry })
}

export async function DELETE(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  if (!checkRateLimit('days-write', 120, 60)) return tooMany(60)
  if (!(await getSession())) return unauthorizedResponse()
  const date = req.nextUrl.searchParams.get('date')
  if (!date || !daySchema.safeParse(date).success) return badRequest('Invalid date')

  const store = getStore()
  const periods = await store.listPeriods()

  // Find if date is part of any period episode
  const episode = periods.find(
    (e) =>
      e.start_date === date ||
      (e.start_date <= date && (e.end_date === null || e.end_date >= date)),
  )

  if (episode) {
    if (episode.start_date === date) {
      // User is clearing the first date of the period -> delete the entire period episode!
      await store.deletePeriod(episode.id)
      const oldEnd = episode.end_date ?? episode.start_date
      const dates = dayRange(episode.start_date, oldEnd)
      for (const d of dates) {
        if (d !== date) {
          await cleanupDayFlow(store, d)
        }
      }
    } else {
      // User is clearing an intermediate or ending day -> shorten the period episode!
      const newEnd = addDays(date, -1)
      if (newEnd < episode.start_date) {
        await store.deletePeriod(episode.id)
      } else {
        await store.updatePeriod(episode.id, { end_date: newEnd })
      }
      const oldEnd = episode.end_date ?? date
      const dates = dayRange(date, oldEnd)
      for (const d of dates) {
        if (d !== date) {
          await cleanupDayFlow(store, d)
        }
      }
    }
  }

  await store.deleteDay(date)
  await syncPredictionLog()

  return NextResponse.json({ ok: true })
}

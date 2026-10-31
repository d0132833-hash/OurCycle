import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/db'
import { getSession, unauthorizedResponse } from '@/lib/api-auth'
import {
  badRequest,
  checkRateLimit,
  conflict,
  daySchema,
  episodeFlowSchema,
  isSameOrigin,
  readJson,
  tooMany,
} from '@/lib/api-helpers'
import { syncPredictionLog } from '@/lib/recompute'
import { addDays, dayRange, todayInTz } from '@/lib/dates'
import type { DayEntry, PeriodEpisode } from '@/lib/types'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  start_date: daySchema,
  end_date: daySchema.nullable().optional(),
  flow: episodeFlowSchema.optional(),
  upsert: z.boolean().optional(),
})

const patchSchema = z.object({
  id: z.string().min(1),
  start_date: daySchema.optional(),
  end_date: daySchema.nullable().optional(),
  flow: episodeFlowSchema.optional(),
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

export async function GET() {
  if (!(await getSession())) return unauthorizedResponse()
  const periods = await getStore().listPeriods()
  return NextResponse.json({ periods })
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  if (!checkRateLimit('periods-write', 60, 60)) return tooMany(60)
  if (!(await getSession())) return unauthorizedResponse()
  const parsed = createSchema.safeParse(await readJson(req))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
  const input = parsed.data

  const store = getStore()
  const settings = await store.getSettings()
  const today = todayInTz(settings.timezone)
  if (input.start_date > today) return badRequest('Start date cannot be in the future')

  // Auto-fill end_date if omitted or null according to period_length
  const periodLength = settings.period_length ?? 5
  const autoEndDate = addDays(input.start_date, periodLength - 1)
  const effectiveEndDate =
    input.end_date !== undefined && input.end_date !== null ? input.end_date : autoEndDate

  if (effectiveEndDate < input.start_date)
    return badRequest('End date cannot be before the start date')
  const hasExisting = await store.hasPeriodOn(input.start_date)
  if (hasExisting && !input.upsert) {
    return conflict('A period starting on this date already exists')
  }

  const episodeFlow = (input.flow as PeriodEpisode['flow']) ?? 'medium'
  let period: PeriodEpisode

  if (hasExisting && input.upsert) {
    const existing = (await store.listPeriods()).find((p) => p.start_date === input.start_date)!
    const updated = await store.updatePeriod(existing.id, {
      end_date: effectiveEndDate,
      flow: episodeFlow,
    })
    period = updated ?? existing
  } else {
    period = await store.insertPeriod({
      start_date: input.start_date,
      end_date: effectiveEndDate,
      flow: episodeFlow,
    })
  }

  // Auto-log following days according to the period cycle length
  const dates = dayRange(input.start_date, effectiveEndDate)
  for (const d of dates) {
    await store.upsertDay({ date: d, flow: episodeFlow })
  }

  const prediction = await syncPredictionLog() // full recompute on every write
  return NextResponse.json({ period, prediction }, { status: hasExisting ? 200 : 201 })
}

export async function PATCH(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  if (!checkRateLimit('periods-write', 60, 60)) return tooMany(60)
  if (!(await getSession())) return unauthorizedResponse()
  const parsed = patchSchema.safeParse(await readJson(req))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
  const { id, ...patch } = parsed.data
  if (patch.start_date && patch.end_date && patch.end_date < patch.start_date)
    return badRequest('End date cannot be before the start date')

  const store = getStore()
  const existingPeriod = (await store.listPeriods()).find((p) => p.id === id)

  const updateData: Partial<Pick<PeriodEpisode, 'start_date' | 'end_date' | 'flow'>> = {}
  if (patch.start_date !== undefined) updateData.start_date = patch.start_date
  if (patch.end_date !== undefined) updateData.end_date = patch.end_date
  if (patch.flow !== undefined)
    updateData.flow = (patch.flow ?? undefined) as PeriodEpisode['flow'] | undefined

  const period = await store.updatePeriod(id, updateData)
  if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 })

  if (existingPeriod) {
    const oldStart = existingPeriod.start_date
    const oldEnd = existingPeriod.end_date ?? existingPeriod.start_date
    const newStart = period.start_date
    const newEnd = period.end_date ?? period.start_date

    // Clean up days no longer in the period
    const oldDates = dayRange(oldStart, oldEnd)
    const newDatesSet = new Set(dayRange(newStart, newEnd))
    for (const d of oldDates) {
      if (!newDatesSet.has(d)) {
        await cleanupDayFlow(store, d)
      }
    }

    // Ensure days in the new period range have the flow set
    const flowToSet = (period.flow ?? 'medium') as DayEntry['flow']
    for (const d of newDatesSet) {
      await store.upsertDay({ date: d, flow: flowToSet })
    }
  }

  const prediction = await syncPredictionLog() // self-healing recompute (backdated edits included)
  return NextResponse.json({ period, prediction })
}

export async function DELETE(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  if (!checkRateLimit('periods-write', 60, 60)) return tooMany(60)
  if (!(await getSession())) return unauthorizedResponse()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return badRequest('Missing id')
  const store = getStore()

  const target = (await store.listPeriods()).find((p) => p.id === id)
  if (target) {
    const end = target.end_date ?? target.start_date
    const dates = dayRange(target.start_date, end)
    for (const d of dates) {
      await cleanupDayFlow(store, d)
    }
  }

  await store.deletePeriod(id)
  const prediction = await syncPredictionLog()
  return NextResponse.json({ ok: true, prediction })
}

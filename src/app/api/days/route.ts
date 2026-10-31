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

async function handlePeriodSyncForDay(
  store: ReturnType<typeof getStore>,
  input: z.infer<typeof upsertSchema>,
) {
  const isMenstrual =
    input.flow === 'light' || input.flow === 'medium' || input.flow === 'heavy'

  if (input.is_period_start || (input.is_period_start !== false && isMenstrual)) {
    const settings = await store.getSettings()
    const periodLen = input.period_length ?? settings.period_length ?? 5
    const episodeFlow = (input.flow as 'light' | 'medium' | 'heavy') || 'medium'
    const endDate = addDays(input.date, periodLen - 1)

    // Check if a period starts on input.date or already contains input.date
    const periods = await store.listPeriods()
    const existing = periods.find((p) => p.start_date === input.date)
    const containing = periods.find(
      (p) => p.start_date <= input.date && (p.end_date === null || p.end_date >= input.date),
    )

    if (existing) {
      await store.updatePeriod(existing.id, {
        end_date: endDate,
        flow: episodeFlow,
      })
    } else if (!containing || input.is_period_start) {
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
  await getStore().deleteDay(date)
  return NextResponse.json({ ok: true })
}

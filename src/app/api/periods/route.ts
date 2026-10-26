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
import { todayInTz } from '@/lib/dates'
import type { PeriodEpisode } from '@/lib/types'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createSchema = z.object({
  start_date: daySchema,
  end_date: daySchema.nullable().optional(),
  flow: episodeFlowSchema.optional(),
})

const patchSchema = z.object({
  id: z.string().min(1),
  start_date: daySchema.optional(),
  end_date: daySchema.nullable().optional(),
  flow: episodeFlowSchema.optional(),
})

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
  if (input.end_date && input.end_date < input.start_date)
    return badRequest('End date cannot be before the start date')
  if (await store.hasPeriodOn(input.start_date))
    return conflict('A period starting on this date already exists')

  const period = await store.insertPeriod(input)
  const prediction = await syncPredictionLog() // full recompute on every write
  return NextResponse.json({ period, prediction }, { status: 201 })
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
  const period = await store.updatePeriod(id, {
    start_date: patch.start_date,
    end_date: patch.end_date,
    flow: (patch.flow ?? undefined) as PeriodEpisode['flow'] | undefined,
  })
  if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 })
  const prediction = await syncPredictionLog() // self-healing recompute (backdated edits included)
  return NextResponse.json({ period, prediction })
}

export async function DELETE(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  if (!checkRateLimit('periods-write', 60, 60)) return tooMany(60)
  if (!(await getSession())) return unauthorizedResponse()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return badRequest('Missing id')
  await getStore().deletePeriod(id)
  const prediction = await syncPredictionLog()
  return NextResponse.json({ ok: true, prediction })
}

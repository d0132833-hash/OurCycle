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
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const upsertSchema = z.object({
  date: daySchema,
  flow: dayFlowSchema.optional(),
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
  note: z.string().max(4000).nullable().optional(),
})

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
  const entry = await getStore().upsertDay(parsed.data)
  return NextResponse.json({ entry }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  if (!checkRateLimit('days-write', 120, 60)) return tooMany(60)
  if (!(await getSession())) return unauthorizedResponse()
  const parsed = upsertSchema.safeParse(await readJson(req))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
  const entry = await getStore().upsertDay(parsed.data)
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

import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/db'
import { getSession, unauthorizedResponse } from '@/lib/api-auth'
import { badRequest, isSameOrigin, isValidTimezone, readJson } from '@/lib/api-helpers'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const patchSchema = z.object({
  cycle_length_override: z.number().int().min(21).max(45).nullable().optional(),
  bootstrap_cycle_length: z.number().int().min(21).max(45).nullable().optional(),
  period_length: z.number().int().min(1).max(14).nullable().optional(),
  timezone: z.string().refine(isValidTimezone, 'Unknown timezone').optional(),
})

export async function GET() {
  if (!(await getSession())) return unauthorizedResponse()
  const settings = await getStore().getSettings()
  return NextResponse.json({ settings })
}

export async function PATCH(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  if (!(await getSession())) return unauthorizedResponse()
  const parsed = patchSchema.safeParse(await readJson(req))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
  const settings = await getStore().updateSettings(parsed.data)
  return NextResponse.json({ settings })
}

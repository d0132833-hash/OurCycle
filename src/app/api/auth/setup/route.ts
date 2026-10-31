import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/db'
import { hashPassphrase, newSessionPayload, sessionCookieOptions, sessionSecret, signSession } from '@/lib/crypto'
import { badRequest, checkRateLimit, conflict, getClientIp, isSameOrigin, readJson, tooMany } from '@/lib/api-helpers'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  code: z
    .string()
    .min(4, 'PIN must be at least 4 digits')
    .max(32, 'PIN must not exceed 32 digits')
    .regex(/^\d+$/, 'PIN must contain numbers only'),
  setupToken: z.string().optional(),
})

/** First run only: create the vault with an Argon2id hash of the passphrase. */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  const ip = getClientIp(req)
  if (!checkRateLimit(`setup-post:${ip}`, 5, 600)) return tooMany(600)
  const parsed = bodySchema.safeParse(await readJson(req))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  // Environment-gated onboarding protection (SEC-04)
  const requiredToken = process.env.SETUP_TOKEN
  if (requiredToken && parsed.data.setupToken !== requiredToken) {
    return NextResponse.json({ error: 'Invalid or missing setup authorization token' }, { status: 401 })
  }

  const store = getStore()
  if (await store.getSecret()) return conflict('Vault already set up')

  const row = await store.createSecret(hashPassphrase(parsed.data.code))
  await store.getSettings() // ensure the settings row exists

  const res = NextResponse.json({ ok: true })
  res.cookies.set(
    'oc_session',
    signSession(newSessionPayload(row.session_epoch), sessionSecret()),
    sessionCookieOptions(),
  )
  return res
}

import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/db'
import { hashPassphrase, newSessionPayload, sessionCookieOptions, sessionSecret, signSession } from '@/lib/crypto'
import { badRequest, checkRateLimit, conflict, isSameOrigin, readJson, tooMany } from '@/lib/api-helpers'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  code: z
    .string()
    .min(1, 'PIN is required')
    .regex(/^\d+$/, 'PIN must contain numbers only'),
})

/** First run only: create the vault with an Argon2id hash of the passphrase. */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  if (!checkRateLimit('setup-post', 5, 600)) return tooMany(600)
  const parsed = bodySchema.safeParse(await readJson(req))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

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

import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/db'
import {
  hashPassphrase,
  newSessionPayload,
  sessionCookieOptions,
  sessionSecret,
  signSession,
  verifyPassphrase,
} from '@/lib/crypto'
import { badRequest, checkRateLimit, isSameOrigin, readJson, tooMany } from '@/lib/api-helpers'
import { getLockState, recordLoginFailure, recordLoginSuccess } from '@/lib/lockout'
import { getSession } from '@/lib/api-auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  current: z.string().min(1),
  next: z
    .string()
    .min(1, 'PIN is required')
    .regex(/^\d+$/, 'PIN must contain numbers only'),
})

/** Vault rotation: re-hash + bump session epoch → every old cookie dies. */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 })
  }
  if (!checkRateLimit('vault-rotate', 3, 900)) {
    return tooMany(900)
  }
  if (!(await getSession())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const parsed = bodySchema.safeParse(await readJson(req))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const lock = await getLockState()
  if (lock.locked) return tooMany(lock.retryAfterSec)

  const store = getStore()
  const secret = await store.getSecret()
  if (!secret) return badRequest('Vault not set up yet')

  if (!verifyPassphrase(parsed.data.current, secret.passphrase_hash)) {
    await recordLoginFailure()
    return NextResponse.json({ error: 'Incorrect vault PIN' }, { status: 401 })
  }

  await recordLoginSuccess()
  const row = await store.rotateSecret(hashPassphrase(parsed.data.next))
  const res = NextResponse.json({ ok: true })
  res.cookies.set(
    'oc_session',
    signSession(newSessionPayload(row.session_epoch), sessionSecret()),
    sessionCookieOptions(),
  )
  return res
}

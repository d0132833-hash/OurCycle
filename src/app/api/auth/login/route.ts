import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/db'
import {
  newSessionPayload,
  sessionCookieOptions,
  sessionSecret,
  signSession,
  verifyPassphrase,
} from '@/lib/crypto'
import { badRequest, readJson, tooMany } from '@/lib/api-helpers'
import { getLockState, recordLoginFailure, recordLoginSuccess } from '@/lib/lockout'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({ code: z.string().min(1) })

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await readJson(req))
  if (!parsed.success) return badRequest('Invalid input')

  // 5 failed attempts → 10-minute lock (in-memory + DB counter)
  const lock = await getLockState()
  if (lock.locked) return tooMany(lock.retryAfterSec)

  const store = getStore()
  const secret = await store.getSecret()
  if (!secret) return badRequest('Vault not set up yet')

  if (!verifyPassphrase(parsed.data.code, secret.passphrase_hash)) {
    await recordLoginFailure()
    // generic error copy only — never say which factor failed
    return NextResponse.json({ error: 'Incorrect vault code' }, { status: 401 })
  }

  await recordLoginSuccess()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(
    'oc_session',
    signSession(newSessionPayload(secret.session_epoch), sessionSecret()),
    sessionCookieOptions(),
  )
  return res
}

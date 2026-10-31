import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/db'
import {
  newSessionPayload,
  sessionCookieOptions,
  sessionSecret,
  signSession,
  verifyPassphrase,
} from '@/lib/crypto'
import { badRequest, checkRateLimit, getClientIp, isSameOrigin, readJson, tooMany } from '@/lib/api-helpers'
import { getLockState, recordLoginFailure, recordLoginSuccess } from '@/lib/lockout'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({ code: z.string().min(1) })

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  }

  const ip = getClientIp(req)
  if (!checkRateLimit(`login-ip:${ip}`, 20, 60)) {
    return tooMany(60)
  }

  const parsed = bodySchema.safeParse(await readJson(req))
  if (!parsed.success) return badRequest('Invalid input')

  // 5 failed attempts per IP → 10-minute lock (sliding IP window + DB circuit breaker)
  const lock = await getLockState(ip)
  if (lock.locked) return tooMany(lock.retryAfterSec)

  const store = getStore()
  const secret = await store.getSecret()
  if (!secret) {
    return NextResponse.json(
      { error: 'Vault has not been initialized yet. Please complete setup first.' },
      { status: 400 },
    )
  }

  if (!verifyPassphrase(parsed.data.code, secret.passphrase_hash)) {
    await recordLoginFailure(ip)
    // generic error copy only — never say which factor failed
    return NextResponse.json({ error: 'Incorrect vault PIN' }, { status: 401 })
  }

  await recordLoginSuccess(ip)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(
    'oc_session',
    signSession(newSessionPayload(secret.session_epoch), sessionSecret()),
    sessionCookieOptions(),
  )
  return res
}

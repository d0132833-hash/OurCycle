import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getStore } from './db'
import { sessionSecret, SESSION_COOKIE, verifySession, type SessionPayload } from './crypto'

/**
 * Full session check for API routes and server components:
 * signature + expiry (HMAC) AND epoch match against the DB, so a cookie
 * issued before a vault rotation is rejected even though its HMAC is valid.
 */
export async function getSession(): Promise<SessionPayload | null> {
  let token: string | undefined
  try {
    token = (await cookies()).get(SESSION_COOKIE)?.value
  } catch {
    return null
  }
  if (!token) return null
  let secret: string
  try {
    secret = sessionSecret()
  } catch {
    return null
  }
  const payload = verifySession(token, secret)
  if (!payload) return null
  const secretRow = await getStore().getSecret()
  if (!secretRow || payload.v !== secretRow.session_epoch) return null
  return payload
}

/** API-route guard: returns the payload or throws a ready-to-return 401. */
export async function requireSession(): Promise<SessionPayload> {
  const payload = await getSession()
  if (!payload) {
    throw new UnauthorizedError()
  }
  return payload
}

export class UnauthorizedError extends Error {}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
}

/** Wrap a route handler with uniform 401 handling. */
export async function withSession<T>(fn: () => Promise<T>): Promise<T | NextResponse> {
  try {
    await requireSession()
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorizedResponse()
    throw e
  }
  return fn()
}

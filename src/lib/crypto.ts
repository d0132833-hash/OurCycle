import { argon2id } from '@noble/hashes/argon2'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

// NODE-RUNTIME ONLY (API routes / server components). The middleware uses the
// Web Crypto twin in session-edge.ts because edge runtime has no node:crypto.

export const SESSION_COOKIE = 'oc_session'
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days, sliding

// OWASP-recommended Argon2id params for interactive login (m=19 MiB, t=2, p=1)
const ARGON_MEMORY = 19456
const ARGON_ITERATIONS = 2
const ARGON_PARALLELISM = 1

import type { SessionPayload } from './types'

export type { SessionPayload }

let warnedDevSecret = false

/** Dev fallback so the app is testable without env vars; prod requires SESSION_SECRET. */
export function sessionSecret(): string {
  const s = process.env.SESSION_SECRET
  if (s) return s
  if (process.env.NODE_ENV !== 'production') {
    if (!warnedDevSecret) {
      warnedDevSecret = true
      console.warn('[SECURITY WARNING] Using dev fallback session secret. Set SESSION_SECRET before deploying to production.')
    }
    return 'our-cycle-dev-only-secret-change-me'
  }
  throw new Error('SESSION_SECRET env var is required in production')
}

// --- vault passphrase (argon2id) --------------------------------------------

export function hashPassphrase(code: string): string {
  // @noble/hashes v1.8 API: argon2id(password, salt, {p, m, t, dkLen})
  // OWASP-recommended interactive params: m = 19 MiB (19456 KiB), t = 2, p = 1
  const salt = new Uint8Array(randomBytes(16))
  const hash = argon2id(code, salt, {
    p: ARGON_PARALLELISM,
    t: ARGON_ITERATIONS,
    m: ARGON_MEMORY,
    dkLen: 32,
  })
  const params = `m=${ARGON_MEMORY},t=${ARGON_ITERATIONS},p=${ARGON_PARALLELISM}`
  return `argon2id$${params}$${Buffer.from(salt).toString('base64')}$${Buffer.from(hash).toString('base64')}`
}

/** Constant-time verification: recompute with the stored salt/params then compare. */
export function verifyPassphrase(code: string, stored: string): boolean {
  try {
    const parts = stored.split('$')
    if (parts.length !== 4 || parts[0] !== 'argon2id') return false
    const params = Object.fromEntries(
      parts[1].split(',').map((kv) => kv.split('=') as [string, string]),
    )
    const salt = new Uint8Array(Buffer.from(parts[2], 'base64'))
    const expected = Buffer.from(parts[3], 'base64')
    const actual = Buffer.from(
      argon2id(code, salt, {
        p: Number(params.p),
        t: Number(params.t),
        m: Number(params.m),
        dkLen: expected.length,
      }),
    )
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

// --- signed session token (HMAC-SHA256, httpOnly cookie) ---------------------

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Buffer {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return Buffer.from(s, 'base64')
}

export function signSession(payload: SessionPayload, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = b64url(createHmac('sha256', secret).update(body).digest())
  return `${body}.${sig}`
}

/** Returns the payload if the signature and expiry are valid, else null. */
export function verifySession(token: string | undefined | null, secret: string): SessionPayload | null {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = createHmac('sha256', secret).update(body).digest()
  const actual = fromB64url(sig)
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8')) as SessionPayload
    if (typeof payload.exp !== 'number' || typeof payload.iat !== 'number') return null
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function newSessionPayload(epoch: number): SessionPayload {
  const now = Math.floor(Date.now() / 1000)
  return { v: epoch, iat: now, exp: now + SESSION_TTL_SECONDS, j: randomBytes(12).toString('hex') }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  }
}

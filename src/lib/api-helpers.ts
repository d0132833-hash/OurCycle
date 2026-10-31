import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isValidDay } from './dates'
import { DAY_FLOWS, FLOWS } from './types'

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function conflict(message: string) {
  return NextResponse.json({ error: message }, { status: 409 })
}

export function tooMany(retryAfterSec: number) {
  return NextResponse.json(
    { error: 'Too many attempts. Please wait a few minutes and try again.' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } },
  )
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return null
  }
}

// --- shared field schemas ----------------------------------------------------

export const daySchema = z.string().refine(isValidDay, 'Invalid date (expected YYYY-MM-DD)')

export const episodeFlowSchema = z.enum(FLOWS as [string, ...string[]]).nullable()
export const dayFlowSchema = z.enum(DAY_FLOWS as [string, ...string[]]).nullable()

export const score5 = z.number().int().min(1).max(5).nullable()
export const intensity3 = z.number().int().min(0).max(3).nullable()

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

// --- client IP extraction ---------------------------------------------------

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return '127.0.0.1'
}

// --- CSRF origin validation --------------------------------------------------

function isLoopbackHost(h: string): boolean {
  const hostOnly = h.split(':')[0].replace(/^\[|\]$/g, '').toLowerCase()
  return hostOnly === 'localhost' || hostOnly === '127.0.0.1' || hostOnly === '::1'
}

function getHostPort(h: string): string {
  const parts = h.split(':')
  return parts.length > 1 ? parts[parts.length - 1] : ''
}

export function isSameOrigin(req: Request): boolean {
  // Reject explicitly cross-site browser fetches immediately
  const fetchSite = req.headers.get('sec-fetch-site')
  if (fetchSite === 'cross-site') {
    return false
  }
  if (fetchSite === 'same-origin') {
    return true
  }

  const origin = req.headers.get('origin')
  if (!origin) {
    // Non-browser clients, automated test suites, or same-origin direct navigations
    return true
  }

  const host = req.headers.get('host')
  const forwardedHost = req.headers.get('x-forwarded-host')
  const targetHost = forwardedHost || host
  if (!targetHost) return true

  try {
    const originHost = new URL(origin).host
    if (originHost === targetHost || (host ? originHost === host : false)) {
      return true
    }
    // Allow local loopback address interoperability (localhost vs 127.0.0.1 on the same port)
    if (
      isLoopbackHost(originHost) &&
      isLoopbackHost(targetHost) &&
      getHostPort(originHost) === getHostPort(targetHost)
    ) {
      return true
    }
    return false
  } catch {
    return false
  }
}

// --- lightweight rate limiting -----------------------------------------------

const rateLimits = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(key: string, maxRequests: number, windowSec: number): boolean {
  const now = Date.now()

  // Occasional pruning to prevent memory growth
  if (rateLimits.size > 2000) {
    for (const [k, v] of rateLimits.entries()) {
      if (now > v.resetAt) rateLimits.delete(k)
    }
  }

  const current = rateLimits.get(key)
  if (!current || now > current.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + windowSec * 1000 })
    return true
  }
  if (current.count >= maxRequests) {
    return false
  }
  current.count++
  return true
}

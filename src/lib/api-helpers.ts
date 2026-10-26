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

// --- CSRF origin validation --------------------------------------------------

export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  const host = req.headers.get('host')
  if (!host) return true
  try {
    const originHost = new URL(origin).host
    return originHost === host
  } catch {
    return false
  }
}

// --- lightweight rate limiting -----------------------------------------------

const rateLimits = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(key: string, maxRequests: number, windowSec: number): boolean {
  const now = Date.now()
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

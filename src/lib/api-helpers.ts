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

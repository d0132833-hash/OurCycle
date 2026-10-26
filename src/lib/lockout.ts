import { getStore } from './db'
import type { LoginThrottleRow } from './types'

// Brute-force lockout: 5 failed attempts -> 10-minute lock.
// Two layers: an in-memory counter (fast path) + the login_throttle row
// (survives cold starts). Generic errors only — never reveal which part failed.

const MAX_FAILS = 5
const LOCK_MINUTES = 10
const mem = { fails: 0, lockedUntil: 0 }

function nowMs() {
  return Date.now()
}

export async function getLockState(): Promise<{ locked: boolean; retryAfterSec: number }> {
  if (mem.lockedUntil > nowMs()) {
    return { locked: true, retryAfterSec: Math.ceil((mem.lockedUntil - nowMs()) / 1000) }
  }
  if (mem.lockedUntil !== 0 && mem.lockedUntil <= nowMs()) {
    // lock expired in memory — reset the counter
    mem.fails = 0
    mem.lockedUntil = 0
  }
  const row = await getStore().getThrottle()
  mem.fails = Math.max(mem.fails, row.fail_count)
  if (row.locked_until && new Date(row.locked_until).getTime() > nowMs()) {
    mem.lockedUntil = new Date(row.locked_until).getTime()
    return {
      locked: true,
      retryAfterSec: Math.ceil((mem.lockedUntil - nowMs()) / 1000),
    }
  }
  return { locked: false, retryAfterSec: 0 }
}

export async function recordLoginFailure(): Promise<void> {
  const store = getStore()
  const row = await store.getThrottle()
  const lockExpired =
    row.locked_until && new Date(row.locked_until).getTime() <= nowMs()

  // converge both layers, then count this failure once
  mem.fails = lockExpired ? 1 : Math.max(mem.fails, row.fail_count) + 1

  if (mem.fails >= MAX_FAILS) {
    const lockedUntil = new Date(nowMs() + LOCK_MINUTES * 60_000).toISOString()
    mem.lockedUntil = new Date(lockedUntil).getTime()
    mem.fails = MAX_FAILS
    await store.saveThrottle({ fail_count: MAX_FAILS, locked_until: lockedUntil })
  } else {
    await store.saveThrottle({ fail_count: mem.fails, locked_until: null })
  }
}

export async function recordLoginSuccess(): Promise<void> {
  mem.fails = 0
  mem.lockedUntil = 0
  await getStore().saveThrottle({ fail_count: 0, locked_until: null })
}

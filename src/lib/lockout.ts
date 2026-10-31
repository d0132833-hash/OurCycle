import { getStore } from './db'
import type { LoginThrottleRow } from './types'

// Brute-force protection:
// 1. Per-IP sliding lockout: 5 failed attempts from an IP locks THAT IP for 10 minutes.
//    Prevents an external attacker from locking out the legitimate user (Denial of Service).
// 2. Global DB circuit breaker: only triggers if distributed failures exceed GLOBAL_MAX_FAILS (25).
// 3. Generic error copy only — never reveal which factor failed.

const MAX_IP_FAILS = 5
const GLOBAL_MAX_FAILS = 25
const LOCK_MINUTES = 10

interface IpLockEntry {
  fails: number
  lockedUntil: number
}

const ipLocks = new Map<string, IpLockEntry>()
const globalMem = { fails: 0, lockedUntil: 0 }

function nowMs() {
  return Date.now()
}

function getIpEntry(ip: string): IpLockEntry {
  let entry = ipLocks.get(ip)
  if (!entry) {
    entry = { fails: 0, lockedUntil: 0 }
    ipLocks.set(ip, entry)
  }
  // Periodically clean up old entries if map grows large
  if (ipLocks.size > 1000) {
    const now = nowMs()
    for (const [k, v] of ipLocks.entries()) {
      if (v.lockedUntil <= now && v.fails === 0) {
        ipLocks.delete(k)
      }
    }
  }
  return entry
}

export async function getLockState(ip?: string): Promise<{ locked: boolean; retryAfterSec: number }> {
  const now = nowMs()

  // 1. Check IP-specific lockout first
  if (ip) {
    const ipEntry = getIpEntry(ip)
    if (ipEntry.lockedUntil > now) {
      return {
        locked: true,
        retryAfterSec: Math.ceil((ipEntry.lockedUntil - now) / 1000),
      }
    }
    if (ipEntry.lockedUntil !== 0 && ipEntry.lockedUntil <= now) {
      ipEntry.fails = 0
      ipEntry.lockedUntil = 0
    }
  }

  // 2. Check Global memory lock
  if (globalMem.lockedUntil > now) {
    return {
      locked: true,
      retryAfterSec: Math.ceil((globalMem.lockedUntil - now) / 1000),
    }
  }
  if (globalMem.lockedUntil !== 0 && globalMem.lockedUntil <= now) {
    globalMem.fails = 0
    globalMem.lockedUntil = 0
  }

  // 3. Check Global DB throttle
  try {
    const row = await getStore().getThrottle()
    if (row.locked_until && new Date(row.locked_until).getTime() > now) {
      globalMem.lockedUntil = new Date(row.locked_until).getTime()
      return {
        locked: true,
        retryAfterSec: Math.ceil((globalMem.lockedUntil - now) / 1000),
      }
    }
  } catch {
    // If DB is unreachable, rely on memory
  }

  return { locked: false, retryAfterSec: 0 }
}

export async function recordLoginFailure(ip?: string): Promise<void> {
  const now = nowMs()

  // Record failure for the specific IP
  if (ip) {
    const ipEntry = getIpEntry(ip)
    const ipExpired = ipEntry.lockedUntil !== 0 && ipEntry.lockedUntil <= now
    ipEntry.fails = ipExpired ? 1 : ipEntry.fails + 1

    if (ipEntry.fails >= MAX_IP_FAILS) {
      ipEntry.lockedUntil = now + LOCK_MINUTES * 60_000
    }
  }

  // Also track global failures for severe distributed attacks
  try {
    const store = getStore()
    const row = await store.getThrottle()
    const globalExpired = row.locked_until && new Date(row.locked_until).getTime() <= now

    globalMem.fails = globalExpired ? 1 : Math.max(globalMem.fails, row.fail_count) + 1

    if (globalMem.fails >= GLOBAL_MAX_FAILS) {
      const lockedUntil = new Date(now + LOCK_MINUTES * 60_000).toISOString()
      globalMem.lockedUntil = new Date(lockedUntil).getTime()
      globalMem.fails = GLOBAL_MAX_FAILS
      await store.saveThrottle({ fail_count: GLOBAL_MAX_FAILS, locked_until: lockedUntil })
    } else {
      await store.saveThrottle({ fail_count: globalMem.fails, locked_until: null })
    }
  } catch {
    // Non-fatal if DB storage has transient error
  }
}

export async function recordLoginSuccess(ip?: string): Promise<void> {
  if (ip) {
    const ipEntry = getIpEntry(ip)
    ipEntry.fails = 0
    ipEntry.lockedUntil = 0
  }
  globalMem.fails = 0
  globalMem.lockedUntil = 0
  try {
    await getStore().saveThrottle({ fail_count: 0, locked_until: null })
  } catch {
    // Non-fatal
  }
}

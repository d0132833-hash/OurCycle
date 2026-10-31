// Pure day-level date utilities (no I/O).
// Every calendar date is a 'YYYY-MM-DD' string. Math is done on UTC-noon
// Date objects so timezone/DST can never shift a day boundary.

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const MS_DAY = 86_400_000

export function isValidDay(s: unknown): s is string {
  if (typeof s !== 'string' || !DAY_RE.test(s)) return false
  const d = new Date(`${s}T12:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function parseDay(s: string): Date {
  return new Date(`${s}T12:00:00Z`)
}

export function formatDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(s: string, n: number): string {
  return formatDay(new Date(parseDay(s).getTime() + n * MS_DAY))
}

/** a - b, in whole days. */
export function diffDays(a: string, b: string): number {
  return Math.round((parseDay(a).getTime() - parseDay(b).getTime()) / MS_DAY)
}

/** Today's date (YYYY-MM-DD) as seen in the given IANA timezone. */
export function todayInTz(tz: string): string {
  const fmt = (zone: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  try {
    return fmt(tz)
  } catch {
    return fmt('UTC')
  }
}

/** All days from `from` to `to` inclusive (safe for small ranges). */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = []
  let n = diffDays(to, from)
  if (n < 0) return out
  let cur = from
  while (n-- >= 0) {
    out.push(cur)
    cur = addDays(cur, 1)
  }
  return out
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/**
 * Returns the exact number of days in the month for a 'YYYY-MM' or 'YYYY-MM-DD' string.
 * Uses Date.UTC to guarantee timezone-independent accuracy across all user locales.
 */
export function getDaysInMonth(yearMonth: string): number {
  const y = Number(yearMonth.slice(0, 4))
  const m = Number(yearMonth.slice(5, 7)) // 1-12
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

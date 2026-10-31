// Client-side helpers for talking to the API, including the offline
// day-log queue: failed writes are stored in localStorage and replayed
// automatically when the connection comes back.

const QUEUE_KEY = 'ourcycle.queue'

export interface QueuedOp {
  id: string
  kind: 'day' | 'period-start' | 'period-end'
  payload: Record<string, unknown>
  ts: number
}

function readQueue(): QueuedOp[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as QueuedOp[]
  } catch {
    return []
  }
}

function writeQueue(q: QueuedOp[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  window.dispatchEvent(new CustomEvent('ourcycle:queue', { detail: q.length }))
}

export function queueSize(): number {
  return readQueue().length
}

export function dequeueWhere(predicate: (op: QueuedOp) => boolean): void {
  const q = readQueue()
  const filtered = q.filter((op) => !predicate(op))
  if (filtered.length !== q.length) {
    writeQueue(filtered)
  }
}

export function enqueue(kind: QueuedOp['kind'], payload: Record<string, unknown>) {
  const q = readQueue()
  q.push({ id: crypto.randomUUID(), kind, payload, ts: Date.now() })
  writeQueue(q)
}

/** API path for a queued op. */
function endpointFor(op: QueuedOp): { url: string; method: string } {
  switch (op.kind) {
    case 'day':
      return { url: '/api/days', method: 'POST' }
    case 'period-start':
      return { url: '/api/periods', method: 'POST' }
    case 'period-end':
      return { url: '/api/periods', method: 'PATCH' }
  }
}

/**
 * Try to POST/PATCH immediately; if the device is offline or the request
 * fails with a network error, queue it for later replay.
 * Returns { saved: 'online' | 'queued' }.
 */
export async function saveWithOfflineFallback(
  kind: QueuedOp['kind'],
  payload: Record<string, unknown>,
): Promise<'online' | 'queued'> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    enqueue(kind, payload)
    return 'queued'
  }
  const { url, method } = endpointFor({ id: '', kind, payload, ts: 0 })
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/login' // session died — re-auth
      return 'queued'
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(body?.error ?? `Request failed (${res.status})`)
    }
    return 'online'
  } catch (err) {
    if (err instanceof TypeError) {
      // network-level failure → offline
      enqueue(kind, payload)
      return 'queued'
    }
    throw err
  }
}

/** Replay queued ops oldest-first. Returns how many synced. */
export async function flushQueue(): Promise<number> {
  const q = readQueue()
  if (q.length === 0) return 0
  const remaining: QueuedOp[] = []
  let synced = 0
  for (let i = 0; i < q.length; i++) {
    const op = q[i]
    const { url, method } = endpointFor(op)
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(op.payload),
      })
      if (res.status === 401) {
        remaining.push(...q.slice(i))
        break
      }
      if (res.ok || res.status === 409 || res.status === 400) synced += 1
      else remaining.push(op)
    } catch {
      remaining.push(...q.slice(i))
      break // still offline — stop early, keep all remaining in order
    }
  }
  writeQueue(remaining)
  return synced
}

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enqueue, flushQueue, queueSize } from '@/lib/client/offline-queue'

describe('offline queue', () => {
  let storage: Record<string, string> = {}

  beforeEach(() => {
    storage = {}
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, val: string) => {
        storage[key] = val
      },
      removeItem: (key: string) => {
        delete storage[key]
      },
      clear: () => {
        storage = {}
      },
    })
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
    })
  })

  it('starts with an empty queue', () => {
    expect(queueSize()).toBe(0)
  })

  it('enqueues actions and tracks count', () => {
    enqueue('day', { date: '2026-03-15', mood: 4 })
    expect(queueSize()).toBe(1)

    enqueue('period-start', { start_date: '2026-03-16' })
    expect(queueSize()).toBe(2)
  })

  it('flushes queue successfully when network succeeds', async () => {
    enqueue('day', { date: '2026-03-15', mood: 5 })
    enqueue('period-start', { start_date: '2026-03-16' })
    expect(queueSize()).toBe(2)

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      }),
    )

    const synced = await flushQueue()
    expect(synced).toBe(2)
    expect(queueSize()).toBe(0)
  })

  it('stops early and keeps remaining items if network fails during flush', async () => {
    enqueue('day', { date: '2026-03-15' })
    enqueue('period-start', { start_date: '2026-03-16' })

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    )

    const synced = await flushQueue()
    expect(synced).toBe(0)
    expect(queueSize()).toBe(2)
  })
})

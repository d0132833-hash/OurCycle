import { LocalFileStore } from './local-store'
import { SupabaseStore } from './supabase-store'
import type { Store } from './storage'

/**
 * Storage selector — server-side only.
 *
 * Production (Vercel): exactly three env vars — SUPABASE_URL,
 * SUPABASE_SERVICE_KEY, SESSION_SECRET — activate the Supabase store.
 * Local dev / preview: without Supabase env vars we fall back to a JSON
 * file store (.data/db.json) with identical semantics so the whole app
 * is exercisable end-to-end. Never used in production.
 */
let cached: Store | null = null

export function getStore(): Store {
  if (cached) return cached
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (url && key && !url.includes('your-project')) {
    cached = new SupabaseStore(url, key)
  } else {
    cached = new LocalFileStore()
  }
  return cached
}

export type { Store }

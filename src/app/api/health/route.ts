import { NextResponse } from 'next/server'
import { getStore } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const started = Date.now()
  try {
    const store = getStore()
    const initialized = await store.initialized()
    const latencyMs = Date.now() - started
    return NextResponse.json({
      status: 'healthy',
      storeKind: store.kind,
      vaultInitialized: initialized,
      latencyMs,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[HEALTH CHECK ERROR]', error instanceof Error ? error.message : error)
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: 'Database connection unavailable',
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    )
  }
}

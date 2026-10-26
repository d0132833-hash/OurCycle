import { NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/api-auth'
import { computeCurrentPrediction, getAccuracy } from '@/lib/recompute'

export const dynamic = 'force-dynamic'

/** Fresh prediction + model accuracy card data. Read-only (no log writes). */
export async function GET() {
  if (!(await getSession())) return unauthorizedResponse()
  const [prediction, accuracy] = await Promise.all([computeCurrentPrediction(), getAccuracy()])
  return NextResponse.json({ prediction, accuracy })
}

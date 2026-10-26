import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/db'
import { getSession, unauthorizedResponse } from '@/lib/api-auth'
import { isSameOrigin } from '@/lib/api-helpers'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  if (!(await getSession())) return unauthorizedResponse()

  const store = getStore()
  await store.deleteAllData()

  return NextResponse.json({ ok: true, message: 'All cycle and tracking data has been cleared.' })
}

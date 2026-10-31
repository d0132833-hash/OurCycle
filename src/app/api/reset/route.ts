import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/db'
import { getSession, unauthorizedResponse } from '@/lib/api-auth'
import { badRequest, checkRateLimit, getClientIp, isSameOrigin, readJson, tooMany } from '@/lib/api-helpers'
import { verifyPassphrase } from '@/lib/crypto'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  code: z.string().min(1, 'Vault PIN is required to confirm wipe'),
})

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
  const ip = getClientIp(req)
  if (!checkRateLimit(`reset-wipe:${ip}`, 5, 300)) return tooMany(300)
  if (!(await getSession())) return unauthorizedResponse()

  const parsed = bodySchema.safeParse(await readJson(req))
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const store = getStore()
  const secret = await store.getSecret()
  if (!secret) return badRequest('Vault not initialized')

  if (!verifyPassphrase(parsed.data.code, secret.passphrase_hash)) {
    return NextResponse.json({ error: 'Incorrect vault PIN' }, { status: 401 })
  }

  await store.deleteAllData()

  return NextResponse.json({ ok: true, message: 'All cycle and tracking data has been cleared.' })
}

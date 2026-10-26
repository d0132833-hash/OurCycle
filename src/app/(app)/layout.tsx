import { redirect } from 'next/navigation'
import { getStore } from '@/lib/db'
import { getSession } from '@/lib/api-auth'
import { AppShell } from '@/components/app/app-shell'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Full server-side check: HMAC signature + expiry + session epoch,
  // so cookies issued before a vault rotation are rejected here too.
  if (!(await getSession())) redirect('/login')
  await getStore().getSettings() // ensure the settings row exists
  return <AppShell>{children}</AppShell>
}

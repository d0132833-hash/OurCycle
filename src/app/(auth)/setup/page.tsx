import { redirect } from 'next/navigation'
import { getStore } from '@/lib/db'
import { getSession } from '@/lib/api-auth'
import { SetupForm } from '@/components/app/vault-forms'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Our Cycle' }

export default async function SetupPage() {
  if (await getSession()) redirect('/')
  if (await getStore().getSecret()) redirect('/login') // vault exists → go unlock
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <SetupForm />
    </main>
  )
}

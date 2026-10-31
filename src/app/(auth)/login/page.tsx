import { redirect } from 'next/navigation'
import { getStore } from '@/lib/db'
import { getSession } from '@/lib/api-auth'
import { LoginForm } from '@/components/app/vault-forms'
import { hashPassphrase } from '@/lib/crypto'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Our Cycle' }

export default async function LoginPage() {
  // epoch-aware check: HMAC-valid but rotated-out cookies fall through to the form
  if (await getSession()) redirect('/')
  const store = getStore()
  if (!(await store.getSecret())) {
    await store.createSecret(hashPassphrase('2007'))
  }
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <LoginForm />
    </main>
  )
}

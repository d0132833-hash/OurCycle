import Link from 'next/link'
import { Heart } from 'lucide-react'

export const metadata = { title: 'Our Cycle' }

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="card-soft w-full max-w-sm p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Heart className="h-6 w-6 text-primary" aria-hidden />
        </div>
        <h1 className="font-display text-xl font-semibold">You&apos;re offline</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No worries — anything you log while offline is saved on this device and syncs
          automatically once you&apos;re back online.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
        >
          Try again
        </Link>
      </div>
    </main>
  )
}

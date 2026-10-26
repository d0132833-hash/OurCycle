'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Unhandled application error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="card-soft mx-auto max-w-sm p-6 shadow-xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-primary dark:bg-rose-950/50">
          <AlertTriangle className="h-7 w-7 text-primary" aria-hidden />
        </div>
        <h2 className="font-display text-xl font-semibold text-foreground">Something went wrong</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          We encountered an unexpected glitch. Your private tracking data is safe.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <Button
            onClick={() => reset()}
            className="w-full rounded-xl bg-primary text-primary-foreground"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = '/')}
            className="w-full rounded-xl"
          >
            Return home
          </Button>
        </div>
      </div>
    </div>
  )
}

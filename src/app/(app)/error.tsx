'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App shell error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
      <div className="card-soft mx-auto w-full max-w-sm p-6 shadow-md">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-primary dark:bg-rose-950/40">
          <AlertCircle className="h-6 w-6 text-primary" aria-hidden />
        </div>
        <h3 className="font-display text-lg font-semibold text-foreground">Could not load this view</h3>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {error.message || 'An error occurred while loading this section.'}
        </p>
        <div className="mt-5 flex gap-2">
          <Button
            onClick={() => reset()}
            className="flex-1 rounded-xl bg-primary text-primary-foreground text-xs"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Reload view
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = '/')}
            className="rounded-xl text-xs"
          >
            Today
          </Button>
        </div>
      </div>
    </div>
  )
}

import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 animate-in fade-in duration-300">
      {/* Header skeleton */}
      <div className="flex items-center justify-between py-1">
        <Skeleton className="h-7 w-28 rounded-lg bg-rose-200/40 dark:bg-zinc-800" />
        <Skeleton className="h-6 w-20 rounded-full bg-rose-200/30 dark:bg-zinc-800" />
      </div>

      {/* Hero countdown card skeleton */}
      <div className="card-soft flex flex-col items-center justify-center p-6 space-y-4">
        <div className="relative flex h-48 w-48 items-center justify-center">
          <Skeleton className="h-44 w-44 rounded-full bg-rose-100/60 dark:bg-zinc-800/80" />
          <div className="absolute flex flex-col items-center space-y-2">
            <Skeleton className="h-8 w-16 rounded-md bg-rose-200/50 dark:bg-zinc-700" />
            <Skeleton className="h-3 w-24 rounded bg-rose-200/30 dark:bg-zinc-700/60" />
          </div>
        </div>
        <Skeleton className="h-6 w-32 rounded-full bg-rose-100 dark:bg-zinc-800" />
        <Skeleton className="h-4 w-48 rounded bg-rose-100/60 dark:bg-zinc-800/60" />
      </div>

      {/* Action buttons skeleton */}
      <div className="grid grid-cols-2 gap-2.5">
        <Skeleton className="h-14 rounded-2xl bg-rose-200/40 dark:bg-zinc-800" />
        <Skeleton className="h-14 rounded-2xl bg-rose-100/60 dark:bg-zinc-800" />
      </div>

      {/* Secondary card skeleton */}
      <div className="card-soft p-4 space-y-2">
        <Skeleton className="h-4 w-32 rounded bg-rose-100 dark:bg-zinc-800" />
        <Skeleton className="h-3 w-full rounded bg-rose-100/50 dark:bg-zinc-800/60" />
      </div>
    </div>
  )
}

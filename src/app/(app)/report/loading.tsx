import { Skeleton } from '@/components/ui/skeleton'

export default function ReportLoading() {
  return (
    <div className="w-full max-w-3xl lg:max-w-4xl mx-auto space-y-5 pt-2 animate-in fade-in duration-200">
      {/* Report Header Card */}
      <div className="card-soft p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-md bg-rose-200/60 dark:bg-zinc-800" />
            <Skeleton className="h-6 w-60 rounded-lg bg-stone-200/80 dark:bg-zinc-800" />
          </div>
          <Skeleton className="h-3.5 w-44 rounded bg-stone-100 dark:bg-zinc-800/60" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-xl bg-stone-100 dark:bg-zinc-800" />
          <Skeleton className="h-9 w-24 rounded-xl bg-rose-200/60 dark:bg-zinc-800" />
        </div>
      </div>

      {/* 4 Clinical Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card-soft p-4 space-y-2">
            <Skeleton className="h-3 w-20 rounded bg-stone-100 dark:bg-zinc-800" />
            <Skeleton className="h-6 w-16 rounded-md bg-stone-200 dark:bg-zinc-700" />
            <Skeleton className="h-2.5 w-24 rounded bg-stone-100/60 dark:bg-zinc-800/40" />
          </div>
        ))}
      </div>

      {/* Episode History Table Card */}
      <div className="card-soft p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-48 rounded bg-stone-200 dark:bg-zinc-800" />
          <Skeleton className="h-5 w-16 rounded-full bg-stone-100 dark:bg-zinc-800" />
        </div>

        {/* Table skeleton */}
        <div className="space-y-2 border border-border/40 rounded-xl overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-6 gap-2 p-3 bg-stone-100/80 dark:bg-zinc-800/80">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-3.5 rounded bg-stone-200/70 dark:bg-zinc-700" />
            ))}
          </div>
          {/* Data rows */}
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              className="grid grid-cols-6 gap-2 p-3 border-t border-border/30 bg-stone-50/40 dark:bg-zinc-900/40"
            >
              {[1, 2, 3, 4, 5, 6].map((col) => (
                <Skeleton key={col} className="h-3 rounded bg-stone-100 dark:bg-zinc-800" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

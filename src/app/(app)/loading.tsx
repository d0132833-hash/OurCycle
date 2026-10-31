import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="w-full max-w-md md:max-w-4xl lg:max-w-6xl mx-auto space-y-4 pt-2 animate-in fade-in duration-200">
      {/* Header & Perspective Toggle skeleton */}
      <div className="flex items-center justify-between py-1">
        <Skeleton className="h-7 w-28 rounded-lg bg-rose-200/40 dark:bg-zinc-800" />
        <Skeleton className="h-8 w-44 rounded-full bg-stone-100 dark:bg-zinc-800" />
      </div>

      {/* Responsive 2-Column Today Layout (Mobile: 1 column, Tablet/Laptop: 12-column grid) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left Column (5 cols): Sticky Hero Countdown Ring */}
        <div className="md:col-span-5 md:sticky md:top-20 space-y-4">
          <div className="card-soft flex flex-col items-center justify-center p-6 sm:p-8 space-y-4">
            <div className="relative flex h-48 w-48 sm:h-52 sm:w-52 md:h-56 md:w-56 items-center justify-center">
              <Skeleton className="h-44 w-44 sm:h-48 sm:w-48 md:h-52 md:w-52 rounded-full bg-rose-100/60 dark:bg-zinc-800/80" />
              <div className="absolute flex flex-col items-center space-y-2">
                <Skeleton className="h-8 w-16 rounded-md bg-rose-200/50 dark:bg-zinc-700" />
                <Skeleton className="h-3 w-24 rounded bg-rose-200/30 dark:bg-zinc-700/60" />
              </div>
            </div>
            <Skeleton className="h-6 w-32 rounded-full bg-rose-100 dark:bg-zinc-800" />
            <Skeleton className="h-4 w-48 rounded bg-rose-100/60 dark:bg-zinc-800/60" />
          </div>
        </div>

        {/* Right Column (7 cols): Action cards & Partner signals */}
        <div className="md:col-span-7 space-y-4">
          {/* Action buttons skeleton */}
          <div className="grid grid-cols-2 gap-2.5">
            <Skeleton className="h-14 rounded-2xl bg-rose-200/40 dark:bg-zinc-800" />
            <Skeleton className="h-14 rounded-2xl bg-rose-100/60 dark:bg-zinc-800" />
          </div>

          {/* Today logged preview card skeleton */}
          <div className="card-soft p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32 rounded bg-stone-200 dark:bg-zinc-800" />
              <Skeleton className="h-5 w-12 rounded-lg bg-stone-100 dark:bg-zinc-800" />
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Skeleton className="h-6 w-16 rounded-full bg-stone-100 dark:bg-zinc-800" />
              <Skeleton className="h-6 w-20 rounded-full bg-stone-100 dark:bg-zinc-800" />
              <Skeleton className="h-6 w-24 rounded-full bg-stone-100 dark:bg-zinc-800" />
            </div>
          </div>

          {/* Partner signals shelf skeleton */}
          <div className="card-soft p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-36 rounded bg-stone-200 dark:bg-zinc-800" />
              <Skeleton className="h-4 w-14 rounded-full bg-stone-100 dark:bg-zinc-800" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-12 rounded-xl bg-stone-100/80 dark:bg-zinc-800" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { Skeleton } from '@/components/ui/skeleton'

export default function CalendarLoading() {
  return (
    <div className="w-full max-w-md md:max-w-4xl mx-auto space-y-4 pt-2 animate-in fade-in duration-200">
      {/* Title & subtitle skeleton */}
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-32 rounded-lg bg-rose-200/50 dark:bg-zinc-800" />
        <Skeleton className="h-4 w-56 rounded bg-stone-200/60 dark:bg-zinc-800/60" />
      </div>

      {/* Calendar Grid Card */}
      <div className="card-soft p-4 sm:p-6 md:p-8 space-y-4">
        {/* Month Navigation Bar */}
        <div className="flex items-center justify-between pb-2 border-b border-border/40">
          <Skeleton className="h-8 w-8 rounded-xl bg-stone-200/60 dark:bg-zinc-800" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-36 rounded-lg bg-rose-200/40 dark:bg-zinc-800" />
            <Skeleton className="h-6 w-14 rounded-full bg-stone-200/50 dark:bg-zinc-800" />
          </div>
          <Skeleton className="h-8 w-8 rounded-xl bg-stone-200/60 dark:bg-zinc-800" />
        </div>

        {/* 7-column weekday headers */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center py-1">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex justify-center">
              <Skeleton className="h-3 w-6 rounded bg-stone-200/50 dark:bg-zinc-800/50" />
            </div>
          ))}
        </div>

        {/* 5-week day cells grid (35 cells) */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {Array.from({ length: 35 }).map((_, i) => {
            // Emulate realistic cycle pattern tints (period days, fertile days, standard days)
            const isPeriod = i >= 3 && i <= 7
            const isFertile = i >= 14 && i <= 18
            const isToday = i === 10

            return (
              <div key={i} className="flex items-center justify-center p-0.5">
                <Skeleton
                  className={`h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 rounded-2xl ${
                    isPeriod
                      ? 'bg-rose-200/70 dark:bg-rose-950/40 border border-rose-300/40'
                      : isFertile
                        ? 'bg-amber-100/70 dark:bg-amber-950/30'
                        : isToday
                          ? 'bg-primary/20 border-2 border-primary/50'
                          : 'bg-stone-100/70 dark:bg-zinc-800/50'
                  }`}
                />
              </div>
            )
          })}
        </div>

        {/* Legend bar */}
        <div className="pt-4 border-t border-border/40 flex flex-wrap items-center justify-center gap-3">
          <Skeleton className="h-5 w-20 rounded-full bg-rose-100 dark:bg-zinc-800" />
          <Skeleton className="h-5 w-24 rounded-full bg-rose-50 dark:bg-zinc-800" />
          <Skeleton className="h-5 w-20 rounded-full bg-amber-50 dark:bg-zinc-800" />
          <Skeleton className="h-5 w-20 rounded-full bg-stone-100 dark:bg-zinc-800" />
        </div>
      </div>
    </div>
  )
}


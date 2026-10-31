import { Skeleton } from '@/components/ui/skeleton'

export default function InsightsLoading() {
  return (
    <div className="w-full max-w-md md:max-w-4xl lg:max-w-6xl mx-auto space-y-4 pt-2 animate-in fade-in duration-200">
      {/* Title & subtitle skeleton */}
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-28 rounded-lg bg-rose-200/50 dark:bg-zinc-800" />
        <Skeleton className="h-4 w-60 rounded bg-stone-200/60 dark:bg-zinc-800/60" />
      </div>

      {/* Model accuracy banner card */}
      <div className="card-soft p-5 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-36 rounded-md bg-stone-200/70 dark:bg-zinc-800" />
          <Skeleton className="h-4 w-56 rounded bg-stone-100 dark:bg-zinc-800/60" />
          <Skeleton className="h-3 w-72 rounded bg-stone-100/60 dark:bg-zinc-800/40" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full bg-rose-200/40 dark:bg-zinc-800 shrink-0" />
      </div>

      {/* 2-Column Responsive Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
        {/* Chart 1: Cycle Lengths */}
        <div className="card-soft p-5 space-y-3">
          <div className="space-y-1">
            <Skeleton className="h-5 w-32 rounded bg-stone-200/70 dark:bg-zinc-800" />
            <Skeleton className="h-3.5 w-48 rounded bg-stone-100 dark:bg-zinc-800/60" />
          </div>
          {/* Simulated Bar Chart */}
          <div className="h-48 md:h-52 flex items-end justify-between gap-2 pt-6 pb-2 px-3 border-b border-border/40">
            {[65, 80, 70, 95, 75, 85, 72, 78].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <Skeleton
                  className={`w-full max-w-[28px] rounded-t-lg ${
                    i === 3
                      ? 'bg-rose-300/80 dark:bg-rose-800/60'
                      : 'bg-rose-200/50 dark:bg-zinc-700/60'
                  }`}
                  style={{ height: `${h}%` }}
                />
                <Skeleton className="h-2.5 w-4 rounded bg-stone-200/40 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Sex Drive by Phase */}
        <div className="card-soft p-5 space-y-3">
          <div className="space-y-1">
            <Skeleton className="h-5 w-36 rounded bg-stone-200/70 dark:bg-zinc-800" />
            <Skeleton className="h-3.5 w-44 rounded bg-stone-100 dark:bg-zinc-800/60" />
          </div>
          <div className="h-48 md:h-52 flex items-end justify-between gap-4 pt-6 pb-2 px-4 border-b border-border/40">
            {[35, 60, 90, 45].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <Skeleton
                  className="w-full max-w-[40px] rounded-t-lg bg-rose-200/50 dark:bg-zinc-700/60"
                  style={{ height: `${h}%` }}
                />
                <Skeleton className="h-2.5 w-8 rounded bg-stone-200/40 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        </div>

        {/* Chart 3: Pain & Symptoms by Phase */}
        <div className="card-soft p-5 space-y-3">
          <div className="space-y-1">
            <Skeleton className="h-5 w-48 rounded bg-stone-200/70 dark:bg-zinc-800" />
            <Skeleton className="h-3.5 w-40 rounded bg-stone-100 dark:bg-zinc-800/60" />
          </div>
          <div className="h-48 md:h-52 flex items-end justify-between gap-4 pt-6 pb-2 px-4 border-b border-border/40">
            {[85, 30, 20, 65].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <Skeleton
                  className="w-full max-w-[40px] rounded-t-lg bg-rose-200/50 dark:bg-zinc-700/60"
                  style={{ height: `${h}%` }}
                />
                <Skeleton className="h-2.5 w-8 rounded bg-stone-200/40 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        </div>

        {/* Chart 4: Flow Shape */}
        <div className="card-soft p-5 space-y-3">
          <div className="space-y-1">
            <Skeleton className="h-5 w-44 rounded bg-stone-200/70 dark:bg-zinc-800" />
            <Skeleton className="h-3.5 w-40 rounded bg-stone-100 dark:bg-zinc-800/60" />
          </div>
          <div className="h-48 md:h-52 flex items-end justify-between gap-3 pt-6 pb-2 px-3 border-b border-border/40">
            {[45, 90, 80, 50, 25].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                <Skeleton
                  className="w-full max-w-[32px] rounded-t-lg bg-rose-200/50 dark:bg-zinc-700/60"
                  style={{ height: `${h}%` }}
                />
                <Skeleton className="h-2.5 w-6 rounded bg-stone-200/40 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

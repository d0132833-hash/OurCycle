import { Skeleton } from '@/components/ui/skeleton'

export default function SettingsLoading() {
  return (
    <div className="w-full max-w-md md:max-w-4xl lg:max-w-6xl mx-auto space-y-4 pt-2 animate-in fade-in duration-200">
      {/* Title & subtitle skeleton */}
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-36 rounded-lg bg-rose-200/50 dark:bg-zinc-800" />
        <Skeleton className="h-4 w-72 rounded bg-stone-200/60 dark:bg-zinc-800/60" />
      </div>

      {/* 2-Column Responsive Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        {/* Left Column Cards */}
        <div className="space-y-4">
          {/* Card 1: Appearance & Theme */}
          <div className="card-soft p-5 space-y-3">
            <Skeleton className="h-4 w-32 rounded bg-stone-200/70 dark:bg-zinc-800" />
            <div className="grid grid-cols-3 gap-2 pt-1">
              <Skeleton className="h-10 rounded-xl bg-stone-100 dark:bg-zinc-800" />
              <Skeleton className="h-10 rounded-xl bg-stone-100 dark:bg-zinc-800" />
              <Skeleton className="h-10 rounded-xl bg-stone-100 dark:bg-zinc-800" />
            </div>
          </div>

          {/* Card 2: Timezone */}
          <div className="card-soft p-5 space-y-3">
            <Skeleton className="h-4 w-28 rounded bg-stone-200/70 dark:bg-zinc-800" />
            <Skeleton className="h-10 w-full rounded-xl bg-stone-100 dark:bg-zinc-800" />
          </div>

          {/* Card 3: Data Portability & Reports */}
          <div className="card-soft p-5 space-y-3">
            <Skeleton className="h-4 w-44 rounded bg-stone-200/70 dark:bg-zinc-800" />
            <Skeleton className="h-3 w-64 rounded bg-stone-100/60 dark:bg-zinc-800/40" />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Skeleton className="h-10 rounded-xl bg-stone-100 dark:bg-zinc-800" />
              <Skeleton className="h-10 rounded-xl bg-stone-100 dark:bg-zinc-800" />
              <Skeleton className="h-10 rounded-xl bg-stone-100 dark:bg-zinc-800" />
              <Skeleton className="h-10 rounded-xl bg-stone-100 dark:bg-zinc-800" />
            </div>
          </div>
        </div>

        {/* Right Column Cards */}
        <div className="space-y-4">
          {/* Card 4: Biological Cycle Learning */}
          <div className="card-soft p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-40 rounded bg-stone-200/70 dark:bg-zinc-800" />
                <Skeleton className="h-3 w-56 rounded bg-stone-100/60 dark:bg-zinc-800/40" />
              </div>
              <Skeleton className="h-6 w-11 rounded-full bg-stone-200 dark:bg-zinc-700" />
            </div>
            {/* Slider track skeleton */}
            <div className="pt-2 space-y-2">
              <Skeleton className="h-2 w-full rounded-full bg-stone-100 dark:bg-zinc-800" />
              <div className="flex justify-between">
                <Skeleton className="h-3 w-10 rounded bg-stone-200/40 dark:bg-zinc-800" />
                <Skeleton className="h-3 w-10 rounded bg-stone-200/40 dark:bg-zinc-800" />
              </div>
            </div>
          </div>

          {/* Card 5: Period History Management */}
          <div className="card-soft p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-36 rounded bg-stone-200/70 dark:bg-zinc-800" />
              <Skeleton className="h-7 w-20 rounded-xl bg-stone-100 dark:bg-zinc-800" />
            </div>
            <div className="space-y-2 pt-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl bg-stone-50/70 dark:bg-zinc-800/50 border border-border/40"
                >
                  <div className="space-y-1">
                    <Skeleton className="h-3.5 w-32 rounded bg-stone-200 dark:bg-zinc-700" />
                    <Skeleton className="h-2.5 w-20 rounded bg-stone-100 dark:bg-zinc-800" />
                  </div>
                  <Skeleton className="h-6 w-14 rounded-lg bg-stone-200/60 dark:bg-zinc-700" />
                </div>
              ))}
            </div>
          </div>

          {/* Card 6: Vault Code Rotation */}
          <div className="card-soft p-5 space-y-3">
            <Skeleton className="h-4 w-32 rounded bg-stone-200/70 dark:bg-zinc-800" />
            <Skeleton className="h-10 w-full rounded-xl bg-stone-100 dark:bg-zinc-800" />
            <Skeleton className="h-9 w-28 rounded-xl bg-rose-200/60 dark:bg-zinc-800" />
          </div>
        </div>
      </div>
    </div>
  )
}


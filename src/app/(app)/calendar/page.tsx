import { getStore } from '@/lib/db'
import { computeCurrentPrediction } from '@/lib/recompute'
import { CalendarGrid } from '@/components/app/calendar-grid'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Our Cycle' }

export default async function CalendarPage() {
  const store = getStore()
  const [episodes, entries] = await Promise.all([store.listPeriods(), store.listDays()])
  const prediction = await computeCurrentPrediction()

  return (
    <div className="space-y-4 pt-2">
      <div>
        <h2 className="font-display text-xl font-semibold">Calendar</h2>
        <p className="text-sm text-muted-foreground">Tap any past or today&apos;s date to log it.</p>
      </div>
      <CalendarGrid episodes={episodes} entries={entries} prediction={prediction} />
    </div>
  )
}

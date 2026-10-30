import { getStore } from '@/lib/db'
import { computeCurrentPrediction } from '@/lib/recompute'
import { BootstrapForm } from '@/components/app/bootstrap-form'
import { TodayView } from '@/components/app/today-view'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Our Cycle' }

const DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'UTC',
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

export default async function TodayPage() {
  const store = getStore()
  const prediction = await computeCurrentPrediction()
  const todayEntry = (await store.listDays(prediction.today, prediction.today)).at(0) ?? null

  if (!prediction.hasEpisodes) {
    return (
      <div className="space-y-4 pt-2">
        <div>
          <h2 className="font-display text-xl font-semibold">Today</h2>
          <p className="text-sm text-muted-foreground">
            {DATE_FMT.format(new Date(`${prediction.today}T12:00:00Z`))}
          </p>
        </div>
        <BootstrapForm today={prediction.today} />
      </div>
    )
  }

  const ongoing =
    prediction.bleedingToday && prediction.anchorStart
      ? (await store.listPeriods()).find(
          (e) =>
            e.start_date <= prediction.today &&
            (e.end_date === null || e.end_date >= prediction.today),
        ) ?? null
      : null

  return (
    <TodayView
      prediction={prediction}
      todayEntry={todayEntry}
      ongoing={ongoing}
    />
  )
}

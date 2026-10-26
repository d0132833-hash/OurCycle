import { getStore } from '@/lib/db'
import { computeCurrentPrediction, getAccuracy } from '@/lib/recompute'
import { buildPhaseMap } from '@/lib/predictions'
import { InsightsView } from '@/components/app/insights-view'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Our Cycle' }

export default async function InsightsPage() {
  const store = getStore()
  const [episodes, days] = await Promise.all([store.listPeriods(), store.listDays()])
  const [prediction, accuracy] = await Promise.all([computeCurrentPrediction(), getAccuracy()])

  let phaseMap = {}
  if (days.length > 0) {
    const dates = days.map((d) => d.date).sort()
    phaseMap = buildPhaseMap(episodes, dates[0], dates[dates.length - 1], prediction)
  }

  return (
    <div className="pt-2">
      <InsightsView
        episodes={episodes}
        days={days}
        prediction={prediction}
        accuracy={accuracy}
        phaseMap={phaseMap}
      />
    </div>
  )
}

import { getStore } from '@/lib/db'
import { computeCurrentPrediction, getAccuracy } from '@/lib/recompute'
import { InsightsView } from '@/components/app/insights-view'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Our Cycle' }

export default async function InsightsPage() {
  const store = getStore()
  const [episodes, days] = await Promise.all([store.listPeriods(), store.listDays()])
  const [prediction, accuracy] = await Promise.all([computeCurrentPrediction(), getAccuracy()])

  return (
    <div className="pt-2">
      <InsightsView
        episodes={episodes}
        days={days}
        prediction={prediction}
        accuracy={accuracy}
      />
    </div>
  )
}

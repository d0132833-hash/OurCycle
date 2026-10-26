import { computeCurrentPrediction } from '@/lib/recompute'
import { getStore } from '@/lib/db'
import { SettingsView } from '@/components/app/settings-view'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Our Cycle' }

export default async function SettingsPage() {
  const store = getStore()
  const [settings, prediction] = await Promise.all([store.getSettings(), computeCurrentPrediction()])

  return (
    <div className="pt-2">
      <SettingsView
        settings={settings}
        autoCycleLength={prediction.autoCycleLength}
        sigma={prediction.regularity.sigma}
      />
    </div>
  )
}

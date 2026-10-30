import { redirect } from 'next/navigation'
import { getStore } from '@/lib/db'
import { getSession } from '@/lib/api-auth'
import { computeCurrentPrediction } from '@/lib/recompute'
import { DoctorReport } from '@/components/app/doctor-report'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Clinical Summary Report — Our Cycle' }

export default async function ReportPage() {
  if (!(await getSession())) redirect('/login')

  const store = getStore()
  const [episodes, days, settings, prediction] = await Promise.all([
    store.listPeriods(),
    store.listDays(),
    store.getSettings(),
    computeCurrentPrediction(),
  ])

  return (
    <DoctorReport
      episodes={episodes}
      days={days}
      prediction={prediction}
      settings={settings}
    />
  )
}


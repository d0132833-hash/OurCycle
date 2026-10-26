import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/db'
import { getSession, unauthorizedResponse } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!(await getSession())) return unauthorizedResponse()

  const store = getStore()
  const [periods, days, settings, predictions] = await Promise.all([
    store.listPeriods(),
    store.listDays(),
    store.getSettings(),
    store.listPredictions(),
  ])

  const format = req.nextUrl.searchParams.get('format') ?? 'json'

  if (format === 'csv') {
    // Generate CSV for periods and days
    const lines: string[] = ['# OURCYCLE DATA EXPORT', '']

    lines.push('### PERIOD EPISODES')
    lines.push('id,start_date,end_date,flow,created_at')
    for (const p of periods) {
      lines.push(`"${p.id}","${p.start_date}","${p.end_date ?? ''}","${p.flow ?? ''}","${p.created_at ?? ''}"`)
    }

    lines.push('', '### DAILY SYMPTOM & MOOD LOGS')
    lines.push('date,flow,mood,energy,libido,cramps,headache,back_pain,breast_tenderness,acne,bloating,fatigue,bbt,weight,note')
    for (const d of days) {
      const escapedNote = (d.note ?? '').replace(/"/g, '""')
      lines.push(
        `"${d.date}","${d.flow ?? ''}",${d.mood ?? ''},${d.energy ?? ''},${d.libido ?? ''},${d.cramps ?? ''},${d.headache ?? ''},${d.back_pain ?? ''},${d.breast_tenderness ?? ''},${d.acne ?? ''},${d.bloating ?? ''},${d.fatigue ?? ''},${d.bbt ?? ''},${d.weight ?? ''},"${escapedNote}"`,
      )
    }

    return new NextResponse(lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ourcycle-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  }

  const exportPayload = {
    version: '1.0',
    exported_at: new Date().toISOString(),
    settings: {
      timezone: settings.timezone,
      cycle_length_override: settings.cycle_length_override,
      bootstrap_cycle_length: settings.bootstrap_cycle_length,
    },
    periods,
    days,
    predictions,
  }

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="ourcycle-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  })
}

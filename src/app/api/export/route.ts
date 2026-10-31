import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/db'
import { getSession, unauthorizedResponse } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

/**
 * Sanitizes a CSV cell to prevent CSV Formula Injection (CWE-1236).
 * Prepends a single quote if the value begins with formula characters (=, +, -, @, \t, \r).
 */
function csvCell(val: unknown): string {
  if (val === null || val === undefined) return '""'
  const str = String(val)
  let escaped = str.replace(/"/g, '""')
  if (/^[=+\-@\t\r]/.test(escaped.trimStart())) {
    escaped = `'${escaped}`
  }
  return `"${escaped}"`
}

function csvNum(val: unknown): string {
  if (val === null || val === undefined || val === '') return ''
  return String(val)
}

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
      lines.push(`${csvCell(p.id)},${csvCell(p.start_date)},${csvCell(p.end_date)},${csvCell(p.flow)},${csvCell(p.created_at)}`)
    }

    lines.push('', '### DAILY SYMPTOM & MOOD LOGS')
    lines.push('date,flow,mood,energy,libido,cramps,headache,back_pain,breast_tenderness,acne,bloating,fatigue,bbt,weight,note')
    for (const d of days) {
      lines.push(
        `${csvCell(d.date)},${csvCell(d.flow)},${csvNum(d.mood)},${csvNum(d.energy)},${csvNum(d.libido)},${csvNum(d.cramps)},${csvNum(d.headache)},${csvNum(d.back_pain)},${csvNum(d.breast_tenderness)},${csvNum(d.acne)},${csvNum(d.bloating)},${csvNum(d.fatigue)},${csvNum(d.bbt)},${csvNum(d.weight)},${csvCell(d.note)}`,
      )
    }

    return new NextResponse(lines.join('\n'), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="ourcycle-export-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
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
      period_length: settings.period_length ?? 5,
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
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
    },
  })
}

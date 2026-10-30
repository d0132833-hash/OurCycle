import { NextRequest, NextResponse } from 'next/server'
import { getStore } from '@/lib/db'
import { getSession } from '@/lib/api-auth'
import { computeCurrentPrediction } from '@/lib/recompute'
import { addDays, diffDays } from '@/lib/dates'

export const dynamic = 'force-dynamic'

function formatDateToICS(dayStr: string): string {
  // DayStr is 'YYYY-MM-DD' -> 'YYYYMMDD'
  return dayStr.replace(/-/g, '')
}

function generateUID(seed: string): string {
  return `${seed}@ourcycle.app`
}

export async function GET(req: NextRequest) {
  // Session check
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const store = getStore()
  const [episodes, settings, prediction] = await Promise.all([
    store.listPeriods(),
    store.getSettings(),
    computeCurrentPrediction(),
  ])

  const nowUTC = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const events: string[] = []

  // 1. Logged Past Periods (last 12 months)
  episodes.forEach((ep, idx) => {
    const startICS = formatDateToICS(ep.start_date)
    // DTEND in iCalendar is exclusive for whole-day events
    const endDate = ep.end_date ? addDays(ep.end_date, 1) : addDays(ep.start_date, 5)
    const endICS = formatDateToICS(endDate)

    events.push([
      'BEGIN:VEVENT',
      `UID:${generateUID(`period-${ep.id || idx}`)}`,
      `DTSTAMP:${nowUTC}`,
      `DTSTART;VALUE=DATE:${startICS}`,
      `DTEND;VALUE=DATE:${endICS}`,
      'SUMMARY:🩸 Period (Logged)',
      `DESCRIPTION:Logged period episode.${ep.flow ? ` Flow: ${ep.flow}` : ''}`,
      'TRANSP:TRANSPARENT',
      'STATUS:CONFIRMED',
      'END:VEVENT',
    ].join('\r\n'))
  })

  // 2. Upcoming Predicted Periods (next 3 cycles)
  if (prediction.nextPeriodStart && prediction.cycleLength) {
    const cycleLen = prediction.cycleLength
    const duration = prediction.predictedPeriodDuration || 5

    for (let c = 0; c < 3; c++) {
      const predStart = addDays(prediction.nextPeriodStart, c * cycleLen)
      const predEnd = addDays(predStart, duration)
      const startICS = formatDateToICS(predStart)
      const endICS = formatDateToICS(predEnd)

      events.push([
        'BEGIN:VEVENT',
        `UID:${generateUID(`pred-period-${c}`)}`,
        `DTSTAMP:${nowUTC}`,
        `DTSTART;VALUE=DATE:${startICS}`,
        `DTEND;VALUE=DATE:${endICS}`,
        `SUMMARY:🌸 Predicted Period (Cycle +${c + 1})`,
        `DESCRIPTION:Estimated start ~${predStart}. Duration: ~${duration} days (${prediction.confidence} confidence).`,
        'TRANSP:TRANSPARENT',
        'STATUS:TENTATIVE',
        'BEGIN:VALARM',
        'TRIGGER:-P1D',
        'ACTION:DISPLAY',
        'DESCRIPTION:Period predicted to arrive tomorrow',
        'END:VALARM',
        'END:VEVENT',
      ].join('\r\n'))

      // Fertile Window
      const ovulationDay = addDays(predStart, -14)
      const fertileStart = addDays(ovulationDay, -5)
      const fertileEnd = addDays(ovulationDay, 2) // exclusive +1 day
      events.push([
        'BEGIN:VEVENT',
        `UID:${generateUID(`pred-fertile-${c}`)}`,
        `DTSTAMP:${nowUTC}`,
        `DTSTART;VALUE=DATE:${formatDateToICS(fertileStart)}`,
        `DTEND;VALUE=DATE:${formatDateToICS(fertileEnd)}`,
        'SUMMARY:✨ Estimated Fertile Window',
        `DESCRIPTION:Estimated fertile window around ovulation (~${ovulationDay}). Estimates only — not medical advice.`,
        'TRANSP:TRANSPARENT',
        'STATUS:TENTATIVE',
        'END:VEVENT',
      ].join('\r\n'))

      // PMS Heads-Up (5 days before period)
      const pmsStart = addDays(predStart, -5)
      events.push([
        'BEGIN:VEVENT',
        `UID:${generateUID(`pred-pms-${c}`)}`,
        `DTSTAMP:${nowUTC}`,
        `DTSTART;VALUE=DATE:${formatDateToICS(pmsStart)}`,
        `DTEND;VALUE=DATE:${startICS}`,
        'SUMMARY:🌙 PMS Window Heads-Up',
        'DESCRIPTION:Luteal phase. Possible mood or energy changes. Time for extra comfort and rest.',
        'TRANSP:TRANSPARENT',
        'STATUS:TENTATIVE',
        'END:VEVENT',
      ].join('\r\n'))
    }
  }

  const icsBody = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Our Cycle//Menstrual Health Tracker//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Our Cycle Forecast',
    `X-WR-TIMEZONE:${settings.timezone || 'UTC'}`,
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')

  return new NextResponse(icsBody, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="our-cycle.ics"',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}


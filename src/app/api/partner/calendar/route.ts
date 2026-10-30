import { NextResponse } from 'next/server'
import { getSession, unauthorizedResponse } from '@/lib/api-auth'
import { computeCurrentPrediction } from '@/lib/recompute'
import { generateDiscreetCalendarIcs } from '@/lib/partner-intelligence'

export const dynamic = 'force-dynamic'

/**
 * Returns a discreet iCalendar (.ics) file for the partner to subscribe or import
 * into Google Calendar, Apple Calendar, or Outlook.
 */
export async function GET() {
  if (!(await getSession())) return unauthorizedResponse()

  const prediction = await computeCurrentPrediction()
  const ics = generateDiscreetCalendarIcs(prediction, 3)

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="ourcycle-partner-companion.ics"',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}


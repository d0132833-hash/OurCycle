import { getStore } from '@/lib/db'
import { computeCurrentPrediction } from '@/lib/recompute'
import { CountdownRing } from '@/components/app/countdown-ring'
import { PeriodActions } from '@/components/app/period-actions'
import { BootstrapForm } from '@/components/app/bootstrap-form'
import {
  PHASE_COPY,
  expectationLine,
  fmtShort,
  fertileHint,
  pmsHint,
} from '@/components/app/phase-copy'

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
        <Header today={prediction.today} />
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

  const phase = prediction.todayPhase
  const copy = phase ? PHASE_COPY[phase] : null
  const pms = pmsHint(prediction)
  const fertile = fertileHint(prediction)

  return (
    <div className="space-y-4 pt-2">
      <Header today={prediction.today} />

      {prediction.irregular ? (
        <div className="rounded-2xl bg-amber-100/70 px-4 py-2.5 text-sm text-amber-900">
          <span className="font-semibold">Irregular pattern</span> — dates below are ranges.
          Keep logging and predictions will sharpen.
        </div>
      ) : null}

      <section className="card-soft p-6 text-center" aria-live="polite">
        {prediction.isLate ? (
          <>
            <CountdownRing
              today={prediction.today}
              nextPeriodStart={prediction.nextPeriodStart}
              cycleLength={prediction.cycleLength}
              bleedingToday={prediction.bleedingToday}
              periodDay={prediction.periodDay}
              predictedPeriodDuration={prediction.predictedPeriodDuration}
              isLate={prediction.isLate}
            />
            <h2 className="font-display mt-2 text-lg font-semibold">No period logged yet</h2>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
              Cycles vary month to month — this happens to everyone sometimes. Whenever
              it arrives, log it below and the predictions will re-align.
            </p>
          </>
        ) : (
          <>
            <CountdownRing
              today={prediction.today}
              nextPeriodStart={prediction.nextPeriodStart}
              cycleLength={prediction.cycleLength}
              bleedingToday={prediction.bleedingToday}
              periodDay={prediction.periodDay}
              predictedPeriodDuration={prediction.predictedPeriodDuration}
              isLate={false}
            />
            <h2 className="font-display mt-2 text-lg font-semibold">{copy?.title}</h2>
            {copy ? (
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">{copy.body}</p>
            ) : null}
          </>
        )}

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {prediction.nextPeriodStart && !prediction.bleedingToday && !prediction.irregular ? (
            <span className="chip text-[#9F1239]">
              Next period {fmtShort(prediction.nextPeriodStart)}
            </span>
          ) : null}
          {pms ? <span className="chip bg-[#FFF7ED] text-[#9A3412]">{pms}</span> : null}
          {fertile ? (
            <span className="chip bg-[#FDBA74]/25 text-[#9A3412]">{fertile} · estimate</span>
          ) : null}
          {prediction.regularity.sigma !== null && !prediction.isLate ? (
            <span className="chip text-[#44403C]">
              {prediction.regularity.label} · σ {prediction.regularity.sigma.toFixed(1)}d
            </span>
          ) : null}
        </div>

        <p className="mx-auto mt-4 max-w-xs text-xs leading-relaxed text-muted-foreground">
          {expectationLine(prediction)}
        </p>
      </section>

      <PeriodActions
        today={prediction.today}
        todayEntry={todayEntry}
        ongoingEpisodeId={ongoing?.id ?? null}
      />

      <p className="px-2 pb-2 text-center text-[11px] text-muted-foreground">
        Estimates only — not medical advice, not contraception.
      </p>
    </div>
  )
}

function Header({ today }: { today: string }) {
  return (
    <div>
      <h2 className="font-display text-xl font-semibold">Today</h2>
      <p className="text-sm text-muted-foreground">
        {DATE_FMT.format(new Date(`${today}T12:00:00Z`))}
      </p>
    </div>
  )
}

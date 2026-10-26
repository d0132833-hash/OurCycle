'use client'

import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  SYMPTOM_KEYS,
  SYMPTOM_LABELS,
  type DayEntry,
  type PeriodEpisode,
} from '@/lib/types'
import {
  buildPhaseMap,
  type Prediction,
} from '@/lib/predictions'
import { addDays } from '@/lib/dates'

interface Props {
  episodes: PeriodEpisode[]
  days: DayEntry[]
  prediction: Prediction
  accuracy: { evaluated: number; hits: number; window: number }
}

const PHASES = ['menstrual', 'follicular', 'ovulation', 'luteal'] as const
const PHASE_LABEL: Record<string, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulation: 'Ovulation',
  luteal: 'Luteal',
}
const FLOW_VALUE: Record<string, number> = {
  none: 0,
  spotting: 1,
  light: 2,
  medium: 3,
  heavy: 4,
}
const FLOW_COLOR = ['#F5F5F4', '#FECDD3', '#FDA4AF', '#FB7185', '#E11D48']
const FLOW_LABEL = ['None', 'Spotting', 'Light', 'Medium', 'Heavy']

export function InsightsView({ episodes, days, prediction, accuracy }: Props) {
  // All insight math runs client-side from her own data.
  const phaseMap = useMemo(
    () =>
      days.length
        ? buildPhaseMap(episodes, days[0].date, prediction.today, prediction)
        : {},
    [episodes, days, prediction],
  )

  // 1) Sex drive by cycle phase ------------------------------------------------
  const libidoData = useMemo(() => {
    const acc: Record<string, { sum: number; n: number }> = {}
    for (const p of PHASES) acc[p] = { sum: 0, n: 0 }
    for (const d of days) {
      if (d.libido === null || d.libido === undefined) continue
      const ph = phaseMap[d.date]
      if (!ph) continue
      acc[ph].sum += d.libido
      acc[ph].n += 1
    }
    const hasData = PHASES.some((p) => acc[p].n > 0)
    return {
      hasData,
      data: PHASES.map((p) => ({
        phase: PHASE_LABEL[p],
        value: acc[p].n ? Number((acc[p].sum / acc[p].n).toFixed(1)) : 0,
        n: acc[p].n,
      })),
    }
  }, [days, phaseMap])

  // 2) Pain by phase — concrete line over the last 6 luteal phases ---------------
  const painData = useMemo(() => {
    // symptom-days per phase
    const perPhase: Record<string, number> = {}
    for (const p of PHASES) perPhase[p] = 0
    for (const d of days) {
      const ph = phaseMap[d.date]
      if (!ph) continue
      for (const s of SYMPTOM_KEYS) {
        if ((d[s] ?? 0) > 0) perPhase[ph] += 1
      }
    }
    // "X of your last N luteal phases" per symptom
    const completed = prediction.observations
      .filter((o) => o.status === 'used')
      .slice(-6)
    const perSymptom = SYMPTOM_KEYS.map((s) => {
      let hit = 0
      for (const c of completed) {
        const from = addDays(c.to, -13) // luteal = next start −13 … −1
        const to = addDays(c.to, -1)
        const found = days.some(
          (d) => d.date >= from && d.date <= to && (d[s] ?? 0) > 0,
        )
        if (found) hit += 1
      }
      return { key: s, label: SYMPTOM_LABELS[s], hits: hit, total: completed.length }
    }).sort((a, b) => b.hits - a.hits)
    const top = perSymptom.find((s) => s.hits > 0 && s.total >= 3)
    return {
      data: PHASES.map((p) => ({ phase: PHASE_LABEL[p], value: perPhase[p] })),
      line: top
        ? `${top.label} showed up in ${top.hits} of your last ${top.total} luteal phases.`
        : null,
      hasData: PHASES.some((p) => perPhase[p] > 0),
    }
  }, [days, phaseMap, prediction.observations])

  // 3) Flow shape — average flow by cycle day -----------------------------------
  const flowData = useMemo(() => {
    const buckets = new Map<number, { sum: number; n: number }>()
    for (const e of episodes) {
      const end = e.end_date ?? prediction.today
      for (let d = e.start_date, k = 1; d <= end && k <= 10; d = addDays(d, 1), k++) {
        const entry = days.find((x) => x.date === d)
        if (!entry || entry.flow === null || entry.flow === undefined) continue
        const b = buckets.get(k) ?? { sum: 0, n: 0 }
        b.sum += FLOW_VALUE[entry.flow]
        b.n += 1
        buckets.set(k, b)
      }
    }
    const maxDay = Math.max(5, ...buckets.keys())
    const data: { day: string; avg: number; idx: number }[] = []
    for (let k = 1; k <= maxDay; k++) {
      const b = buckets.get(k)
      const avg = b && b.n ? b.sum / b.n : 0
      data.push({ day: `D${k}`, avg: Number(avg.toFixed(2)), idx: Math.round(avg) })
    }
    return { data, hasData: buckets.size > 0 }
  }, [episodes, days, prediction.today])

  // 4) Cycle trend ----------------------------------------------------------------
  const trend = useMemo(() => {
    const used = prediction.observations
    const shown = used.slice(-12)
    const durations = episodes
      .filter((e) => e.end_date && e.end_date >= e.start_date)
      .map((e) => {
        const start = new Date(`${e.start_date}T12:00:00Z`).getTime()
        const end = new Date(`${e.end_date}T12:00:00Z`).getTime()
        return Math.round((end - start) / 86400000) + 1
      })
    const avgDuration = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null
    return {
      data: shown.map((o, i) => ({
        name: `C${i + 1}`,
        length: o.length,
        flagged: o.status !== 'used',
      })),
      avgDuration,
      count: shown.length,
    }
  }, [prediction.observations, episodes])

  const regBadge = prediction.regularity.sigma === null
    ? { label: 'Learning your pattern', cls: 'bg-secondary text-secondary-foreground' }
    : prediction.regularity.label === 'Regular'
      ? { label: 'Regular pattern', cls: 'bg-emerald-100 text-emerald-800' }
      : prediction.regularity.label === 'Varies'
        ? { label: 'Varies a bit', cls: 'bg-amber-100 text-amber-800' }
        : { label: 'Irregular pattern', cls: 'bg-amber-200 text-amber-900' }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold">Insights</h2>
        <p className="text-sm text-muted-foreground">
          Patterns from your own logs — supportive, never diagnostic.
        </p>
      </div>

      {/* Model accuracy */}
      <Card className="card-soft border-0">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-semibold">Model accuracy</h3>
              {accuracy.evaluated > 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Model accuracy: <span className="font-semibold text-foreground">
                    {accuracy.hits}/{accuracy.evaluated}
                  </span>{' '}
                  within ±{accuracy.window} day{accuracy.window > 1 ? 's' : ''} — every
                  forecast is checked against what actually happened.
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  The first accuracy check appears after your next logged period.
                </p>
              )}
            </div>
            <Badge className={`${regBadge.cls} border-0`}>{regBadge.label}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Cycle trend */}
      <Card className="card-soft border-0">
        <CardContent className="p-5">
          <h3 className="font-display text-base font-semibold">Cycle lengths</h3>
          {trend.count > 0 ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Last {trend.count} cycle{trend.count > 1 ? 's' : ''} · average period ~
                {trend.avgDuration ?? prediction.predictedPeriodDuration} days
                {prediction.usingOverride
                  ? ` · fixed length ${prediction.cycleLength}d (auto-learn suggests ~${prediction.autoCycleLength}d)`
                  : ''}
              </p>
              <div className="mt-3 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trend.data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                    <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={11} stroke="#8A7F78" />
                    <YAxis domain={[18, 'auto']} tickLine={false} axisLine={false} fontSize={11} stroke="#8A7F78" />
                    <Tooltip
                      cursor={{ fill: 'rgba(225,29,72,0.06)' }}
                      contentStyle={{ borderRadius: 12, border: '1px solid rgba(225,29,72,0.15)', fontSize: 12 }}
                      formatter={(v: number, _n, item) => [
                        item.payload.flagged ? `${v}d (flagged)` : `${v} days`,
                        'Cycle',
                      ]}
                    />
                    <ReferenceLine
                      y={prediction.autoCycleLength ?? prediction.cycleLength ?? 28}
                      stroke="#FDBA74"
                      strokeDasharray="4 4"
                    />
                    <Bar dataKey="length" radius={[6, 6, 0, 0]} maxBarSize={34}>
                      {trend.data.map((d, i) => (
                        <Cell key={i} fill={d.flagged ? '#FDBA74' : '#E11D48'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Dashed line: your learned average. Amber bars were flagged as unusual and
                don&apos;t skew the forecast.
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              After two logged periods your cycle history appears here.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Sex drive by phase */}
      <Card className="card-soft border-0">
        <CardContent className="p-5">
          <h3 className="font-display text-base font-semibold">Sex drive by phase</h3>
          {libidoData.hasData ? (
            <>
              <div className="mt-3 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={libidoData.data} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
                    <XAxis dataKey="phase" tickLine={false} axisLine={false} fontSize={11} stroke="#8A7F78" />
                    <YAxis domain={[0, 5]} tickLine={false} axisLine={false} fontSize={11} stroke="#8A7F78" />
                    <Tooltip
                      cursor={{ fill: 'rgba(225,29,72,0.06)' }}
                      contentStyle={{ borderRadius: 12, border: '1px solid rgba(225,29,72,0.15)', fontSize: 12 }}
                    />
                    <Bar dataKey="value" fill="#FDBA74" radius={[6, 6, 0, 0]} maxBarSize={40} name="Avg libido" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Your own pattern — libido often rises near ovulation, but yours may differ.
                Yours to discover.
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Log your sex drive for a few days and your phase pattern will show up here.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pain by phase */}
      <Card className="card-soft border-0">
        <CardContent className="p-5">
          <h3 className="font-display text-base font-semibold">Pain &amp; symptoms by phase</h3>
          {painData.hasData ? (
            <>
              {painData.line ? (
                <p className="mt-1 text-sm text-[#9F1239]">{painData.line}</p>
              ) : null}
              <div className="mt-3 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={painData.data} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
                    <XAxis dataKey="phase" tickLine={false} axisLine={false} fontSize={11} stroke="#8A7F78" />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} stroke="#8A7F78" />
                    <Tooltip
                      cursor={{ fill: 'rgba(225,29,72,0.06)' }}
                      contentStyle={{ borderRadius: 12, border: '1px solid rgba(225,29,72,0.15)', fontSize: 12 }}
                    />
                    <Bar dataKey="value" fill="#FB7185" radius={[6, 6, 0, 0]} maxBarSize={40} name="Symptom days" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Days with any logged symptom, grouped by cycle phase.
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Log symptoms like cramps or headaches to see where they cluster.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Flow shape */}
      <Card className="card-soft border-0">
        <CardContent className="p-5">
          <h3 className="font-display text-base font-semibold">Your flow shape</h3>
          {flowData.hasData ? (
            <>
              <div className="mt-3 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={flowData.data} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
                    <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={11} stroke="#8A7F78" />
                    <YAxis domain={[0, 4]} tickCount={5} tickLine={false} axisLine={false} fontSize={11} stroke="#8A7F78" />
                    <Tooltip
                      cursor={{ fill: 'rgba(225,29,72,0.06)' }}
                      contentStyle={{ borderRadius: 12, border: '1px solid rgba(225,29,72,0.15)', fontSize: 12 }}
                      formatter={(v: number) => [FLOW_LABEL[Math.min(4, Math.round(v))], 'Avg flow']}
                    />
                    <Bar dataKey="avg" radius={[6, 6, 0, 0]} maxBarSize={34}>
                      {flowData.data.map((d, i) => (
                        <Cell key={i} fill={FLOW_COLOR[Math.min(4, Math.max(0, d.idx))]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Average flow by cycle day — many people are heavier on days 1–2 and lighter
                after. Your shape is yours.
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Log flow during your period to reveal your typical pattern.
            </p>
          )}
        </CardContent>
      </Card>

      <p className="px-2 pb-2 text-center text-[11px] leading-relaxed text-muted-foreground">
        Estimates only — not medical advice, not contraception. If something feels off,
        talk to a clinician you trust.
      </p>
    </div>
  )
}

'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
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
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  CalendarDays,
  Droplets,
  Flame,
  HeartPulse,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import type {
  AccuracyReport,
  DayEntry,
  PeriodEpisode,
  Phase,
  Regularity,
  SymptomKey,
} from '@/lib/types'
import { SYMPTOM_LABELS } from '@/lib/types'
import type { Prediction } from '@/lib/predictions'
import { addDays } from '@/lib/dates'

interface Props {
  episodes: PeriodEpisode[]
  days: DayEntry[]
  prediction: Prediction
  accuracy: AccuracyReport
  phaseMap: Record<string, Phase>
}

const PHASES: Phase[] = ['menstrual', 'follicular', 'ovulation', 'luteal']
const PHASE_LABEL: Record<Phase, string> = {
  menstrual: 'Period',
  follicular: 'Follicular',
  ovulation: 'Ovulation',
  luteal: 'Luteal',
}

const FLOW_LABEL = ['None', 'Spotting', 'Light', 'Medium', 'Heavy']
const FLOW_VALUE: Record<string, number> = {
  none: 0,
  spotting: 1,
  light: 2,
  medium: 3,
  heavy: 4,
}
const FLOW_COLOR = ['#E5E7EB', '#FDA4AF', '#FB7185', '#E11D48', '#BE123C']

const REG_BADGE: Record<Regularity['label'], { label: string; cls: string }> = {
  Regular: { label: 'Regular rhythm', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
  Varies: { label: 'Varies naturally', cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' },
  Irregular: { label: 'Irregular (ranges shown)', cls: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200' },
}

export function InsightsView({
  episodes,
  days,
  prediction,
  accuracy,
  phaseMap,
}: Props) {
  // 1) Libido by phase
  const libidoData = useMemo(() => {
    const counts: Record<Phase, { sum: number; n: number }> = {
      menstrual: { sum: 0, n: 0 },
      follicular: { sum: 0, n: 0 },
      ovulation: { sum: 0, n: 0 },
      luteal: { sum: 0, n: 0 },
    }
    for (const d of days) {
      if (d.libido === null || d.libido === undefined) continue
      const p = phaseMap[d.date]
      if (!p) continue
      counts[p].sum += d.libido
      counts[p].n += 1
    }
    const data = PHASES.map((p) => ({
      phase: PHASE_LABEL[p],
      value: counts[p].n ? Number((counts[p].sum / counts[p].n).toFixed(2)) : 0,
    }))
    const hasData = PHASES.some((p) => counts[p].n > 0)
    return { data, hasData }
  }, [days, phaseMap])

  // 2) Pain & symptoms by phase
  const painData = useMemo(() => {
    const perPhase: Record<Phase, number> = {
      menstrual: 0,
      follicular: 0,
      ovulation: 0,
      luteal: 0,
    }
    const symptoms: SymptomKey[] = [
      'cramps',
      'headache',
      'back_pain',
      'breast_tenderness',
      'acne',
      'bloating',
      'fatigue',
    ]
    for (const d of days) {
      const p = phaseMap[d.date]
      if (!p) continue
      const hasAny = symptoms.some((s) => (d[s] ?? 0) > 0)
      if (hasAny) perPhase[p] += 1
    }

    const completed = prediction.observations
    const perSymptom = symptoms.map((s) => {
      let hit = 0
      for (const c of completed) {
        const nextStart = c.to
        for (let i = 1; i <= 5; i++) {
          const lutealDay = addDays(nextStart, -i)
          const entry = days.find((x) => x.date === lutealDay)
          if (entry && (entry[s] ?? 0) > 0) {
            hit++
            break
          }
        }
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

  // 3) Flow shape — average flow by cycle day (optimized with O(1) Map lookup)
  const flowData = useMemo(() => {
    const daysByDate = new Map<string, DayEntry>(days.map((x) => [x.date, x]))
    const buckets = new Map<number, { sum: number; n: number }>()

    for (const e of episodes) {
      const end = e.end_date ?? prediction.today
      for (let d = e.start_date, k = 1; d <= end && k <= 10; d = addDays(d, 1), k++) {
        const entry = daysByDate.get(d)
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

  // 4) Cycle trend
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
        name: `#${shown.length - i}`,
        length: o.length,
        flagged: o.status === 'outlier',
      })),
      avgDuration,
      count: shown.length,
    }
  }, [prediction.observations, episodes])

  const regBadge = REG_BADGE[prediction.regularity.label]

  return (
    <div className="space-y-4">
      {/* Accuracy card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="card-soft border-0">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-semibold">Model accuracy</h3>
                {accuracy.evaluated > 0 ? (
                  <div className="mt-1 space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Accuracy: <span className="font-semibold text-foreground">
                        {accuracy.hits}/{accuracy.evaluated}
                      </span>{' '}
                      within ±{accuracy.window} day{accuracy.window > 1 ? 's' : ''}
                      {accuracy.hitsWithin2 != null && accuracy.hitsWithin2 !== accuracy.hits ? (
                        <span> · {accuracy.hitsWithin2}/{accuracy.evaluated} within ±2 days</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground/80">
                      Every forecast is verified against what actually happened.
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    The first accuracy check appears after your next logged period.
                  </p>
                )}
              </div>
              <Badge className={`${regBadge.cls} border-0 shrink-0`}>{regBadge.label}</Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Cycle trend */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
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
                  Dashed line: learned average. Amber bars were flagged as unusual and don&apos;t skew the forecast.
                </p>
              </>
            ) : (
              <EmptyChartState
                icon={TrendingUp}
                title="Building your cycle rhythm"
                description="After two completed period cycles, your rhythm trend and length variations appear here."
              />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Sex drive by phase */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
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
                  Your personal pattern — sex drive often shifts with hormonal peaks, but everyone is unique.
                </p>
              </>
            ) : (
              <EmptyChartState
                icon={Flame}
                title="Discover your hormonal pattern"
                description="Log your energy and libido on a few days to visualize your natural cycle phases."
              />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Pain by phase */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <Card className="card-soft border-0">
          <CardContent className="p-5">
            <h3 className="font-display text-base font-semibold">Pain &amp; symptoms by phase</h3>
            {painData.hasData ? (
              <>
                {painData.line ? (
                  <p className="mt-1 text-sm font-medium text-rose-600 dark:text-rose-400">{painData.line}</p>
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
                  Days with logged cramps, headaches, or tension, grouped by cycle phase.
                </p>
              </>
            ) : (
              <EmptyChartState
                icon={HeartPulse}
                title="Map symptom clusters"
                description="Log physical symptoms like cramps or bloating to see when they cluster in your cycle."
              />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Flow shape */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
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
                  Average flow intensity by period day — your signature bleeding pattern over time.
                </p>
              </>
            ) : (
              <EmptyChartState
                icon={Droplets}
                title="Reveal your flow curve"
                description="Log daily flow during your period to see your typical progression from start to finish."
              />
            )}
          </CardContent>
        </Card>
      </motion.div>

      <p className="px-2 pb-2 text-center text-[11px] leading-relaxed text-muted-foreground">
        Private calculations for you and your partner. Not medical advice.
      </p>
    </div>
  )
}

function EmptyChartState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}) {
  return (
    <div className="my-3 flex flex-col items-center justify-center rounded-xl border border-dashed border-rose-200/60 p-6 text-center dark:border-zinc-800">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 text-primary dark:bg-rose-950/40">
        <Icon className="h-5 w-5" />
      </div>
      <h4 className="mt-2 text-xs font-semibold text-foreground">{title}</h4>
      <p className="mt-1 max-w-[260px] text-[11px] text-muted-foreground">{description}</p>
    </div>
  )
}

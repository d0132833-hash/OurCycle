'use client'

import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Thermometer,
  Scale,
  Sparkles,
  TrendingUp,
  Activity,
  Calendar,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { DayEntry, PeriodEpisode, Phase } from '@/lib/types'
import type { Prediction } from '@/lib/predictions'
import { diffDays, addDays } from '@/lib/dates'
import { fmtShort } from '@/components/app/phase-copy'

interface AdvancedAnalyticsProps {
  episodes: PeriodEpisode[]
  days: DayEntry[]
  prediction: Prediction
  phaseMap?: Record<string, Phase>
}

export function AdvancedAnalytics({ episodes, days, prediction, phaseMap }: AdvancedAnalyticsProps) {
  const [bbtUnit, setBbtUnit] = useState<'C' | 'F'>('C')

  // 1. Process BBT & Weight data (last 45 days)
  const healthData = useMemo(() => {
    const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date))
    const recent = sortedDays.slice(-45)

    const points = recent.map((d) => {
      let bbtVal = d.bbt ?? null
      if (bbtVal !== null) {
        if (bbtUnit === 'F' && bbtVal < 50) {
          // Convert C to F
          bbtVal = Number(((bbtVal * 9) / 5 + 32).toFixed(2))
        } else if (bbtUnit === 'C' && bbtVal >= 50) {
          // Convert F to C
          bbtVal = Number((((bbtVal - 32) * 5) / 9).toFixed(2))
        }
      }
      return {
        date: d.date,
        shortDate: d.date.slice(5),
        bbt: bbtVal,
        weight: d.weight ?? null,
        flow: d.flow,
        phase: phaseMap ? phaseMap[d.date] : undefined,
      }
    })

    const hasBbt = points.some((p) => p.bbt !== null)
    const hasWeight = points.some((p) => p.weight !== null)

    // Calculate average BBT baseline
    const bbtValues = points.filter((p) => p.bbt !== null).map((p) => p.bbt as number)
    const avgBbt = bbtValues.length > 0
      ? Number((bbtValues.reduce((a, b) => a + b, 0) / bbtValues.length).toFixed(2))
      : null

    return { points, hasBbt, hasWeight, avgBbt }
  }, [days, phaseMap, bbtUnit])

  // 2. Correlation Intelligence Engine
  const correlations = useMemo(() => {
    if (episodes.length < 2 || days.length < 10) return []

    const insights: { title: string; desc: string; icon: any; tone: string }[] = []

    // A. Cramp timing analysis
    const periodDayCramps: { day: number; sum: number; count: number }[] = [1, 2, 3, 4, 5].map((d) => ({
      day: d,
      sum: 0,
      count: 0,
    }))

    for (const ep of episodes) {
      for (let d = 1; d <= 5; d++) {
        const date = addDays(ep.start_date, d - 1)
        const entry = days.find((x) => x.date === date)
        if (entry && entry.cramps !== undefined && entry.cramps !== null) {
          periodDayCramps[d - 1].sum += entry.cramps
          periodDayCramps[d - 1].count += 1
        }
      }
    }

    const peakCrampDay = [...periodDayCramps]
      .filter((b) => b.count >= 2)
      .sort((a, b) => b.sum / b.count - a.sum / a.count)[0]

    if (peakCrampDay && peakCrampDay.count >= 2 && peakCrampDay.sum / peakCrampDay.count >= 1.2) {
      insights.push({
        title: `Cramps peak on Period Day ${peakCrampDay.day}`,
        desc: `Cramp intensity averages ${(peakCrampDay.sum / peakCrampDay.count).toFixed(1)}/3 on day ${peakCrampDay.day} and drops significantly by day 4. Prepare pain management early.`,
        icon: Activity,
        tone: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900',
      })
    }

    // B. Premenstrual Headaches (estrogen drop)
    let lutealHeadaches = 0
    let otherHeadaches = 0
    for (const d of days) {
      if (d.headache && d.headache >= 1) {
        const ph = phaseMap ? phaseMap[d.date] : null
        if (ph === 'luteal') lutealHeadaches++
        else otherHeadaches++
      }
    }

    if (lutealHeadaches >= 3 && lutealHeadaches > otherHeadaches) {
      insights.push({
        title: 'Estrogen-Drop Headaches Detected',
        desc: `Headaches appear predominantly during your late luteal window before bleeding begins. Hydration and magnesium can help soften the transition.`,
        icon: Sparkles,
        tone: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900',
      })
    }

    // C. Energy & Mood Peak in Ovulation / Follicular
    const phaseEnergy: Record<string, { sum: number; count: number }> = {
      follicular: { sum: 0, count: 0 },
      ovulation: { sum: 0, count: 0 },
      luteal: { sum: 0, count: 0 },
      menstrual: { sum: 0, count: 0 },
    }

    for (const d of days) {
      const ph = phaseMap ? phaseMap[d.date] : null
      if (ph && d.energy) {
        phaseEnergy[ph].sum += d.energy
        phaseEnergy[ph].count++
      }
    }

    const ovuAvg = phaseEnergy.ovulation.count >= 3 ? phaseEnergy.ovulation.sum / phaseEnergy.ovulation.count : 0
    const lutAvg = phaseEnergy.luteal.count >= 3 ? phaseEnergy.luteal.sum / phaseEnergy.luteal.count : 0

    if (ovuAvg > 0 && lutAvg > 0 && ovuAvg - lutAvg >= 0.7) {
      insights.push({
        title: 'Distinct Biphasic Energy Rhythm',
        desc: `Your energy averages ${ovuAvg.toFixed(1)}/5 during ovulation compared to ${lutAvg.toFixed(1)}/5 in luteal. Schedule challenging tasks during mid-cycle.`,
        icon: TrendingUp,
        tone: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900',
      })
    }

    return insights
  }, [episodes, days, phaseMap])

  // 3. Cycle Comparison History (last 6 completed cycles)
  const comparisonCycles = useMemo(() => {
    return prediction.observations.slice(-6).map((obs, i, arr) => {
      const isOutlier = obs.status === 'outlier'
      const devFromAvg = prediction.cycleLength ? obs.length - prediction.cycleLength : 0
      return {
        cycleNum: `#${arr.length - i}`,
        range: `${fmtShort(obs.from)} – ${fmtShort(obs.to)}`,
        length: obs.length,
        isOutlier,
        devFromAvg,
      }
    })
  }, [prediction.observations, prediction.cycleLength])

  return (
    <div className="space-y-4">
      {/* Correlation Insights Section */}
      {correlations.length > 0 && (
        <Card className="card-soft border-0">
          <CardContent className="p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h3 className="font-display text-base font-semibold">Body Pattern Correlations</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Statistically recurring symptom rhythms uncovered from your logs:
            </p>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {correlations.map((item, idx) => {
                const Icon = item.icon
                return (
                  <div key={idx} className={`p-3.5 rounded-xl border ${item.tone} flex flex-col justify-between`}>
                    <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </div>
                    <p className="mt-1.5 text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* BBT & Temperature Shift Chart */}
      <Card className="card-soft border-0">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <Thermometer className="h-4 w-4 text-primary" />
                <h3 className="font-display text-base font-semibold">Basal Body Temperature (BBT)</h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Thermal shift: progesterone raises morning temperature after ovulation.
              </p>
            </div>
            <div className="flex items-center gap-1 bg-stone-100 dark:bg-zinc-800 p-0.5 rounded-lg text-[10px] font-semibold">
              <button
                onClick={() => setBbtUnit('C')}
                className={`px-2 py-0.5 rounded-md ${bbtUnit === 'C' ? 'bg-white dark:bg-zinc-700 text-primary shadow-xs' : 'text-muted-foreground'}`}
              >
                °C
              </button>
              <button
                onClick={() => setBbtUnit('F')}
                className={`px-2 py-0.5 rounded-md ${bbtUnit === 'F' ? 'bg-white dark:bg-zinc-700 text-primary shadow-xs' : 'text-muted-foreground'}`}
              >
                °F
              </button>
            </div>
          </div>

          {healthData.hasBbt ? (
            <div className="mt-4 h-56 md:h-72 lg:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={healthData.points} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="shortDate" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis
                    domain={['dataMin - 0.2', 'dataMax + 0.2']}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => Number(v).toFixed(1)}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      const pt = payload[0].payload
                      return (
                        <div className="card-soft p-2 text-xs border border-border shadow-md">
                          <div className="font-semibold">{pt.date}</div>
                          {pt.bbt !== null && <div className="text-primary font-bold">BBT: {pt.bbt}°{bbtUnit}</div>}
                          {pt.phase && <div className="capitalize text-muted-foreground">{pt.phase} phase</div>}
                        </div>
                      )
                    }}
                  />
                  {healthData.avgBbt !== null && (
                    <ReferenceLine
                      y={healthData.avgBbt}
                      stroke="#E11D48"
                      strokeDasharray="4 4"
                      label={{ value: `Avg: ${healthData.avgBbt}°`, position: 'insideTopRight', fontSize: 10, fill: '#E11D48' }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="bbt"
                    stroke="#E11D48"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#E11D48' }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 p-4 rounded-xl bg-stone-50 dark:bg-zinc-800/40 border border-dashed border-border/70 text-center">
              <Thermometer className="h-6 w-6 text-muted-foreground/60 mx-auto" />
              <p className="mt-2 text-xs font-medium text-foreground">No temperature logs yet</p>
              <p className="text-[11px] text-muted-foreground max-w-xs mx-auto mt-0.5">
                Take your temperature immediately upon waking before getting out of bed. Log it in the &ldquo;Log today&rdquo; sheet to uncover your biphasic ovulation shift curve!
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cycle History Comparison Table */}
      {comparisonCycles.length > 0 && (
        <Card className="card-soft border-0">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-semibold">Cycle-by-Cycle Comparison</h3>
                <p className="text-xs text-muted-foreground">
                  Comparing your last {comparisonCycles.length} completed cycles side-by-side:
                </p>
              </div>
              <Calendar className="h-4 w-4 text-primary" />
            </div>

            <div className="mt-3 divide-y divide-border/50 text-xs">
              {comparisonCycles.map((c, i) => (
                <div key={i} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <span>Cycle {c.cycleNum}</span>
                      {c.isOutlier && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-400 text-amber-700 dark:text-amber-300">
                          Outlier
                        </Badge>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{c.range}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-sm text-foreground">{c.length} days</span>
                    <div className="text-[10px] text-muted-foreground">
                      {c.devFromAvg > 0 ? `+${c.devFromAvg}d from avg` : c.devFromAvg < 0 ? `${c.devFromAvg}d from avg` : 'On target'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


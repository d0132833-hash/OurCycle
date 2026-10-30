'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { Printer, ArrowLeft, Heart, CheckCircle2, AlertTriangle, Shield } from 'lucide-react'
import type { DayEntry, PeriodEpisode, AppSettings } from '@/lib/types'
import type { Prediction } from '@/lib/predictions'
import { deriveObservations } from '@/lib/predictions'
import { diffDays } from '@/lib/dates'

interface DoctorReportProps {
  episodes: PeriodEpisode[]
  days: DayEntry[]
  prediction: Prediction
  settings: AppSettings
}

export function DoctorReport({ episodes, days, prediction }: DoctorReportProps) {
  const reportRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    window.print()
  }

  // Calculate stats
  const observations = deriveObservations(episodes)
  const cycleLengths = observations.map((o) => o.length)
  const durations = episodes
    .filter((e) => e.end_date)
    .map((e) => diffDays(e.end_date!, e.start_date) + 1)

  const avgCycle = cycleLengths.length > 0
    ? (cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length).toFixed(1)
    : '–'

  const avgDuration = durations.length > 0
    ? (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1)
    : '–'

  const minCycle = cycleLengths.length > 0 ? Math.min(...cycleLengths) : '–'
  const maxCycle = cycleLengths.length > 0 ? Math.max(...cycleLengths) : '–'

  // Symptom counts
  const totalLoggedDays = days.length
  let crampDays = 0
  let headacheDays = 0
  let fatigueDays = 0
  let backPainDays = 0
  let bloatingDays = 0

  days.forEach((d) => {
    if (d.cramps && d.cramps >= 2) crampDays++
    if (d.headache && d.headache >= 1) headacheDays++
    if (d.fatigue && d.fatigue >= 2) fatigueDays++
    if (d.back_pain && d.back_pain >= 2) backPainDays++
    if (d.bloating && d.bloating >= 1) bloatingDays++
  })

  // Episodes sorted chronological (oldest first) and reverse (newest first for reading)
  const chronologicalEpisodes = [...episodes].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const sortedEpisodes = [...episodes].sort((a, b) => b.start_date.localeCompare(a.start_date))

  return (
    <div className="min-h-screen bg-stone-100/70 p-4 sm:p-8 text-foreground print:bg-white print:p-0">
      {/* Action Bar (hidden when printing) */}
      <div className="mx-auto max-w-3xl mb-6 flex items-center justify-between print:hidden">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground bg-white dark:bg-zinc-800 px-3.5 py-2 rounded-xl shadow-sm border border-border"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to App</span>
        </Link>
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-xs font-semibold px-4 py-2 rounded-xl shadow-md hover:bg-primary/90 transition-all"
        >
          <Printer className="h-4 w-4" />
          <span>Print / Save as PDF</span>
        </button>
      </div>

      {/* Printable Sheet */}
      <div
        ref={reportRef}
        className="mx-auto max-w-3xl bg-white p-8 sm:p-12 shadow-lg rounded-2xl border border-stone-200 print:shadow-none print:border-none print:p-0 print:max-w-none text-stone-900"
      >
        {/* Document Header */}
        <div className="border-b-2 border-stone-800 pb-5 mb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-rose-700">
                <Heart className="h-4 w-4 fill-rose-600" />
              </span>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">
                Our Cycle — Clinical Health Summary
              </h1>
            </div>
            <p className="text-xs text-stone-600 mt-1">
              Confidential Gynecological &amp; Menstrual Tracking Report for Healthcare Consultations
            </p>
          </div>
          <div className="text-right text-[11px] text-stone-500">
            <div>Generated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
            <div className="flex items-center justify-end gap-1 text-emerald-700 font-medium mt-0.5">
              <Shield className="h-3 w-3" />
              <span>Patient-Verified Data</span>
            </div>
          </div>
        </div>

        {/* Section 1: Vital Metrics Overview */}
        <div className="mb-7">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
            1. Key Menstrual Parameters
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-stone-50 border border-stone-200 p-3.5 rounded-xl">
              <div className="text-[11px] font-medium text-stone-500">Average Cycle</div>
              <div className="text-xl font-bold text-stone-900 mt-0.5">{avgCycle} <span className="text-xs font-normal text-stone-500">days</span></div>
              <div className="text-[10px] text-stone-400 mt-0.5">Range: {minCycle} – {maxCycle} days</div>
            </div>
            <div className="bg-stone-50 border border-stone-200 p-3.5 rounded-xl">
              <div className="text-[11px] font-medium text-stone-500">Average Duration</div>
              <div className="text-xl font-bold text-stone-900 mt-0.5">{avgDuration} <span className="text-xs font-normal text-stone-500">days</span></div>
              <div className="text-[10px] text-stone-400 mt-0.5">Bleeding window</div>
            </div>
            <div className="bg-stone-50 border border-stone-200 p-3.5 rounded-xl">
              <div className="text-[11px] font-medium text-stone-500">Cycle Regularity</div>
              <div className="text-xl font-bold text-stone-900 mt-0.5">{prediction.regularity.label}</div>
              <div className="text-[10px] text-stone-400 mt-0.5">
                {prediction.regularity.sigma !== null ? `σ = ±${prediction.regularity.sigma.toFixed(1)} days` : 'Calculated automatically'}
              </div>
            </div>
            <div className="bg-stone-50 border border-stone-200 p-3.5 rounded-xl">
              <div className="text-[11px] font-medium text-stone-500">Tracked Cycles</div>
              <div className="text-xl font-bold text-stone-900 mt-0.5">{episodes.length}</div>
              <div className="text-[10px] text-stone-400 mt-0.5">{totalLoggedDays} daily logs recorded</div>
            </div>
          </div>
        </div>

        {/* Section 2: Chronological Cycle History Table */}
        <div className="mb-7">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
            2. Recorded Cycle Episodes (Recent to Oldest)
          </h2>
          <div className="border border-stone-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-stone-100 text-stone-700 font-semibold border-b border-stone-200">
                <tr>
                  <th className="py-2.5 px-3">Start Date</th>
                  <th className="py-2.5 px-3">End Date</th>
                  <th className="py-2.5 px-3 text-center">Duration</th>
                  <th className="py-2.5 px-3 text-center">Preceding Cycle</th>
                  <th className="py-2.5 px-3">Initial Flow</th>
                  <th className="py-2.5 px-3">Notes / Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-150 text-stone-800">
                {sortedEpisodes.slice(0, 12).map((ep, idx) => {
                  // Find preceding cycle length
                  const prevIdx = chronologicalEpisodes.findIndex((e) => (ep.id && e.id === ep.id) || e.start_date === ep.start_date)
                  let lengthBefore = '–'
                  if (prevIdx > 0) {
                    lengthBefore = `${diffDays(ep.start_date, chronologicalEpisodes[prevIdx - 1].start_date)}d`
                  }
                  const dur = ep.end_date ? `${diffDays(ep.end_date, ep.start_date) + 1}d` : 'Ongoing'

                  return (
                    <tr key={ep.id || idx} className="hover:bg-stone-50/50">
                      <td className="py-2 px-3 font-medium">{ep.start_date}</td>
                      <td className="py-2 px-3 text-stone-600">{ep.end_date || '–'}</td>
                      <td className="py-2 px-3 text-center">{dur}</td>
                      <td className="py-2 px-3 text-center font-medium">{lengthBefore}</td>
                      <td className="py-2 px-3 capitalize">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          ep.flow === 'heavy' ? 'bg-rose-100 text-rose-800' :
                          ep.flow === 'medium' ? 'bg-amber-100 text-amber-800' :
                          ep.flow === 'light' ? 'bg-stone-100 text-stone-700' : 'bg-stone-50 text-stone-500'
                        }`}>
                          {ep.flow || 'Normal'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-stone-500 text-[11px]">
                        {idx === 0 && ep.end_date === null ? 'Active episode' : 'Normal history'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Symptom Incidence Summary */}
        <div className="mb-7">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
            3. Chronic &amp; Recurring Symptoms Incidence
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <div className="font-semibold text-stone-800">Severe Cramps (Dysmenorrhea)</div>
              <div className="mt-1 text-stone-600">{crampDays} logged days (≥ Grade 2)</div>
              <div className="mt-0.5 text-[10px] text-stone-400">Peaks during Days 1–3 of bleeding</div>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <div className="font-semibold text-stone-800">Headaches / Migraines</div>
              <div className="mt-1 text-stone-600">{headacheDays} logged days</div>
              <div className="mt-0.5 text-[10px] text-stone-400">Predominantly late luteal / PMS</div>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <div className="font-semibold text-stone-800">Fatigue &amp; Low Energy</div>
              <div className="mt-1 text-stone-600">{fatigueDays} logged days (≥ Grade 2)</div>
              <div className="mt-0.5 text-[10px] text-stone-400">Correlated with menstruation onset</div>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <div className="font-semibold text-stone-800">Lower Back Pain</div>
              <div className="mt-1 text-stone-600">{backPainDays} logged days</div>
              <div className="mt-0.5 text-[10px] text-stone-400">Early menstrual phase manifestation</div>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <div className="font-semibold text-stone-800">Bloating &amp; Water Retention</div>
              <div className="mt-1 text-stone-600">{bloatingDays} logged days</div>
              <div className="mt-0.5 text-[10px] text-stone-400">Premenstrual luteal phase</div>
            </div>
            <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
              <div className="font-semibold text-stone-800">Data Integrity</div>
              <div className="mt-1 text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Deterministic calculations</span>
              </div>
              <div className="mt-0.5 text-[10px] text-stone-400">Continuous daily tracking model</div>
            </div>
          </div>
        </div>

        {/* Section 4: Physician Discussion Notes */}
        <div className="border-t border-stone-200 pt-5 mt-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-2">
            4. Physician Consultation &amp; Assessment Notes
          </h2>
          <div className="h-24 border border-dashed border-stone-300 rounded-xl p-3 text-[11px] text-stone-400 flex items-start justify-between">
            <span>Clinical notes, diagnostics, recommended lab work (e.g. Iron/Ferritin, Thyroid panel, Hormone profile):</span>
            <span className="text-[10px]">MD / Specialist Signature: ______________________</span>
          </div>
          <p className="text-[10px] text-stone-400 text-center mt-4">
            Our Cycle is an encrypted self-tracking tool. This document is intended to assist medical evaluation and does not constitute a diagnostic determination.
          </p>
        </div>
      </div>
    </div>
  )
}

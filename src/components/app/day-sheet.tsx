'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Sparkles, Plus, Minus, Moon, Droplet, Droplets } from 'lucide-react'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  DAY_FLOWS,
  SYMPTOM_KEYS,
  SYMPTOM_LABELS,
  type DayEntry,
} from '@/lib/types'
import { saveWithOfflineFallback } from '@/lib/client/offline-queue'
import { addDays } from '@/lib/dates'
import { fmtShort } from './phase-copy'

const FLOW_LABEL: Record<string, string> = {
  none: 'None',
  spotting: 'Spotting',
  light: 'Light',
  medium: 'Medium',
  heavy: 'Heavy',
}

const MOOD_EMOJI = ['😞', '😕', '😐', '🙂', '😄']
const ENERGY_EMOJI = ['😴', '🥱', '😐', '😊', '⚡']
const LIBIDO_EMOJI = ['🌙', '😶', '🙂', '😉', '🔥']
const INTENSITY = ['–', '·', '··', '···']
const INTENSITY_LABEL = ['None', 'Mild', 'Moderate', 'Strong']

const QUICK_TAGS = [
  '#heatingpad',
  '#painkiller',
  '#tea',
  '#walk',
  '#yoga',
  '#magnesium',
  '#stress',
  '#travel',
]

function triggerHaptic() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(10)
    } catch {}
  }
}

export interface DayDraft {
  flow: string | null
  mood: number | null
  energy: number | null
  libido: number | null
  cramps: number | null
  headache: number | null
  back_pain: number | null
  breast_tenderness: number | null
  acne: number | null
  bloating: number | null
  fatigue: number | null
  bbt: string
  weight: string
  sleep_hours: string
  water_glasses: number | null
  note: string
}

const EMPTY: DayDraft = {
  flow: null,
  mood: null,
  energy: null,
  libido: null,
  cramps: null,
  headache: null,
  back_pain: null,
  breast_tenderness: null,
  acne: null,
  bloating: null,
  fatigue: null,
  bbt: '',
  weight: '',
  sleep_hours: '',
  water_glasses: null,
  note: '',
}

function fromEntry(e: DayEntry | null): DayDraft {
  if (!e) return { ...EMPTY }
  return {
    flow: e.flow ?? null,
    mood: e.mood ?? null,
    energy: e.energy ?? null,
    libido: e.libido ?? null,
    cramps: e.cramps ?? null,
    headache: e.headache ?? null,
    back_pain: e.back_pain ?? null,
    breast_tenderness: e.breast_tenderness ?? null,
    acne: e.acne ?? null,
    bloating: e.bloating ?? null,
    fatigue: e.fatigue ?? null,
    bbt: e.bbt != null ? String(e.bbt) : '',
    weight: e.weight != null ? String(e.weight) : '',
    sleep_hours: e.sleep_hours != null ? String(e.sleep_hours) : '',
    water_glasses: e.water_glasses ?? null,
    note: e.note ?? '',
  }
}

interface Props {
  date: string | null
  entry: DayEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
  periodLength?: number
  onSaved?: (
    date: string,
    flow: string | null,
    isPeriodStart: boolean,
    periodLength: number,
    draft: DayDraft,
  ) => void
  onCleared?: (date: string) => void
}

export function DaySheet({
  date,
  entry,
  open,
  onOpenChange,
  periodLength = 5,
  onSaved,
  onCleared,
}: Props) {
  const router = useRouter()
  const [draft, setDraft] = useState<DayDraft>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [isPeriodStart, setIsPeriodStart] = useState(false)
  const [periodLen, setPeriodLen] = useState(periodLength)

  useEffect(() => {
    if (open) {
      setDraft(fromEntry(entry))
      setPeriodLen(periodLength)
      const hasBleeding =
        entry?.flow === 'light' || entry?.flow === 'medium' || entry?.flow === 'heavy'
      setIsPeriodStart(hasBleeding)
    }
  }, [open, entry, periodLength])

  const set = <K extends keyof DayDraft>(k: K, v: DayDraft[K]) => {
    triggerHaptic()
    setDraft((d) => ({ ...d, [k]: v }))
  }

  const handleFlowSelect = (f: string) => {
    triggerHaptic()
    if (draft.flow === f) {
      set('flow', null)
      setIsPeriodStart(false)
    } else {
      set('flow', f)
      if (f === 'light' || f === 'medium' || f === 'heavy') {
        setIsPeriodStart(true)
      } else {
        setIsPeriodStart(false)
      }
    }
  }

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(fromEntry(entry)),
    [draft, entry],
  )

  // Quick Preset Handlers
  const applyPreset = (preset: 'high-energy' | 'cramp-rest' | 'pms-comfort' | 'gentle-reset') => {
    triggerHaptic()
    if (preset === 'high-energy') {
      setDraft((d) => ({
        ...d,
        mood: 5,
        energy: 5,
        libido: 4,
        note: d.note.includes('#workout') ? d.note : `${d.note} #workout`.trim(),
      }))
      toast.success('Applied "High Energy" preset')
    } else if (preset === 'cramp-rest') {
      setDraft((d) => ({
        ...d,
        cramps: 2,
        fatigue: 2,
        mood: 2,
        energy: 1,
        note: d.note.includes('#heatingpad') ? d.note : `${d.note} #heatingpad`.trim(),
      }))
      toast.success('Applied "Cramps & Rest" preset')
    } else if (preset === 'pms-comfort') {
      setDraft((d) => ({
        ...d,
        bloating: 2,
        breast_tenderness: 1,
        mood: 2,
        energy: 2,
        note: d.note.includes('#tea') ? d.note : `${d.note} #tea`.trim(),
      }))
      toast.success('Applied "PMS Comfort" preset')
    } else if (preset === 'gentle-reset') {
      setDraft((d) => ({
        ...d,
        mood: 4,
        energy: 3,
        note: d.note.includes('#yoga') ? d.note : `${d.note} #yoga`.trim(),
      }))
      toast.success('Applied "Gentle Reset" preset')
    }
  }

  // Toggle quick tag in journal note
  const toggleTag = (tag: string) => {
    triggerHaptic()
    setDraft((d) => {
      const current = d.note
      if (current.includes(tag)) {
        return { ...d, note: current.replace(tag, '').replace(/\s+/g, ' ').trim() }
      } else {
        return { ...d, note: `${current} ${tag}`.trim() }
      }
    })
  }

  async function save() {
    if (!date || saving) return
    setSaving(true)
    triggerHaptic()
    try {
      const payload: Record<string, unknown> = {
        date,
        flow: draft.flow,
        mood: draft.mood,
        energy: draft.energy,
        libido: draft.libido,
      }
      for (const k of SYMPTOM_KEYS) {
        payload[k] = draft[k]
      }

      if (draft.bbt.trim() !== '') {
        const num = parseFloat(draft.bbt)
        if (isNaN(num) || num < 30 || num > 110) {
          toast.error('BBT temperature should be between 30 and 110')
          setSaving(false)
          return
        }
        payload.bbt = num
      } else {
        payload.bbt = null
      }

      if (draft.weight.trim() !== '') {
        const num = parseFloat(draft.weight)
        if (isNaN(num) || num < 20 || num > 300) {
          toast.error('Weight should be between 20 and 300')
          setSaving(false)
          return
        }
        payload.weight = num
      } else {
        payload.weight = null
      }

      if (draft.sleep_hours.trim() !== '') {
        const num = parseFloat(draft.sleep_hours)
        if (isNaN(num) || num < 0 || num > 24) {
          toast.error('Sleep hours should be between 0 and 24')
          setSaving(false)
          return
        }
        payload.sleep_hours = num
      } else {
        payload.sleep_hours = null
      }

      payload.water_glasses = draft.water_glasses
      payload.note = draft.note.trim() !== '' ? draft.note.trim() : null
      payload.is_period_start = isPeriodStart
      if (isPeriodStart) {
        payload.period_length = periodLen
      }

      const where = await saveWithOfflineFallback('day', payload)
      onSaved?.(date, draft.flow, isPeriodStart, periodLen, draft)

      toast.success(
        where === 'queued'
          ? 'Saved offline — syncs automatically'
          : isPeriodStart
            ? `Period started (${periodLen} days auto-logged)`
            : 'Day saved',
      )
      onOpenChange(false)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  async function clear() {
    if (!date) return
    setSaving(true)
    triggerHaptic()
    try {
      const res = await fetch(`/api/days?date=${date}`, { method: 'DELETE' })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      onCleared?.(date)
      toast.success('Entry and period cleared')
      onOpenChange(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto w-full max-w-lg md:max-w-2xl max-h-[92dvh] flex flex-col md:rounded-t-3xl shadow-2xl border-t border-border/80">
        <DrawerHeader className="shrink-0 pb-2">
          <DrawerTitle className="font-display text-xl sm:text-2xl flex items-center justify-between">
            <span>{date ? fmtShort(date) : 'Log day'}</span>
            {entry ? (
              <span className="text-xs font-normal px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                Editing Entry
              </span>
            ) : null}
          </DrawerTitle>
          <DrawerDescription>Everything is private — only your vault can see this.</DrawerDescription>
        </DrawerHeader>

        <div className="nice-scroll flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-5">
          {/* Quick 1-Tap Presets */}
          <section className="bg-rose-50/50 dark:bg-zinc-800/40 p-3.5 rounded-2xl border border-rose-100 dark:border-rose-950/40">
            <div className="flex items-center gap-1.5 mb-2.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span>1-Tap Quick Presets</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('high-energy')}
                className="py-2 px-2.5 rounded-xl text-left bg-white dark:bg-zinc-800 text-[11px] font-medium border border-border shadow-2xs hover:border-primary/40 active:scale-95 transition-all"
              >
                ⚡ High Energy
              </button>
              <button
                type="button"
                onClick={() => applyPreset('cramp-rest')}
                className="py-2 px-2.5 rounded-xl text-left bg-white dark:bg-zinc-800 text-[11px] font-medium border border-border shadow-2xs hover:border-primary/40 active:scale-95 transition-all"
              >
                🛌 Cramp &amp; Rest
              </button>
              <button
                type="button"
                onClick={() => applyPreset('pms-comfort')}
                className="py-2 px-2.5 rounded-xl text-left bg-white dark:bg-zinc-800 text-[11px] font-medium border border-border shadow-2xs hover:border-primary/40 active:scale-95 transition-all"
              >
                🌙 PMS Comfort
              </button>
              <button
                type="button"
                onClick={() => applyPreset('gentle-reset')}
                className="py-2 px-2.5 rounded-xl text-left bg-white dark:bg-zinc-800 text-[11px] font-medium border border-border shadow-2xs hover:border-primary/40 active:scale-95 transition-all"
              >
                🧘 Gentle Reset
              </button>
            </div>
          </section>

          {/* Flow */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground">Flow</h3>
            <div className="flex flex-wrap gap-2">
              {DAY_FLOWS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => handleFlowSelect(f)}
                  className={`chip ${draft.flow === f ? 'chip-selected' : ''}`}
                >
                  {FLOW_LABEL[f]}
                </button>
              ))}
            </div>

            {/* Period Start & Auto-log Banner */}
            {(draft.flow === 'light' || draft.flow === 'medium' || draft.flow === 'heavy') && date && (
              <div className="rounded-2xl border border-primary/25 bg-gradient-to-br from-rose-50/70 to-pink-50/40 dark:from-rose-950/30 dark:to-pink-950/10 p-3.5 space-y-2.5 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-primary fill-primary/30" />
                    <div>
                      <span className="text-sm font-semibold text-foreground block">
                        Period start date
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Auto-logs following days
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPeriodStart}
                      onChange={(e) => {
                        triggerHaptic()
                        setIsPeriodStart(e.target.checked)
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-stone-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary shadow-inner"></div>
                  </label>
                </div>

                {isPeriodStart && (
                  <div className="pt-2 border-t border-primary/15 space-y-2">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Automatically logs <strong className="text-primary font-semibold">{periodLen} days</strong> ({fmtShort(date)} to {fmtShort(addDays(date, periodLen - 1))}) according to period cycle length.
                    </p>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-medium text-foreground">
                        Period cycle length:
                      </span>
                      <div className="flex items-center gap-2 bg-white/80 dark:bg-zinc-800/80 px-2 py-1 rounded-xl border border-primary/20 shadow-2xs">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-lg text-primary hover:bg-primary/10"
                          onClick={() => {
                            triggerHaptic()
                            setPeriodLen((l) => Math.max(1, l - 1))
                          }}
                          disabled={periodLen <= 1}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="text-xs font-bold w-6 text-center text-foreground">
                          {periodLen}d
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-lg text-primary hover:bg-primary/10"
                          onClick={() => {
                            triggerHaptic()
                            setPeriodLen((l) => Math.min(14, l + 1))
                          }}
                          disabled={periodLen >= 14}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Scales: mood, energy, libido */}
          <section className="space-y-3">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-semibold text-muted-foreground">Mood</span>
                <span className="text-xs text-muted-foreground">
                  {draft.mood ? `${draft.mood}/5` : 'Not set'}
                </span>
              </div>
              <Scale emojis={MOOD_EMOJI} value={draft.mood} onChange={(v) => set('mood', v)} />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-semibold text-muted-foreground">Energy</span>
                <span className="text-xs text-muted-foreground">
                  {draft.energy ? `${draft.energy}/5` : 'Not set'}
                </span>
              </div>
              <Scale
                emojis={ENERGY_EMOJI}
                value={draft.energy}
                onChange={(v) => set('energy', v)}
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-semibold text-muted-foreground">Sex drive</span>
                <span className="text-xs text-muted-foreground">
                  {draft.libido ? `${draft.libido}/5` : 'Not set'}
                </span>
              </div>
              <Scale
                emojis={LIBIDO_EMOJI}
                value={draft.libido}
                onChange={(v) => set('libido', v)}
              />
            </div>
          </section>

          {/* Symptoms grid: 0 (none) -> 3 (strong) */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Symptoms</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {SYMPTOM_KEYS.map((k) => {
                const val = draft[k] ?? 0
                return (
                  <div
                    key={k}
                    className="flex items-center justify-between rounded-xl border border-[rgba(225,29,72,0.14)] bg-white/65 p-2.5 text-xs dark:bg-zinc-800/60 dark:border-zinc-700"
                  >
                    <span className="truncate pr-1 font-medium">{SYMPTOM_LABELS[k]}</span>
                    <div className="flex gap-1 shrink-0">
                      {[0, 1, 2, 3].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => set(k, lvl === val ? null : lvl)}
                          className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                            val === lvl && lvl > 0
                              ? 'bg-primary text-primary-foreground shadow-xs'
                              : val === lvl && lvl === 0
                              ? 'bg-stone-200 text-stone-700 dark:bg-zinc-700 dark:text-zinc-200'
                              : 'bg-stone-100 text-muted-foreground hover:bg-stone-200/70 dark:bg-zinc-900/60'
                          }`}
                          aria-label={`${SYMPTOM_LABELS[k]}: ${INTENSITY_LABEL[lvl]}`}
                        >
                          {INTENSITY[lvl]}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Lifestyle: Sleep & Hydration */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Sleep &amp; Hydration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="rounded-xl border border-[rgba(225,29,72,0.16)] bg-white/70 p-3 dark:bg-zinc-900/60">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
                  <Moon className="h-3.5 w-3.5 text-indigo-500" />
                  <span>Sleep (hours)</span>
                </div>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  placeholder="e.g. 7.5"
                  value={draft.sleep_hours}
                  onChange={(e) => set('sleep_hours', e.target.value)}
                  className="h-9 rounded-lg text-xs border-0 bg-stone-100 dark:bg-zinc-800"
                />
              </div>

              <div className="rounded-xl border border-[rgba(225,29,72,0.16)] bg-white/70 p-3 dark:bg-zinc-900/60">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
                  <Droplet className="h-3.5 w-3.5 text-sky-500" />
                  <span>Water (glasses)</span>
                </div>
                <div className="flex items-center justify-between bg-stone-100 dark:bg-zinc-800 rounded-lg p-1 h-9">
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic()
                      set('water_glasses', Math.max(0, (draft.water_glasses || 0) - 1))
                    }}
                    className="h-7 w-7 rounded-md bg-white dark:bg-zinc-700 flex items-center justify-center text-xs shadow-xs"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="text-xs font-bold">{draft.water_glasses || 0}</span>
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic()
                      set('water_glasses', (draft.water_glasses || 0) + 1)
                    }}
                    className="h-7 w-7 rounded-md bg-white dark:bg-zinc-700 flex items-center justify-center text-xs shadow-xs"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Temperature & weight */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                BBT temp (°C / °F)
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="e.g. 36.4"
                value={draft.bbt}
                onChange={(e) => set('bbt', e.target.value)}
                className="rounded-xl border-[rgba(225,29,72,0.16)] bg-white/70 text-sm dark:bg-zinc-900/60"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                Weight (kg / lbs)
              </label>
              <Input
                type="number"
                step="0.1"
                placeholder="e.g. 62.5"
                value={draft.weight}
                onChange={(e) => set('weight', e.target.value)}
                className="rounded-xl border-[rgba(225,29,72,0.16)] bg-white/70 text-sm dark:bg-zinc-900/60"
              />
            </div>
          </section>

          {/* Quick Tags */}
          <section>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="text-sm font-semibold text-muted-foreground">Quick Tags</h3>
              <span className="text-[10px] text-muted-foreground">Tap to add to note</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TAGS.map((tag) => {
                const active = draft.note.includes(tag)
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      active
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-white/80 dark:bg-zinc-800 border-border text-stone-700 dark:text-stone-300 hover:border-primary/40'
                    }`}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Journal */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Journal note</h3>
            <Textarea
              value={draft.note}
              onChange={(e) => set('note', e.target.value)}
              placeholder="Anything you want to remember about today…"
              className="min-h-20 rounded-xl border-[rgba(225,29,72,0.16)] bg-white/70 dark:bg-zinc-900/60"
              maxLength={4000}
            />
          </section>
        </div>

        <div className="safe-bottom shrink-0 flex items-center gap-2 border-t border-border/60 px-4 py-3 bg-background z-10">
          {entry ? (
            <Button
              variant="ghost"
              onClick={clear}
              disabled={saving}
              className="text-muted-foreground hover:text-rose-600"
            >
              Clear
            </Button>
          ) : null}
          <Button
            onClick={save}
            disabled={saving || !dirty}
            className="ml-auto h-11 flex-1 rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-md transition-transform active:scale-95 disabled:opacity-50"
          >
            {saving ? 'Saving…' : entry ? 'Update entry' : 'Save day'}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function Scale({
  emojis,
  value,
  onChange,
}: {
  emojis: string[]
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <div className="flex gap-2">
      {emojis.map((e, i) => {
        const v = i + 1
        const selected = value === v
        return (
          <button
            key={v}
            type="button"
            aria-label={`Rating ${v} of 5`}
            onClick={() => {
              triggerHaptic()
              onChange(selected ? null : v)
            }}
            className={`flex h-12 flex-1 items-center justify-center rounded-xl border text-xl transition-all ${
              selected
                ? 'border-transparent bg-primary/10 shadow-[inset_0_0_0_2px_#E11D48]'
                : 'border-[rgba(225,29,72,0.14)] bg-white/65 dark:bg-zinc-800/60 dark:border-zinc-700'
            }`}
          >
            {e}
          </button>
        )
      })}
    </div>
  )
}

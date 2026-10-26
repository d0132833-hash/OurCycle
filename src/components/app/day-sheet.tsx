'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DAY_FLOWS,
  SYMPTOM_KEYS,
  SYMPTOM_LABELS,
  type DayEntry,
} from '@/lib/types'
import { saveWithOfflineFallback } from '@/lib/client/offline-queue'
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
    note: e.note ?? '',
  }
}

interface Props {
  date: string | null
  entry: DayEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DaySheet({ date, entry, open, onOpenChange }: Props) {
  const router = useRouter()
  const [draft, setDraft] = useState<DayDraft>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setDraft(fromEntry(entry))
  }, [open, entry])

  const set = <K extends keyof DayDraft>(k: K, v: DayDraft[K]) => {
    triggerHaptic()
    setDraft((d) => ({ ...d, [k]: v }))
  }

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(fromEntry(entry)),
    [draft, entry],
  )

  async function save() {
    if (!date || saving) return
    setSaving(true)
    triggerHaptic()
    try {
      const payload: Record<string, unknown> = { date }
      if (draft.flow !== null) payload.flow = draft.flow
      for (const k of ['mood', 'energy', 'libido'] as const) if (draft[k] !== null) payload[k] = draft[k]
      for (const k of SYMPTOM_KEYS) if (draft[k] !== null) payload[k] = draft[k]
      if (draft.bbt.trim() !== '') {
        const num = parseFloat(draft.bbt)
        if (!isNaN(num)) payload.bbt = num
      }
      if (draft.weight.trim() !== '') {
        const num = parseFloat(draft.weight)
        if (!isNaN(num)) payload.weight = num
      }
      if (draft.note.trim() !== '') payload.note = draft.note.trim()

      const where = await saveWithOfflineFallback('day', payload)
      toast.success(
        where === 'queued' ? 'Saved offline — syncs automatically' : 'Day saved',
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
      toast.success('Entry cleared')
      onOpenChange(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="font-display text-xl">
            {date ? fmtShort(date) : 'Log day'}
          </DrawerTitle>
          <DrawerDescription>Everything is private — only your vault can see this.</DrawerDescription>
        </DrawerHeader>

        <ScrollArea className="nice-scroll max-h-[min(650px,78dvh)] px-4 pb-2">
          <div className="space-y-5 pb-4">
            {/* Flow */}
            <section>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Flow</h3>
              <div className="flex flex-wrap gap-2">
                {DAY_FLOWS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => set('flow', draft.flow === f ? null : f)}
                    className={`chip ${draft.flow === f ? 'chip-selected' : ''}`}
                  >
                    {FLOW_LABEL[f]}
                  </button>
                ))}
              </div>
            </section>

            {/* Mood / Energy / Libido */}
            <section>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Mood</h3>
              <Scale emojis={MOOD_EMOJI} value={draft.mood} onChange={(v) => set('mood', v)} />
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Energy</h3>
              <Scale emojis={ENERGY_EMOJI} value={draft.energy} onChange={(v) => set('energy', v)} />
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Sex drive</h3>
              <Scale emojis={LIBIDO_EMOJI} value={draft.libido} onChange={(v) => set('libido', v)} />
            </section>

            {/* Symptoms */}
            <section>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                Pain &amp; symptoms
              </h3>
              <div className="space-y-2.5">
                {SYMPTOM_KEYS.map((s) => (
                  <div key={s} className="flex items-center justify-between gap-3">
                    <span className="w-36 shrink-0 text-sm">{SYMPTOM_LABELS[s]}</span>
                    <div className="flex gap-1.5">
                      {[0, 1, 2, 3].map((lvl) => {
                        const selected = (draft[s] ?? 0) === lvl && draft[s] !== null
                        return (
                          <button
                            key={lvl}
                            type="button"
                            aria-label={`${SYMPTOM_LABELS[s]}: ${INTENSITY_LABEL[lvl]}`}
                            onClick={() => set(s, lvl === 0 ? null : lvl)}
                            className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs transition-colors ${
                              selected
                                ? 'border-transparent bg-primary text-primary-foreground shadow-sm'
                                : 'border-[rgba(225,29,72,0.16)] bg-white/65 text-muted-foreground dark:bg-zinc-800/60 dark:border-zinc-700'
                            }`}
                          >
                            {INTENSITY[lvl]}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Optional BBT & Weight */}
            <section className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Body Temp (°C/°F)
                </label>
                <Input
                  type="number"
                  step="0.05"
                  placeholder="e.g. 36.6 or 97.8"
                  value={draft.bbt}
                  onChange={(e) => set('bbt', e.target.value)}
                  className="rounded-xl border-[rgba(225,29,72,0.16)] bg-white/70 text-sm dark:bg-zinc-900/60"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                  Weight (kg/lbs)
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
        </ScrollArea>

        <div className="safe-bottom flex items-center gap-2 border-t border-border/60 px-4 py-3">
          {entry ? (
            <Button
              variant="ghost"
              onClick={clear}
              disabled={saving}
              className="text-muted-foreground"
            >
              Clear
            </Button>
          ) : null}
          <Button
            onClick={save}
            disabled={saving || !dirty}
            className="ml-auto h-11 flex-1 rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-md transition-transform active:scale-95"
          >
            {saving ? 'Saving…' : 'Save day'}
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

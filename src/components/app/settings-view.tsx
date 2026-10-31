'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Download,
  FileJson,
  FileSpreadsheet,
  Moon,
  Pencil,
  Sun,
  Trash2,
  Monitor,
  AlertTriangle,
  Plus,
  Calendar,
  FileText,
} from 'lucide-react'
import type { AppSettings, PeriodEpisode } from '@/lib/types'
import { RotateForm } from './vault-forms'

const TIMEZONES = [
  'Asia/Calcutta',
  'Asia/Karachi',
  'Asia/Dhaka',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
]

interface Props {
  settings: AppSettings
  autoCycleLength: number | null
  sigma: number | null
  initialPeriods?: PeriodEpisode[]
}

export function SettingsView({
  settings,
  autoCycleLength,
  sigma,
  initialPeriods = [],
}: Props) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  const activeTheme = mounted ? theme : undefined

  const [overrideOn, setOverrideOn] = useState(settings.cycle_length_override !== null)
  const [overrideLen, setOverrideLen] = useState(settings.cycle_length_override ?? 28)
  const [tz, setTz] = useState(settings.timezone)
  const [savingCycle, setSavingCycle] = useState(false)
  const [savingTz, setSavingTz] = useState(false)
  const [palette, setPalette] = useState('rose')
  const [discreet, setDiscreet] = useState(false)

  useEffect(() => {
    try {
      const pal = localStorage.getItem('ourcycle.palette') || 'rose'
      setPalette(pal)
      const d = localStorage.getItem('ourcycle.discreet') === 'true'
      setDiscreet(d)
    } catch {}
  }, [])

  const updatePalette = (newPal: string) => {
    setPalette(newPal)
    try {
      localStorage.setItem('ourcycle.palette', newPal)
      document.documentElement.setAttribute('data-palette', newPal)
      window.dispatchEvent(new CustomEvent('ourcycle:theme-change'))
      toast.success(`Theme palette set to ${newPal.charAt(0).toUpperCase() + newPal.slice(1)}`)
    } catch {}
  }

  const updateDiscreet = (val: boolean) => {
    setDiscreet(val)
    try {
      localStorage.setItem('ourcycle.discreet', String(val))
      window.dispatchEvent(new CustomEvent('ourcycle:theme-change'))
      toast.success(val ? 'Discreet disguise mode enabled' : 'Discreet mode disabled')
    } catch {}
  }

  // Period history editing state
  const [periods, setPeriods] = useState<PeriodEpisode[]>(initialPeriods)
  const [editingPeriod, setEditingPeriod] = useState<PeriodEpisode | null>(null)
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editFlow, setEditFlow] = useState<string>('medium')
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetPin, setResetPin] = useState('')
  const [resetting, setResetting] = useState(false)

  // Add period state
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addStartDate, setAddStartDate] = useState('')
  const [addEndDate, setAddEndDate] = useState('')
  const [addFlow, setAddFlow] = useState<string>('medium')
  const [savingAdd, setSavingAdd] = useState(false)

  async function saveNewPeriod() {
    if (!addStartDate) {
      toast.error('Start date is required')
      return
    }
    if (addEndDate && addEndDate < addStartDate) {
      toast.error('End date cannot be before start date')
      return
    }
    setSavingAdd(true)
    try {
      const res = await fetch('/api/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: addStartDate,
          end_date: addEndDate || null,
          flow: addFlow || 'medium',
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Could not add period')
      }
      const data = await res.json()
      setPeriods((prev) =>
        [...prev, data.period].sort((a, b) => a.start_date.localeCompare(b.start_date)),
      )
      setAddModalOpen(false)
      setAddStartDate('')
      setAddEndDate('')
      toast.success('Period added — predictions updated')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error adding period')
    } finally {
      setSavingAdd(false)
    }
  }

  async function patch(body: Record<string, unknown>, savingSetter?: (v: boolean) => void) {
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 401) {
        window.location.href = '/login'
        return false
      }
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(b?.error ?? 'Could not save')
      }
      router.refresh()
      return true
    } catch (e) {
      if (savingSetter) savingSetter(false)
      throw e
    }
  }

  async function saveOverride(on: boolean, len: number) {
    setSavingCycle(true)
    try {
      await patch({ cycle_length_override: on ? len : null }, setSavingCycle)
    } finally {
      setSavingCycle(false)
    }
  }

  async function saveTz(value: string) {
    setTz(value)
    setSavingTz(true)
    try {
      await patch({ timezone: value }, setSavingTz)
    } finally {
      setSavingTz(false)
    }
  }

  function openEditModal(period: PeriodEpisode) {
    setEditingPeriod(period)
    setEditStartDate(period.start_date)
    setEditEndDate(period.end_date ?? '')
    setEditFlow(period.flow ?? 'medium')
  }

  async function savePeriodEdit() {
    if (!editingPeriod) return
    if (!editStartDate) {
      toast.error('Start date is required')
      return
    }
    if (editEndDate && editEndDate < editStartDate) {
      toast.error('End date cannot be before start date')
      return
    }
    setSavingEdit(true)
    try {
      const res = await fetch('/api/periods', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingPeriod.id,
          start_date: editStartDate,
          end_date: editEndDate || null,
          flow: editFlow || null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? 'Could not update period')
      }
      const data = await res.json()
      setPeriods((prev) =>
        prev
          .map((p) => (p.id === editingPeriod.id ? data.period : p))
          .sort((a, b) => a.start_date.localeCompare(b.start_date)),
      )
      setEditingPeriod(null)
      toast.success('Period episode updated')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error updating period')
    } finally {
      setSavingEdit(false)
    }
  }

  async function deletePeriodEpisode(id: string) {
    try {
      const res = await fetch(`/api/periods?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Could not delete period')
      setPeriods((prev) => prev.filter((p) => p.id !== id))
      setDeleteConfirmId(null)
      toast.success('Period removed')
      router.refresh()
    } catch {
      toast.error('Failed to delete period')
    }
  }

  async function resetAllData() {
    if (!resetPin) {
      toast.error('Please enter your vault PIN to confirm')
      return
    }
    setResetting(true)
    try {
      const res = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: resetPin }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Could not reset data')
      }
      setPeriods([])
      setResetPin('')
      setResetDialogOpen(false)
      toast.success('All cycle and symptom data has been reset')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reset failed')
    } finally {
      setResetting(false)
    }
  }

  function downloadExport(format: 'json' | 'csv') {
    window.open(`/api/export?format=${format}`, '_blank', 'noopener,noreferrer')
  }

  async function signOut() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}

    // Security & Anti-Surveillance: Clear browser-persisted caches and offline queue on sign out
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('ourcycle.queue')
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map((k) => caches.delete(k)))
        }
        if (navigator.serviceWorker?.controller) {
          navigator.serviceWorker.controller.postMessage({ action: 'clearCache' })
        }
      } catch {}
      window.location.href = '/login'
    }
  }

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h2 className="font-display text-xl sm:text-2xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">Your vault, your rules.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        {/* Left Column: Preferences, Region & Portability */}
        <div className="space-y-5">
          {/* Appearance / Theme */}
          <Card className="card-soft border-0">
            <CardContent className="p-5">
              <h3 className="font-display text-base font-semibold">Appearance</h3>
              <p className="mb-3 text-sm text-muted-foreground">
                Comfortable viewing day and night.
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={activeTheme === 'light' ? 'default' : 'outline'}
                  onClick={() => setTheme('light')}
                  className={`rounded-xl text-xs h-10 ${activeTheme === 'light' ? 'bg-primary text-primary-foreground' : ''}`}
                >
                  <Sun className="mr-1.5 h-3.5 w-3.5" />
                  Light
                </Button>
                <Button
                  type="button"
                  variant={activeTheme === 'dark' ? 'default' : 'outline'}
                  onClick={() => setTheme('dark')}
                  className={`rounded-xl text-xs h-10 ${activeTheme === 'dark' ? 'bg-primary text-primary-foreground' : ''}`}
                >
                  <Moon className="mr-1.5 h-3.5 w-3.5" />
                  Dark
                </Button>
                <Button
                  type="button"
                  variant={activeTheme === 'system' ? 'default' : 'outline'}
                  onClick={() => setTheme('system')}
                  className={`rounded-xl text-xs h-10 ${activeTheme === 'system' ? 'bg-primary text-primary-foreground' : ''}`}
                >
                  <Monitor className="mr-1.5 h-3.5 w-3.5" />
                  System
                </Button>
              </div>

              {/* Color Palettes */}
              <div className="mt-4 pt-3 border-t border-border/50">
                <h4 className="text-xs font-semibold text-foreground mb-2">Color Palette</h4>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => updatePalette('rose')}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl text-[11px] font-medium border transition-all ${
                      palette === 'rose'
                        ? 'border-primary bg-primary/10 text-primary shadow-xs'
                        : 'border-border bg-stone-50 dark:bg-zinc-800 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <span className="h-4 w-4 rounded-full bg-[#E11D48] ring-1 ring-black/10" />
                    <span>Rose</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePalette('lavender')}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl text-[11px] font-medium border transition-all ${
                      palette === 'lavender'
                        ? 'border-[#7C3AED] bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 shadow-xs'
                        : 'border-border bg-stone-50 dark:bg-zinc-800 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <span className="h-4 w-4 rounded-full bg-[#7C3AED] ring-1 ring-black/10" />
                    <span>Lavender</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePalette('sage')}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl text-[11px] font-medium border transition-all ${
                      palette === 'sage'
                        ? 'border-[#059669] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-xs'
                        : 'border-border bg-stone-50 dark:bg-zinc-800 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <span className="h-4 w-4 rounded-full bg-[#059669] ring-1 ring-black/10" />
                    <span>Sage</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePalette('terracotta')}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-xl text-[11px] font-medium border transition-all ${
                      palette === 'terracotta'
                        ? 'border-[#EA580C] bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 shadow-xs'
                        : 'border-border bg-stone-50 dark:bg-zinc-800 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <span className="h-4 w-4 rounded-full bg-[#EA580C] ring-1 ring-black/10" />
                    <span>Terracotta</span>
                  </button>
                </div>
              </div>

              {/* Discreet Privacy Disguise Mode */}
              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Discreet Privacy Mode</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[240px]">
                    Disguises the app title and headings as a private journal in public spaces.
                  </p>
                </div>
                <Switch checked={discreet} onCheckedChange={updateDiscreet} aria-label="Toggle discreet mode" />
              </div>
            </CardContent>
          </Card>

          {/* Timezone */}
          <Card className="card-soft border-0">
            <CardContent className="p-5">
              <h3 className="font-display text-base font-semibold">Timezone</h3>
              <p className="mb-3 text-sm text-muted-foreground">
                Used to decide what &ldquo;today&rdquo; means for logging and predictions.
              </p>
              <Select value={tz} onValueChange={(v) => void saveTz(v)}>
                <SelectTrigger className="h-11 w-full rounded-xl border-[rgba(225,29,72,0.2)] bg-white/80 dark:bg-zinc-900/60">
                  <SelectValue placeholder="Pick a timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {savingTz ? <p className="mt-2 text-[11px] text-muted-foreground">Saving…</p> : null}
            </CardContent>
          </Card>

          {/* Data Export */}
          <Card className="card-soft border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base font-semibold">Data portability</h3>
                  <p className="text-sm text-muted-foreground">
                    Download your complete tracking archive anytime.
                  </p>
                </div>
                <Download className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => downloadExport('json')}
                  className="h-10 rounded-xl text-xs border-[rgba(225,29,72,0.2)]"
                >
                  <FileJson className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  Download JSON
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => downloadExport('csv')}
                  className="h-10 rounded-xl text-xs border-[rgba(225,29,72,0.2)]"
                >
                  <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  Download CSV
                </Button>
                <a
                  href="/api/calendar/ics"
                  download="our-cycle.ics"
                  className="flex items-center justify-center h-10 rounded-xl text-xs font-medium border border-[rgba(225,29,72,0.2)] bg-card hover:bg-accent text-foreground transition-colors"
                >
                  <Calendar className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  Calendar (.ics)
                </a>
                <a
                  href="/report"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center h-10 rounded-xl text-xs font-medium border border-[rgba(225,29,72,0.2)] bg-card hover:bg-accent text-foreground transition-colors"
                >
                  <FileText className="mr-1.5 h-3.5 w-3.5 text-primary" />
                  Doctor Report (PDF)
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Privacy note & Data Reset */}
          <Card className="card-soft border-0">
            <CardContent className="p-5 space-y-3">
              <h3 className="font-display text-base font-semibold">Privacy &amp; Data</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Everything lives in your own vault. No analytics, no trackers, no third-party requests with your data — ever.
              </p>

              <Button
                onClick={() => void signOut()}
                variant="outline"
                className="h-11 w-full rounded-full border-[rgba(225,29,72,0.3)] text-primary"
              >
                Lock the vault (sign out)
              </Button>

              <Button
                onClick={() => setResetDialogOpen(true)}
                variant="ghost"
                className="h-10 w-full text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
              >
                <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                Reset all tracking data
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Tracking Engine, History & Security */}
        <div className="space-y-5">
          {/* Cycle length */}
          <Card className="card-soft border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-semibold">Cycle length</h3>
                  <p className="text-sm text-muted-foreground">
                    {overrideOn
                      ? 'Using a fixed length — learning continues in the background.'
                      : 'Learned automatically from your logged periods.'}
                  </p>
                </div>
                <Switch
                  checked={overrideOn}
                  onCheckedChange={(v) => {
                    setOverrideOn(v)
                    void saveOverride(v, overrideLen)
                  }}
                  aria-label="Use fixed cycle length"
                />
              </div>

              {overrideOn ? (
                <div className="mt-4">
                  <Label className="mb-2 text-sm text-muted-foreground">
                    Fixed cycle length · <span className="text-primary">{overrideLen} days</span>
                  </Label>
                  <Slider
                    value={[overrideLen]}
                    min={21}
                    max={45}
                    step={1}
                    onValueChange={(v) => setOverrideLen(v[0])}
                    onValueCommit={(v) => void saveOverride(true, v[0])}
                    aria-label="Fixed cycle length"
                  />
                  <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>21</span>
                    <span>45</span>
                  </div>
                </div>
              ) : null}

              <p className="mt-4 rounded-xl bg-secondary/70 px-3 py-2 text-xs text-secondary-foreground">
                Auto-learn would predict ~{autoCycleLength ?? '–'} days
                {sigma !== null ? ` (natural variation ±${sigma.toFixed(1)}d)` : ''} — shown so
                you can compare any fixed setting against what the model learns.
              </p>
              {savingCycle ? <p className="mt-2 text-[11px] text-muted-foreground">Saving…</p> : null}
            </CardContent>
          </Card>

          {/* Period History Management */}
          <Card className="card-soft border-0">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base font-semibold">Period history</h3>
                  <p className="text-sm text-muted-foreground">
                    Review, add, and edit past period records.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAddStartDate('')
                    setAddEndDate('')
                    setAddFlow('medium')
                    setAddModalOpen(true)
                  }}
                  className="h-8 rounded-xl border-primary/25 bg-white/50 text-xs font-semibold text-primary hover:bg-primary/10 dark:bg-zinc-800/50"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add period
                </Button>
              </div>

              <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1 nice-scroll">
                {periods.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No periods recorded yet.</p>
                ) : (
                  [...periods].reverse().map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-border/60 bg-white/40 p-2.5 text-xs dark:bg-zinc-900/40"
                    >
                      <div>
                        <span className="font-medium text-foreground">
                          {p.start_date}
                        </span>
                        <span className="text-muted-foreground">
                          {' → '}{p.end_date ?? 'ongoing'}
                        </span>
                        {p.flow ? (
                          <span className="ml-2 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700 capitalize dark:bg-rose-950/60 dark:text-rose-300">
                            {p.flow}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditModal(p)}
                          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                          aria-label="Edit period"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleteConfirmId(p.id)}
                          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-rose-600"
                          aria-label="Delete period"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Vault */}
          <Card className="card-soft border-0">
            <CardContent className="p-5">
              <h3 className="font-display text-base font-semibold">Vault PIN</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Changing your numerical PIN signs out every other device immediately.
              </p>
              <RotateForm />
            </CardContent>
          </Card>

          {/* Install guide */}
          <Card className="card-soft border-0">
            <CardContent className="p-5">
              <h3 className="font-display text-base font-semibold">Install on your phone</h3>
              <Accordion type="single" collapsible className="mt-2">
                <AccordionItem value="ios">
                  <AccordionTrigger className="text-sm">iPhone / iPad (Safari)</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    Open the site in Safari → tap the <strong>Share</strong> button → scroll and
                    tap <strong>Add to Home Screen</strong> → Add. It opens full-screen like an
                    app and works offline for logging.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="android">
                  <AccordionTrigger className="text-sm">Android (Chrome)</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    Open the site in Chrome → tap the <strong>⋮ menu</strong> →{' '}
                    <strong>Add to Home screen</strong> → Install. You can also tap the install
                    banner Chrome shows.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Period Dialog */}
      <Dialog open={editingPeriod !== null} onOpenChange={(open) => !open && setEditingPeriod(null)}>
        <DialogContent className="w-[92vw] max-w-sm sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Edit period</DialogTitle>
            <DialogDescription className="text-xs">
              Update dates or flow for this episode. Predictions recalculate automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <div>
              <Label className="text-xs text-muted-foreground">Start date</Label>
              <Input
                type="date"
                value={editStartDate}
                onChange={(e) => setEditStartDate(e.target.value)}
                className="mt-1 h-9 rounded-xl text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">End date (optional)</Label>
              <Input
                type="date"
                value={editEndDate}
                onChange={(e) => setEditEndDate(e.target.value)}
                className="mt-1 h-9 rounded-xl text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Flow</Label>
              <Select value={editFlow} onValueChange={setEditFlow}>
                <SelectTrigger className="mt-1 h-9 rounded-xl text-xs">
                  <SelectValue placeholder="Flow" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spotting">Spotting</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="heavy">Heavy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setEditingPeriod(null)}
              className="flex-1 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={savePeriodEdit}
              disabled={savingEdit}
              className="flex-1 rounded-xl bg-primary text-primary-foreground text-xs"
            >
              {savingEdit ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Period Dialog */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="w-[92vw] max-w-sm sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Add period</DialogTitle>
            <DialogDescription className="text-xs">
              Log a past period. Cycle predictions and rhythms will recalculate automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <div>
              <Label className="text-xs text-muted-foreground">Start date</Label>
              <Input
                type="date"
                value={addStartDate}
                onChange={(e) => setAddStartDate(e.target.value)}
                className="mt-1 h-9 rounded-xl text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">End date (optional)</Label>
              <Input
                type="date"
                value={addEndDate}
                onChange={(e) => setAddEndDate(e.target.value)}
                className="mt-1 h-9 rounded-xl text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Flow</Label>
              <Select value={addFlow} onValueChange={setAddFlow}>
                <SelectTrigger className="mt-1 h-9 rounded-xl text-xs">
                  <SelectValue placeholder="Flow" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="spotting">Spotting</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="heavy">Heavy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setAddModalOpen(false)}
              className="flex-1 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={saveNewPeriod}
              disabled={savingAdd}
              className="flex-1 rounded-xl bg-primary text-primary-foreground text-xs"
            >
              {savingAdd ? 'Saving…' : 'Add period'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Period Confirmation */}
      <AlertDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent className="max-w-xs rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-base">Delete this period?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This episode will be permanently removed and predictions will update.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 pt-2">
            <AlertDialogCancel className="flex-1 rounded-xl text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deletePeriodEpisode(deleteConfirmId)}
              className="flex-1 rounded-xl bg-rose-600 text-white text-xs hover:bg-rose-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Data Confirmation */}
      <AlertDialog
        open={resetDialogOpen}
        onOpenChange={(open) => {
          setResetDialogOpen(open)
          if (!open) setResetPin('')
        }}
      >
        <AlertDialogContent className="max-w-xs rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-base text-rose-600">Reset all tracking data?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This will permanently erase all logged periods, symptoms, and forecasts. Enter your vault PIN to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={resetPin}
              onChange={(e) => setResetPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Vault PIN"
              className="h-10 text-center font-mono tracking-widest text-base"
              autoFocus
            />
          </div>
          <AlertDialogFooter className="flex-row gap-2 pt-2">
            <AlertDialogCancel className="flex-1 rounded-xl text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={resetAllData}
              disabled={resetting || !resetPin}
              className="flex-1 rounded-xl bg-rose-600 text-white text-xs hover:bg-rose-700"
            >
              {resetting ? 'Resetting…' : 'Wipe all data'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

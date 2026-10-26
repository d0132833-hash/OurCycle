'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import type { AppSettings } from '@/lib/types'
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

export function SettingsView({
  settings,
  autoCycleLength,
  sigma,
}: {
  settings: AppSettings
  autoCycleLength: number | null
  sigma: number | null
}) {
  const router = useRouter()
  const [overrideOn, setOverrideOn] = useState(settings.cycle_length_override !== null)
  const [overrideLen, setOverrideLen] = useState(settings.cycle_length_override ?? 28)
  const [tz, setTz] = useState(settings.timezone)
  const [savingCycle, setSavingCycle] = useState(false)
  const [savingTz, setSavingTz] = useState(false)

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

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h2 className="font-display text-xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground">Your vault, your rules.</p>
      </div>

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

      {/* Timezone */}
      <Card className="card-soft border-0">
        <CardContent className="p-5">
          <h3 className="font-display text-base font-semibold">Timezone</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            Used to decide what &ldquo;today&rdquo; means for logging and predictions.
          </p>
          <Select value={tz} onValueChange={(v) => void saveTz(v)}>
            <SelectTrigger className="h-11 w-full rounded-xl border-[rgba(225,29,72,0.2)] bg-white/80">
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

      {/* Vault */}
      <Card className="card-soft border-0">
        <CardContent className="p-5">
          <h3 className="font-display text-base font-semibold">Vault code</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Changing it signs out every other device immediately.
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

      {/* Privacy note */}
      <Card className="card-soft border-0">
        <CardContent className="p-5">
          <h3 className="font-display text-base font-semibold">Privacy</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Everything lives in your own database, guarded by your vault code. No
            analytics, no trackers, no third-party requests with your data — ever.
          </p>
          <Button
            onClick={() => void signOut()}
            variant="outline"
            className="mt-4 h-11 w-full rounded-full border-[rgba(225,29,72,0.3)] text-primary"
          >
            Lock the vault (sign out)
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

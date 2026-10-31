'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

// Cold-start bootstrap (0 logged periods): last period start + typical length.
// The typical length becomes a low-weight prior observation in the engine.

export function BootstrapForm({ today }: { today: string }) {
  const router = useRouter()
  const [start, setStart] = useState(today)
  const [length, setLength] = useState(28)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (busy) return
    if (start > today) {
      toast.error('The start date cannot be in the future')
      return
    }
    setBusy(true)
    try {
      const s = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bootstrap_cycle_length: length }),
      })
      if (s.status === 401) {
        window.location.href = '/login'
        return
      }
      if (!s.ok) throw new Error('Could not save settings')

      const p = await fetch('/api/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: start }),
      })
      if (!p.ok) {
        const body = (await p.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? 'Could not save period')
      }
      toast.success('Welcome to Our Cycle')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card-soft p-6 sm:p-8 max-w-xl mx-auto">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Heart className="h-5 w-5 text-primary" fill="currentColor" aria-hidden />
        </span>
        <h2 className="font-display text-xl font-semibold">Let&apos;s set your first prediction</h2>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Two quick things — when your last period started, and how long your cycle usually
        feels. The app learns the rest as you log.
      </p>

      <label className="mb-2 block text-sm font-semibold text-muted-foreground">
        First day of your last period
      </label>
      <input
        type="date"
        value={start}
        max={today}
        onChange={(e) => setStart(e.target.value)}
        className="mb-6 h-12 w-full rounded-xl border border-[rgba(225,29,72,0.2)] bg-white/80 px-3 text-base"
      />

      <label className="mb-2 block text-sm font-semibold text-muted-foreground">
        Typical cycle length · <span className="text-primary">{length} days</span>
      </label>
      <Slider
        value={[length]}
        min={21}
        max={45}
        step={1}
        onValueChange={(v) => setLength(v[0])}
        className="mb-1"
        aria-label="Typical cycle length"
      />
      <div className="mb-8 flex justify-between text-xs text-muted-foreground">
        <span>21</span>
        <span>28 · average</span>
        <span>45</span>
      </div>

      <Button
        onClick={submit}
        disabled={busy}
        className="h-13 w-full rounded-full bg-primary py-3.5 text-base font-semibold text-primary-foreground"
      >
        {busy ? 'Setting up…' : 'Start my cycle'}
      </Button>
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Heart } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Vault code UI shared by /login, /setup and Settings rotation.

export function strengthOf(code: string): { score: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  let pts = 0
  if (code.length >= 10) pts += 2
  else if (code.length >= 6) pts += 1
  if (/[a-z]/.test(code) && /[A-Z]/.test(code)) pts += 1
  if (/\d/.test(code)) pts += 1
  if (/[^A-Za-z0-9]/.test(code)) pts += 1
  const score = Math.min(4, pts) as 0 | 1 | 2 | 3 | 4
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']
  const colors = ['bg-stone-300', 'bg-rose-400', 'bg-amber-400', 'bg-lime-500', 'bg-emerald-500']
  return { score, label: labels[score], color: colors[score] }
}

function StrengthMeter({ code }: { code: string }) {
  const s = strengthOf(code)
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${code.length === 0 ? 'bg-stone-200' : i < s.score ? s.color : 'bg-stone-200'}`}
          />
        ))}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {code.length === 0 ? 'Use at least 10 characters — a phrase works well' : s.label}
      </p>
    </div>
  )
}

function CodeInput({
  value,
  onChange,
  label,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  label: string
  autoFocus?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-muted-foreground">{label}</span>
      <span className="relative block">
        <Input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus={autoFocus}
          autoComplete="current-password"
          className="h-12 rounded-xl border-[rgba(225,29,72,0.2)] bg-white/80 pr-11 text-base"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Hide code' : 'Show code'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          {show ? <EyeOff className="h-4.5 w-4.5" aria-hidden /> : <Eye className="h-4.5 w-4.5" aria-hidden />}
        </button>
      </span>
    </label>
  )
}

export function VaultLogo() {
  return (
    <div className="mb-6 flex flex-col items-center gap-3 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <Heart className="h-7 w-7 text-primary" fill="currentColor" aria-hidden />
      </span>
      <div>
        <h1 className="font-display text-2xl font-semibold">Our Cycle</h1>
        <p className="mt-1 text-sm text-muted-foreground">A private space, just for you two.</p>
      </div>
    </div>
  )
}

export function LoginForm() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (res.ok) {
        router.replace('/')
        router.refresh()
        return
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      setError(body?.error ?? 'Something went wrong — try again')
    } catch {
      setError('No connection — check your internet and try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card-soft w-full max-w-sm p-7">
      <VaultLogo />
      <CodeInput value={code} onChange={setCode} label="Vault code" autoFocus />
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={busy || code.length === 0}
        className="mt-5 h-12 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground"
      >
        {busy ? 'Unlocking…' : 'Unlock'}
      </Button>
      <p className="mt-4 text-center text-[11px] text-muted-foreground">
        5 wrong attempts lock the vault for 10 minutes.
      </p>
    </form>
  )
}

export function SetupForm() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const strength = useMemo(() => strengthOf(code), [code])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (code.length < 10) {
      setError('Use at least 10 characters')
      return
    }
    if (code !== confirm) {
      setError('The two codes do not match')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      if (res.ok) {
        router.replace('/')
        router.refresh()
        return
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null
      setError(body?.error ?? 'Something went wrong — try again')
    } catch {
      setError('No connection — check your internet and try again')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="card-soft w-full max-w-sm p-7">
      <VaultLogo />
      <CodeInput value={code} onChange={setCode} label="Set your vault code" autoFocus />
      <StrengthMeter code={code} />
      <div className="mt-4">
        <CodeInput value={confirm} onChange={setConfirm} label="Repeat it once" />
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={busy || code.length < 10 || confirm.length === 0}
        className="mt-5 h-12 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground"
      >
        {busy ? 'Creating vault…' : 'Create vault'}
      </Button>
      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
        The code is hashed with Argon2id — nobody (including us) can read it. Write it
        down somewhere safe: there is no reset.
      </p>
    </form>
  )
}

export function RotateForm() {
  const router = useRouter()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (next.length < 10) {
      setMsg('New code needs at least 10 characters')
      return
    }
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch('/api/auth/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current, next }),
      })
      if (res.status === 401) {
        setMsg('Incorrect current vault code')
        return
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setMsg(body?.error ?? 'Something went wrong — try again')
        return
      }
      setCurrent('')
      setNext('')
      toast.success('Vault code updated — other devices were signed out')
      router.refresh()
    } catch {
      setMsg('No connection — try again once online')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <CodeInput value={current} onChange={setCurrent} label="Current vault code" />
      <div>
        <CodeInput value={next} onChange={setNext} label="New vault code" />
        <StrengthMeter code={next} />
      </div>
      {msg ? (
        <p role="alert" className="text-sm text-destructive">
          {msg}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={busy || !current || next.length < 10}
        variant="outline"
        className="h-11 w-full rounded-full border-[rgba(225,29,72,0.3)] text-primary"
      >
        {busy ? 'Updating…' : 'Update vault code'}
      </Button>
    </form>
  )
}

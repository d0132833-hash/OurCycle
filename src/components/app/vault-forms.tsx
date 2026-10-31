'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Heart } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Numerical Vault PIN UI shared by /login, /setup and Settings rotation.
// Supports unlimited length numerical PINs without any length hints.

export function strengthOf(code: string): { score: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  if (!code || code.length === 0) {
    return { score: 0, label: '', color: 'bg-stone-300' }
  }
  if (!/^\d+$/.test(code)) {
    return { score: 0, label: 'Numerical digits only', color: 'bg-rose-400' }
  }
  if (code.length < 4) {
    return { score: 1, label: 'At least 4 digits required', color: 'bg-amber-400' }
  }
  return { score: 4, label: 'Valid PIN', color: 'bg-emerald-500' }
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
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => {
            const digitsOnly = e.target.value.replace(/\D/g, '')
            onChange(digitsOnly)
          }}
          autoFocus={autoFocus}
          autoComplete="current-password"
          className="h-12 rounded-xl border-[rgba(225,29,72,0.2)] bg-white/80 dark:bg-stone-900/80 pr-11 font-mono tracking-widest text-lg sm:text-xl text-center"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Hide PIN' : 'Show PIN'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
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
    if (!/^\d+$/.test(code)) {
      setError('PIN must contain numbers only')
      return
    }
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
    <form onSubmit={submit} className="card-soft w-full max-w-sm sm:max-w-md p-6 sm:p-8">
      <VaultLogo />
      <CodeInput
        value={code}
        onChange={setCode}
        label="Vault PIN"
        autoFocus
      />
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={busy || code.length === 0}
        className="mt-5 h-12 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-sm transition hover:opacity-95"
      >
        {busy ? 'Unlocking…' : 'Unlock Vault'}
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

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (!/^\d+$/.test(code)) {
      setError('PIN must contain numbers only')
      return
    }
    if (code.length < 4) {
      setError('PIN must be at least 4 digits')
      return
    }
    if (code !== confirm) {
      setError('The two PIN codes do not match')
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
    <form onSubmit={submit} className="card-soft w-full max-w-sm sm:max-w-md p-6 sm:p-8">
      <VaultLogo />
      <CodeInput
        value={code}
        onChange={setCode}
        label="Set your numerical PIN"
        autoFocus
      />
      <div className="mt-4">
        <CodeInput
          value={confirm}
          onChange={setConfirm}
          label="Repeat PIN to confirm"
        />
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={busy || code.length === 0 || confirm.length === 0}
        className="mt-5 h-12 w-full rounded-full bg-primary text-base font-semibold text-primary-foreground"
      >
        {busy ? 'Creating vault…' : 'Create vault PIN'}
      </Button>
      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
        The numerical PIN is hashed with Argon2id — nobody can read it. Write it
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
    if (!/^\d+$/.test(next)) {
      setMsg('New PIN must contain numbers only')
      return
    }
    if (next.length < 4) {
      setMsg('New PIN must be at least 4 digits')
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
        setMsg('Incorrect current vault PIN')
        return
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setMsg(body?.error ?? 'Something went wrong — try again')
        return
      }
      setCurrent('')
      setNext('')
      toast.success('Vault PIN updated — other devices were signed out')
      router.refresh()
    } catch {
      setMsg('No connection — try again once online')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <CodeInput
        value={current}
        onChange={setCurrent}
        label="Current vault PIN"
      />
      <div>
        <CodeInput
          value={next}
          onChange={setNext}
          label="New vault PIN"
        />
      </div>
      {msg ? (
        <p role="alert" className="text-sm text-destructive">
          {msg}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={busy || !current || !next}
        variant="outline"
        className="h-11 w-full rounded-full border-[rgba(225,29,72,0.3)] text-primary"
      >
        {busy ? 'Updating…' : 'Update vault PIN'}
      </Button>
    </form>
  )
}

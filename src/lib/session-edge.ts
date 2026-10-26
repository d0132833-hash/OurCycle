// Web Crypto twin of crypto.ts session functions — runs in the Edge
// middleware where node:crypto is unavailable. Same wire format:
//   base64url(json payload)  '.'  base64url(HMAC-SHA256(payload, secret))

import type { SessionPayload } from './types'

export type { SessionPayload }

const enc = new TextEncoder()

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmacKey(secret: string, usages: ('sign' | 'verify')[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages,
  )
}

export async function signSessionEdge(payload: SessionPayload, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)))
  const key = await hmacKey(secret, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  return `${body}.${b64url(new Uint8Array(sig))}`
}

export async function verifySessionEdge(
  token: string | undefined | null,
  secret: string,
): Promise<SessionPayload | null> {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const sigPart = token.slice(dot + 1)
  try {
    const rawSig = fromB64url(sigPart)
    const key = await hmacKey(secret, ['verify'])
    const valid = await crypto.subtle.verify('HMAC', key, rawSig, enc.encode(body))
    if (!valid) return null

    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SessionPayload
    if (typeof payload.exp !== 'number' || typeof payload.iat !== 'number') return null
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

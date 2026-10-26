// Web Crypto twin of crypto.ts session functions — runs in the Edge
// middleware where node:crypto is unavailable. Same wire format:
//   base64url(json payload)  '.'  base64url(HMAC-SHA256(payload, secret))

export interface SessionPayload {
  v: number
  iat: number
  exp: number
  j: string
}

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

async function hmac(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

export async function signSessionEdge(payload: SessionPayload, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)))
  const key = await hmac(secret)
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
  try {
    const key = await hmac(secret)
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body))
    const expected = b64url(new Uint8Array(sig))
    // constant-time-ish comparison (lengths fixed by HMAC output)
    if (expected.length !== token.slice(dot + 1).length) return null
    let diff = 0
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ token.slice(dot + 1).charCodeAt(i)
    }
    if (diff !== 0) return null
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SessionPayload
    if (typeof payload.exp !== 'number' || typeof payload.iat !== 'number') return null
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

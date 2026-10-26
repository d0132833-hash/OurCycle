import { describe, expect, it } from 'vitest'
import {
  hashPassphrase,
  verifyPassphrase,
  signSession,
  verifySession,
  newSessionPayload,
} from '@/lib/crypto'
import { signSessionEdge, verifySessionEdge } from '@/lib/session-edge'

const SECRET = 'test-secret-must-be-long-enough-32-chars!'

describe('passphrase hashing (argon2id)', () => {
  it('hashes and verifies correct passphrase', () => {
    const code = 'secret-vault-code-12345'
    const hash = hashPassphrase(code)
    expect(hash.startsWith('argon2id$')).toBe(true)
    expect(verifyPassphrase(code, hash)).toBe(true)
  })

  it('rejects incorrect passphrase', () => {
    const hash = hashPassphrase('correct-passphrase')
    expect(verifyPassphrase('wrong-passphrase', hash)).toBe(false)
  })

  it('rejects malformed hash strings gracefully', () => {
    expect(verifyPassphrase('test', 'not-a-valid-argon-hash')).toBe(false)
    expect(verifyPassphrase('test', '')).toBe(false)
  })
})

describe('HMAC session tokens (Node runtime)', () => {
  it('signs and verifies a valid session payload', () => {
    const payload = newSessionPayload(1)
    const token = signSession(payload, SECRET)

    expect(typeof token).toBe('string')
    expect(token.includes('.')).toBe(true)

    const verified = verifySession(token, SECRET)
    expect(verified).not.toBeNull()
    expect(verified?.v).toBe(1)
    expect(verified?.j).toBe(payload.j)
  })

  it('rejects token with wrong secret', () => {
    const payload = newSessionPayload(1)
    const token = signSession(payload, SECRET)
    const wrong = verifySession(token, 'completely-different-secret-key-32!')
    expect(wrong).toBeNull()
  })

  it('rejects expired session tokens', () => {
    const past = Math.floor(Date.now() / 1000) - 100
    const payload = { v: 1, iat: past - 1000, exp: past, j: 'token-123' }
    const token = signSession(payload, SECRET)
    expect(verifySession(token, SECRET)).toBeNull()
  })

  it('rejects tampered tokens', () => {
    const payload = newSessionPayload(1)
    const token = signSession(payload, SECRET)
    const tampered = token.slice(0, -3) + 'xyz'
    expect(verifySession(tampered, SECRET)).toBeNull()
  })
})

describe('Web Crypto session tokens (Edge runtime twin)', () => {
  it('signs and verifies in Web Crypto matching the Node format', async () => {
    const payload = newSessionPayload(2)
    const token = await signSessionEdge(payload, SECRET)

    // Node verifier should accept Edge-signed token
    const nodeVerified = verifySession(token, SECRET)
    expect(nodeVerified).not.toBeNull()
    expect(nodeVerified?.v).toBe(2)

    // Edge verifier should accept Edge-signed token
    const edgeVerified = await verifySessionEdge(token, SECRET)
    expect(edgeVerified).not.toBeNull()
    expect(edgeVerified?.v).toBe(2)
  })

  it('Edge verifier rejects invalid signatures', async () => {
    const payload = newSessionPayload(1)
    const token = await signSessionEdge(payload, SECRET)
    const tampered = token.slice(0, -4) + 'abcd'
    expect(await verifySessionEdge(tampered, SECRET)).toBeNull()
  })
})

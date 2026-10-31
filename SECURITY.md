# Security & Privacy Policy — Our Cycle

Our Cycle handles sensitive reproductive health data. As such, the application is engineered around defensive cryptography, access control, and zero-telemetry privacy.

---

## 1. Cryptographic Architecture

### A. Passphrase Vault (Argon2id)
The shared vault PIN is never stored in plaintext.
- **Algorithm**: **Argon2id** (via `@noble/hashes`), following OWASP Interactive Login guidelines:
  - Memory cost: $m = 19\text{ MiB}$ ($19,456\text{ KiB}$)
  - Time cost: $t = 2$ iterations
  - Parallelism: $p = 1$ lane
  - Cryptographically secure 16-byte random salt per hash (`node:crypto` `randomBytes`)
- **Entropy Requirement**: Minimum 4 numerical digits (up to 32 digits).
- **Verification**: Constant-time comparison using `crypto.timingSafeEqual` to eliminate timing side-channel attacks.

### B. Session Authentication (HMAC-SHA256 & Epoch Invalidation)
- **Token Format**:
  $$\text{base64url}(\text{JSON payload}) \;.\; \text{base64url}(\text{HMAC-SHA256}(\text{payload}, \text{SESSION\_SECRET}))$$
- **Dual Verification**:
  1. Cryptographic HMAC signature and expiry check ($\text{exp} > \text{now}$).
  2. Database epoch verification ($\text{payload.v} === \text{app\_secrets.session\_epoch}$).
- **Instant Revocation**: When the vault passphrase is rotated via `/api/auth/rotate`, `session_epoch` is incremented. All previously issued cookies across all devices become instantly invalid.
- **Cookie Security**:
  - `httpOnly: true` (inaccessible to JavaScript / XSS)
  - `secure: true` in production (transmitted only over HTTPS)
  - `sameSite: 'strict'` (immune to Cross-Site Request Forgery / CSRF)

### C. Brute-Force Rate Limiting & DoS Prevention
- **Per-IP Sliding Lockout**: 5 failed login attempts from an IP locks that specific IP for 10 minutes, preventing an external attacker from locking out the legitimate vault owners (Denial of Service defense).
- **Global Circuit Breaker**: Distributed brute-force attacks across many IPs trigger database-level locking when extreme thresholds are reached.
- **Uniform Error Messages**: All login failure responses return identical generic error copy (`"Incorrect vault PIN"`) to prevent timing and user-enumeration leaks.

### D. Destructive Action Safeguards (Sudo Mode)
- **PIN Re-Verification**: Irreversible destructive operations (`POST /api/reset`) require re-authenticating with the vault PIN in addition to holding an active session.

---

## 2. Privacy & Anti-Surveillance Controls

1. **Row-Level Security (RLS) Deny-All**:
   - Every database table in Supabase has RLS enabled with zero policies.
   - The public `anon` API key cannot read, query, or enumerate any rows.
   - The database is accessible solely by the Next.js backend using the private `service_role` key.
2. **Search Engine & Indexing Prevention (`noindex`)**:
   - `robots.txt`: Disallows all user-agents (`Disallow: /`).
   - `X-Robots-Tag: noindex, nofollow, noarchive` HTTP header injected via `proxy.ts` and `next.config.ts`.
   - HTML meta tags: `<meta name="robots" content="noindex, nofollow, nocache" />`.
3. **PWA Storage & Logout Eviction**:
   - Navigation HTML responses containing sensitive health records are excluded from permanent service worker cache storage.
   - Locking the vault / signing out actively purges `CacheStorage` and pending offline synchronization queues from `localStorage`.
4. **Export Sanitization**:
   - Historical CSV exports sanitize leading formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) to protect users from CSV Formula Injection (CWE-1236) in spreadsheet tools.
5. **Zero Third-Party Telemetry**:
   - No Google Analytics, no Meta Pixel, no external tracking scripts.
   - Typography (`Fraunces` and `DM Sans`) is self-hosted at build time via `next/font`. No requests to Google Fonts CDNs occur at runtime.
6. **Discreet Privacy Mode**:
   - Provides on-device title and UI disguise (`Personal Notes`) to shield sensitive reproductive terms when viewed in shared or public settings.

---

## 3. Reporting Vulnerabilities

If you discover a security vulnerability in Our Cycle, please report it privately via GitHub Security Advisories or contact the repository maintainers directly.


# Security & Privacy Policy — Our Cycle

Our Cycle handles sensitive reproductive health data. As such, the application is engineered around strict zero-knowledge principles, defensive cryptography, and zero-telemetry privacy.

---

## 1. Cryptographic Architecture

### A. Passphrase Vault (Argon2id)
The shared vault code is never stored in plaintext.
- **Algorithm**: **Argon2id** (via `@noble/hashes`), following OWASP Interactive Login guidelines:
  - Memory cost: $m = 19\text{ MiB}$ ($19,456\text{ KiB}$)
  - Time cost: $t = 2$ iterations
  - Parallelism: $p = 1$ lane
  - Cryptographically secure 16-byte random salt per hash (`node:crypto` `randomBytes`)
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

### C. Brute-Force Rate Limiting
- **Threshold**: 5 consecutive failed login attempts locks the vault for 10 minutes.
- **Dual Layer**: An in-memory sliding window for sub-millisecond response + database timestamp (`login_throttle.locked_until`) to withstand cold-start restarts.
- **Uniform Error Messages**: All login failure responses return identical generic error copy (`"Incorrect vault code"`) to prevent timing and user-enumeration leaks.

---

## 2. Privacy & Anti-Surveillance Controls

1. **Row-Level Security (RLS) Deny-All**:
   - Every database table in Supabase has RLS enabled with zero policies.
   - The public `anon` API key cannot read, query, or enumerate any rows.
   - The database is accessible solely by the Next.js backend using the private `service_role` key.
2. **Search Engine Indexing Prevention (`noindex`)**:
   - `robots.txt`: Disallows all user-agents (`Disallow: /`).
   - `X-Robots-Tag: noindex, nofollow` HTTP header injected via `middleware.ts` on all responses.
   - HTML meta tags: `<meta name="robots" content="noindex, nofollow, nocache" />`.
3. **Zero Third-Party Telemetry**:
   - No Google Analytics, no Meta Pixel, no external tracking scripts.
   - Typography (`Fraunces` and `DM Sans`) is self-hosted at build time via `next/font`. No requests to Google Fonts CDNs occur at runtime.
4. **Discreet Privacy Mode**:
   - Provides on-device title and UI disguise (`Personal Notes`) to shield sensitive reproductive terms when viewed in shared or public settings.

---

## 3. Reporting Vulnerabilities

If you discover a security vulnerability in Our Cycle, please report it privately via GitHub Security Advisories or contact the repository maintainers directly.


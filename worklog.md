# Worklog

---
Task ID: 1
Agent: main (Z.ai)
Task: Build "Our Cycle" — private two-person period-tracking PWA per detailed build spec (priorities: 1. prediction accuracy, 2. daily logging + insights, 3. security/privacy, 4. UI polish)

Work Log:
- Initialized fullstack env; Next.js 16 + Tailwind 4 + shadcn/ui scaffold present; installed @supabase/supabase-js, @noble/hashes@1.8.0, vitest
- Wrote supabase/migration.sql (spec schema + RLS deny-all + 2 documented extensions: app_secrets.session_epoch for rotation invalidation, settings.bootstrap_cycle_length for cold-start prior)
- Storage layer: src/lib/storage.ts interface; SupabaseStore (service-role) + stateless LocalFileStore (.data/db.json, dev-only fallback); selector src/lib/db.ts
- P1 prediction engine: src/lib/predictions.ts (pure, zero I/O) — consecutive-start cycle derivation, 21–45 clamping, MAD modified-Z outlier rejection (|z|>3.5, 6-day floor in MAD=0 degenerate case), recency-weighted mean (half-life 4), weighted σ, 80% interval mean±max(1.28σ,1) capped ±7, cold-start prior (low weight), 1–2-cycle shrinkage 0.6her+0.4×28, ovulation −14, fertile −5→+1 (+ range variants for irregular), phases, PMS window, isLate >+10d, override mode with auto-learn reporting, buildPhaseMap, accuracyFromLog
- Unit tests (vitest): 25 tests covering all §8 acceptance criteria incl. recency-weighting sensitivity and accuracy fixtures — all passing
- Security: argon2id vault hashing (@noble v1.8 positional API, OWASP m=19456/t=2/p=1), HMAC-SHA256 session cookies (httpOnly/Secure/Strict, 30d sliding refresh in middleware), edge session verify (session-edge.ts Web Crypto), epoch check in api-auth.getSession, brute-force lockout (5 fails → 10 min, memory + DB), middleware guard (all pages → /login redirect, all API → 401), X-Robots-Tag + meta robots + robots.txt disallow-all
- Fixed redirect loop for rotated-out (epoch-stale) cookies: auth pages are epoch-aware; middleware no longer bounces /login ↔ /
- API routes: auth setup/login/logout/rotate; periods GET/POST/PATCH/DELETE (every write → syncPredictionLog: fill actuals + upsert anchor forecast); days GET/POST/PATCH/DELETE (merge-upsert); predictions GET (+accuracy); settings GET/PATCH — all zod-validated, 401 without session
- UI: theme (blush #FDF2F4 → peach #FFF7ED gradient, rose #E11D48, warm charcoal #44403C), Fraunces/DM Sans via next/font, card-soft rounded-2xl styling; screens: login/setup (strength meter), Today (countdown ring, phase card, chips, 1-tap period start/end, late state, irregular badge, bootstrap form), Calendar (month grid: rose period, dashed predicted, peach fertile, ovulation dots, today ring, tap → sheet), DaySheet (flow/mood/energy/libido emoji scales, 7 symptoms 0–3 chips, journal, offline queue), Insights (accuracy card, cycle trend + flagged bars, libido by phase, pain by phase with concrete line, flow shape, disclaimer), Settings (override switch+slider+auto-learn readout, timezone, vault rotation, install guide, privacy)
- PWA: manifest.ts, sw.js (network-first navigations, cache-first statics, never caches /api), RegisterSW (prod-only), sharp-generated icon set, offline page, offline day-log queue (localStorage) with auto-flush on reconnect
- Seed script scripts/seed.ts: 8 completed cycles 27–31d + one 34d outlier, 258 day entries with phase-flavored mood/energy/libido/symptoms, backfilled 6 forecasts (5/6 within ±1), current forecast Oct 30 (±1, high)
- README.md: 10-minute deploy runbook (Supabase → Vercel → 3 env vars → first-run vault → Add to Home Screen), API table, acceptance-criteria map
- Fixed during verification: @noble argon2 v1.8 positional API; Bun Buffer vs noble Uint8Array; lockout counter convergence; local store made stateless (multi-instance HMR staleness); stale .next cache serving deleted scaffold route; seed last-episode end_date
- Browser E2E verified (agent-browser): setup → vault → bootstrap → Today ring/chips → period end → day sheet save → calendar cells/tap → insights charts/accuracy → settings override toggle + rotation form; curl-verified 401s, lockout 429, rotation invalidation, noindex header, PWA assets

Stage Summary:
- App fully implemented and verified; dev server healthy on port 3000; 25/25 unit tests pass; lint + tsc clean (app code)
- Demo state: local store seeded with 8 cycles; numerical vault PIN configured for preview login
- Deliverables: full src/, supabase/migration.sql, scripts/seed.ts, scripts/gen-icons.mjs, tests/predictions.test.ts, README.md

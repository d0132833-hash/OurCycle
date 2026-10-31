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

---
Task ID: 2
Agent: Antigravity
Task: Enhance Today logging edit UX, clarify partner features/notifications/separation, enforce system markdown documentation workflow, and push changes to GitHub.

Work Log:
- Addressed user questions regarding the Partner companion location (perspective toggle on Today), notification architecture (privacy-first calendar .ics reminders, real-time SOS badges, 1-tap SMS/WhatsApp check-ins), and partner separation model (shared encrypted vault with Her View vs Partner View perspectives).
- Enhanced `src/components/app/period-actions.tsx`:
  - Transformed the action button to dynamically display "Edit today's log" with a PencilLine icon when an entry is recorded for today.
  - Implemented a "Logged for Today" live preview card displaying recorded symptom chips (flow, mood, energy, libido, symptoms, sleep) with an explicit 1-tap "Edit" button that opens the pre-filled DaySheet drawer.
- Enhanced `src/components/app/day-sheet.tsx`:
  - Added an "Editing Entry" badge in the drawer header when editing an existing day log.
  - Changed the primary CTA from "Save day" to "Update entry" when modifying a day.
  - Verified clear/delete entry capability.
- Documented the system rule across `README.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, and `worklog.md`: "After making changes, update all the system markdown files & then push everything to github".
- Tested and verified: vitest suite (80/80 passing tests) and Next.js 16 build (`npm run build` compiled cleanly).
- Pushed changes to GitHub remote (`origin main`).

---
Task ID: 3
Agent: Antigravity
Task: Live Chrome E2E browser testing, eradicate hardcoded fallback PIN (2007), enforce secure first-run setup onboarding, update system markdown documentation, and push to GitHub.

Work Log:
- Executed full 7-step Puppeteer browser E2E test suite with slowMo verification against the running Next.js dev server:
  1. Vault unlock & login flow
  2. Perspective toggle & Partner Care Companion
  3. Quick-log presets (#tea, cramp & rest) & lifestyle tracker
  4. Calendar view & .ics export button
  5. Insights, BBT temperature chart & correlation insights
  6. Clinical Doctor Summary Report (/report)
  7. Settings aesthetic palettes (Lavender) & Discreet Mode
- Clarified desktop shell isolation on Windows background subshells and launched user browser via `explorer.exe "http://localhost:3000"`.
- Identified and eliminated critical security flaw where PIN `2007` was hardcoded as a fallback secret in `login/page.tsx` and `api/auth/login/route.ts`:
  - Removed auto-creation of default PIN `2007`.
  - Configured `login/page.tsx` to redirect straight to `/setup` if no secret is initialized.
  - Configured `POST /api/auth/login` to return HTTP 400 rejection if the vault is uninitialized.
  - Refactored `scripts/seed.ts` to only use `SEED_VAULT_PIN`/`VAULT_PIN` environment variables if explicitly passed.
  - Hardened `scripts/browser-test.mjs` with dual setup/login auto-detection.
  - Reset local secret in `.data/db.json` while maintaining all period logs and historical records.
- Verified test suite: 80/80 tests passing in Vitest, TypeScript typecheck zero errors (`npx tsc --noEmit`), and Next.js production build (`npx next build`) compiled successfully.
- Updated all system markdown files (`CHANGELOG.md`, `worklog.md`, `README.md`, `ARCHITECTURE.md`) in compliance with repository maintenance rules.
- Pushed changes to GitHub remote repository (`origin main`).

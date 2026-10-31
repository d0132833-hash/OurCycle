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

---
Task ID: 4
Agent: Antigravity
Task: Comprehensive Multi-Viewport Optimization for Mobile, Tablet, and Laptop/Desktop viewports, system markdown documentation sync, and push to GitHub.

Work Log:
- Overhauled App Shell container (`src/components/app/app-shell.tsx`):
  - Removed narrow hardcoded `max-w-md` (448px) constraint; implemented responsive container: `max-w-md` on Mobile, `max-w-4xl` on Tablet, `max-w-6xl` on Laptop/Desktop with responsive padding `px-4 sm:px-6 lg:px-8`.
  - Implemented dual-navigation architecture:
    - Mobile (<768px): Thumb-friendly floating bottom navigation bar with active indicators and safe-area padding.
    - Tablet & Laptop (>=768px): Sleek frosted top navigation bar in header (`hidden md:flex`) with active tab pills (`Today`, `Calendar`, `Insights`, `Settings`) and quick shortcut to the Doctor Report (`/report`). Bottom navigation automatically hides (`md:hidden`).
  - Adjusted main content bottom padding from `pb-36` to `pb-32 md:pb-12`.
- Optimized Today View (`src/components/app/today-view.tsx` & `countdown-ring.tsx`):
  - In Her View: Converted single-column stack into a 2-column layout on Tablet/Laptop (`grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-6`):
    - Left column (5 cols, sticky): Countdown Ring (scaled smoothly `h-48 sm:h-52 md:h-56`), phase title/copy, chips, expectation line, and irregularity alerts.
    - Right column (7 cols): Period Actions card ("Period started/ended today", "Log today", logged summary preview) and the 1-tap "Signal Your Partner" shelf.
  - Sized Countdown Ring SVG and typography smoothly across breakpoints.
- Optimized Partner Care Companion (`src/components/app/partner-view.tsx`):
  - Arranged Top Hero Banner and Estimated Energy & Social Battery Gauge side-by-side (`grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch`).
  - Arranged Active Wishes from Her and Logged Symptoms Alert side-by-side (`grid grid-cols-1 md:grid-cols-2 gap-4`).
  - Arranged Caring Check-in Generator and Care Grocery Checklist side-by-side (`grid grid-cols-1 lg:grid-cols-2 gap-5 items-start`).
  - Rendered Phase-Synced Date Matchmaker in a responsive multi-column grid (`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3`).
  - Rendered Intimacy Compass and Mindful Boundaries in balanced 2-column cards (`grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch`).
- Optimized Calendar View (`src/components/app/calendar-grid.tsx` & `day-sheet.tsx`):
  - Expanded calendar card to `max-w-4xl mx-auto` with responsive padding `p-4 sm:p-6 md:p-8`.
  - Day cells scale from mobile `h-10 w-10` to tablet `sm:h-12 sm:w-12` and laptop `md:h-14 md:w-14` with rounded-2xl buttons, hover states, and clear indicator dots.
  - DaySheet Drawer expands on tablet/laptop to `w-full max-w-lg md:max-w-2xl mx-auto rounded-t-3xl shadow-2xl`.
  - Symptoms grid adapts to `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5`.
  - Quick 1-tap presets adapt to 4 columns in 1 row (`grid-cols-2 sm:grid-cols-4 gap-2`).
  - Sleep, Hydration, BBT and Weight controls adapt to responsive side-by-side pairs (`grid-cols-1 sm:grid-cols-2 gap-2.5`).
- Optimized Insights & Analytics (`src/components/app/insights-view.tsx` & `advanced-analytics.tsx`):
  - Converted the vertical chart stack into a responsive 2-column analytics grid on tablet/laptop (`grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5 items-stretch`) for Cycle Lengths, Sex Drive by Phase, Pain & Symptoms by Phase, and Flow Shape.
  - Body Pattern Correlations in AdvancedAnalytics adapt to a 3-column responsive grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3`).
  - Expanded BBT chart container height with responsive scaling (`h-56 md:h-72 lg:h-80 w-full`).
- Optimized Settings Console (`src/components/app/settings-view.tsx`):
  - Organized settings into a balanced 2-column layout on tablet/laptop (`grid-cols-1 md:grid-cols-2 gap-5 items-start`):
    - Left Column: Appearance & Theme, Timezone, Data Portability (Export JSON, CSV, ICS, Doctor Report), Privacy & Vault Lock/Reset.
    - Right Column: Biological Cycle Length & Model Learning, Period History Management, Vault PIN Rotation, and Phone Install Instructions.
  - Modal dialogs adjusted to responsive width (`w-[92vw] max-w-sm sm:max-w-md rounded-2xl`).
- Optimized Clinical Doctor Report (`src/components/app/doctor-report.tsx`):
  - Expanded print-friendly layout to `max-w-3xl lg:max-w-4xl`.
  - Added horizontal scroll wrapper `overflow-x-auto nice-scroll` with `min-w-[540px]` on the 6-column episode history table to prevent mobile clipping or blowout.
  - Sheet padding adjusted to `p-5 sm:p-8 md:p-12`.
- Optimized Auth & Bootstrap (`src/components/app/vault-forms.tsx` & `bootstrap-form.tsx`):
  - Form cards scale gracefully (`w-full max-w-sm sm:max-w-md p-6 sm:p-8`) with minimum 16px font sizes to prevent iOS auto-zoom.
  - Cold-start bootstrap form centered with `max-w-xl mx-auto`.
- Verified quality:
  - Multi-viewport automated Puppeteer test (`scripts/responsive-test.mjs`): Mobile (390x844), Tablet (768x1024), and Laptop (1440x900) verified with zero horizontal overflow and correct navigation states.
  - Vitest test suite: 80/80 tests passing (`npm test`).
  - Next.js 16 build (`npm run build`): compiled successfully with 0 errors.
- Updated all system markdown files (`worklog.md`, `CHANGELOG.md`, `README.md`, `ARCHITECTURE.md`).
- Pushed changes to GitHub remote (`origin main`).

---
Task ID: 4
Agent: Antigravity
Task: Comprehensive codebase cleanup, obsolete scaffold purge, dependency pruning, and repository hygiene.

Work Log:
- Conducted deep repository audit identifying template leftovers from previous scaffold environments.
- Purged 100% obsolete non-app directories and files:
  - Removed `.zscripts/` (12 files including PID tracker, bash build/dev scripts, temporary screenshots).
  - Removed template test scripts `tests/database-runtime-build.sh`, `tests/python-runtime-build.sh`, and `tests/python-runtime-container.sh`.
  - Removed `examples/websocket/` (frontend.tsx & server.ts).
  - Removed `mini-services/` (.gitkeep) and `download/` (README.md).
  - Removed cloud proxy configuration `Caddyfile`.
  - Removed unused binary database `db/custom.db`.
  - Removed unneeded Prisma configuration `prisma/schema.prisma`.
- Optimized `package.json`:
  - Renamed package to `our-cycle`.
  - Cleaned dev/start scripts of POSIX-specific pipe commands (`tee`).
  - Removed Prisma CLI script entries (`db:push`, `db:generate`, `db:migrate`, `db:reset`).
  - Added `test:browser` and `test:responsive` convenience runners.
  - Purged 17 unused packages (`@prisma/client`, `prisma`, `z-ai-web-dev-sdk`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@mdxeditor/editor`, `next-auth`, `next-intl`, `react-syntax-highlighter`, `@reactuses/core`, `@tanstack/react-query`, `@tanstack/react-table`, `zustand`, `@hookform/resolvers`, `react-markdown`, `uuid`).
  - Added `tsx` to devDependencies for direct TypeScript execution (`npm run seed`).
  - Pruned 350 packages from `node_modules` via `npm install`.
  - Removed stale `bun.lock` to maintain `package-lock.json` as the single authoritative lockfile.
- Fixed cross-platform script compatibility:
  - Fixed Windows URL path bug in `scripts/gen-icons.mjs` using `fileURLToPath` and `path.join`. Verified `npm run icons` succeeds.
  - Added configurable `CHROME_PATH` support in `scripts/browser-test.mjs` and `scripts/responsive-test.mjs`.
  - Verified `npm run seed` runs cleanly with `tsx`.
- Source control & git hygiene:
  - Untracked 25 binary test screenshots (~6MB) and added `screenshots/` to `.gitignore`.
  - Added `!.env.example` in `.gitignore` to keep environment variable template tracked.
- Verification & Testing:
  - Vitest test suite (`npm test`): 80/80 tests passing (6 test suites).
  - Next.js production build (`npm run build`): compiled cleanly in Turbopack.
  - Icon generator (`npm run icons`): generated icons successfully without errors.
- Updated all system documentation files (`README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `worklog.md`).

---
Task ID: 5
Agent: Antigravity
Task: Implement custom shopping checklist item addition by Her with bi-directional vault sync & design unique route-tailored loading skeletons for every tab.

Work Log:
- Implemented Care & Comfort Shopping custom item addition:
  - Added pure shopping tag helpers to `src/lib/partner-intelligence.ts`: `parseCustomShoppingItems`, `addCustomShoppingTag`, `toggleCustomShoppingTag`, and `removeCustomShoppingTag`.
  - Stored custom shopping items using the `shop:<name>` (active) and `shop:done:<name>` (checked off) tag protocol in `day_entries.tags`, automatically syncing across partner devices via `/api/days`.
  - Expanded `tags` array schema in `src/app/api/days/route.ts` from 50 to 100 character items.
  - Enhanced `src/components/app/partner-signal-shelf.tsx` (Her View on Today screen): added a "Care & Comfort Shopping Wishlist" section with a quick text input, add button, and active items list with status badge ("Waiting for him 💕" vs "Bought by Partner ✓") and 1-tap delete.
  - Enhanced `src/components/app/partner-view.tsx` (Partner Care Companion): added a direct custom item addition input form, grouped custom requests from her at the top of the checklist under "Requested by Her 💕", enabled check-off toggling and item removal, and updated `handleCopyGroceryList` to include her special requests at the top of clipboard text.
- Replaced identical countdown ring loading skeleton with unique, tailored skeletons for every tab:
  - `src/app/(app)/calendar/loading.tsx`: month navigation bar, 7-column weekday headers, 35 day cells with cycle-like rose/peach tints, and legend badge skeletons.
  - `src/app/(app)/insights/loading.tsx`: model accuracy banner skeleton, and a responsive 2-column chart grid with simulated vertical bars for Cycle Lengths, Sex Drive, Pain & Symptoms, and Flow Shape.
  - `src/app/(app)/settings/loading.tsx`: 2-column settings console skeleton with theme buttons, timezone dropdown, data export pills, cycle learning switch & slider, period history rows, and vault rotation form.
  - `src/app/(app)/report/loading.tsx`: clinical summary header, 4 clinical stat cards, and 6-column medical episode history table with striped rows.
  - `src/app/(app)/loading.tsx`: upgraded default Today skeleton to responsive 12-column grid on tablet/laptop with sticky countdown ring on left and action/signals on right.
- Testing & Quality Verification:
  - Vitest test suite (`npm test`): added 5 new unit tests in `tests/partner-intelligence.test.ts` (85/85 tests passing).
  - TypeScript compiler (`npx tsc --noEmit`): clean with 0 errors.
  - Next.js production build (`npm run build`): compiled cleanly in Turbopack.
- Updated all system documentation files (`README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `worklog.md`).
- Pushed changes to GitHub remote (`origin main`).

---
Task ID: 7
Agent: Antigravity
Task: In-depth security audit and defense-in-depth code hardening across all 14 findings.

Work Log:
- Conducted deep vulnerability and architectural security assessment across authentication, session lifecycle, cryptographic boundaries, PWA offline storage, HTTP response headers, injection vectors, and dependency trees.
- Hardened Authentication & DoS defenses:
  - Scoped brute-force failed login counters to individual client IP addresses using an in-memory sliding window (`src/lib/lockout.ts`, `src/app/api/auth/login/route.ts`).
  - Raised global database lockout threshold to a 25-failure emergency circuit-breaker, eliminating single-IP Denial of Service against legitimate owners.
  - Enforced minimum 4-digit PIN requirement (`min(4)` up to `max(32)`) in backend Zod schemas (`setup/route.ts`, `rotate/route.ts`) and frontend forms (`vault-forms.tsx`).
  - Added optional `SETUP_TOKEN` onboarding protection to `POST /api/auth/setup` to prevent unauthenticated vault claim races during first-time production deployments.
  - Added Sudo Mode to `POST /api/reset` requiring re-authenticating with the current vault PIN via Argon2id before wiping records, updating `settings-view.tsx` with a PIN prompt dialog.
- Hardened Client Privacy & Anti-Surveillance:
  - Updated PWA Service Worker (`public/sw.js`) to exclude authenticated HTML navigation streams from permanent `CacheStorage`, preventing sensitive cycle history, symptoms, and notes from being cached in plaintext.
  - Enhanced `signOut()` in `settings-view.tsx` to actively purge all browser `CacheStorage` instances and clear pending mutation queues in `localStorage['ourcycle.queue']`.
- Hardened Request Validation & Injection Prevention:
  - Neutralized CSV Formula Injection (CWE-1236) in `src/app/api/export/route.ts` with `csvCell()` escaping that prepends a single quote to cells beginning with formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`).
  - Added `Cache-Control: no-store, no-cache, must-revalidate, private` to `/api/export` responses.
  - Hardened `isSameOrigin()` in `src/lib/api-helpers.ts` with `Sec-Fetch-Site: cross-site` detection and `x-forwarded-host` reverse proxy inspection. Added origin check and IP rate limiting to `POST /api/auth/login`.
- Hardened Security Headers & Infrastructure:
  - Injected defensive security headers in `next.config.ts` and `src/proxy.ts`: `X-Frame-Options: DENY` (clickjacking protection), `Content-Security-Policy` with `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`.
  - Moved `sharp` to `devDependencies` and upgraded to `^0.35.5`, eliminating native `libvips` memory corruption CVEs from production builds.
  - Sanitized `/api/health` error output to prevent leaking PostgreSQL connection strings or database schemas.
  - Added `{ mode: 0o600 }` to file write calls in `LocalFileStore` (`src/lib/local-store.ts`).
  - Enabled strict TypeScript compilation checks in `next.config.ts` by removing `ignoreBuildErrors: true` and setting `reactStrictMode: true`.
- Testing & Quality Verification:
  - Added 4 automated unit tests in `tests/api.test.ts` covering CSV formula sanitization, Cache-Control headers, sudo reset verification, and setup minimum PIN length.
  - Vitest test suite (`npm test`): 92/92 tests passing across 6 test files.
  - ESLint (`npm run lint`): 0 errors, 0 warnings.
  - Next.js production build (`npm run build`): compiled cleanly with Turbopack and 0 errors.
- Updated all system documentation files (`SECURITY.md`, `API.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `README.md`, `worklog.md`).
- Pushed changes to GitHub remote (`origin main`).

---
Task ID: 4
Agent: Antigravity
Task: Implement adjustable period cycle length and automatic logging of following days when logging the first date.

Work Log:
- Implemented configurable `period_length` setting across data layers:
  - Added `period_length?: number | null` to `AppSettings` domain type (`src/lib/types.ts`).
  - Updated storage contracts and implementations (`LocalFileStore`, `SupabaseStore`) with default period duration of 5 days (range 1–10/14 days).
  - Updated Supabase schema definition in `supabase/migration.sql`.
  - Added `period_length` validation to `PATCH /api/settings` (`src/app/api/settings/route.ts`).
  - Added `periodLength` option support to prediction calculations and recompute engine (`src/lib/predictions.ts`, `src/lib/recompute.ts`).
- Implemented automatic logging of following days upon logging first date:
  - Updated `POST /api/periods` (`src/app/api/periods/route.ts`): when `end_date` is omitted or null, it calculates `end_date = addDays(start_date, period_length - 1)`.
  - Automatically creates/upserts `day_entries` for every day across the period duration with the episode's flow while preserving any existing symptoms, notes, or moods.
  - Updated `PATCH /api/periods` and `DELETE /api/periods` to gracefully manage day flow entries: cleans up trimmed days when a period ends early and cascades cleanup when deleting an episode.
- User interface enhancements:
  - Settings View (`src/components/app/settings-view.tsx`): Added dedicated "Period cycle length" card with interactive slider (1–10 days), and added auto-log duration preview in the "Add period" dialog.
  - Today View (`src/components/app/period-actions.tsx`): Added inline "Period cycle length: X days (adjust)" quick action and interactive dialog directly on the main screen, allowing her to adjust period cycle length with 1 tap.
  - Bootstrap Form (`src/components/app/bootstrap-form.tsx`): Added "Typical period length" slider alongside cycle length during initial vault onboarding.
- Quality Verification:
  - Added 4 integration tests in `tests/comprehensive-features.test.ts` verifying settings adjustment, automatic multi-day logging on first date entry, early-end day trimming, and deletion cleanup.
  - Vitest test suite (`npm test`): 96/96 tests passing across 6 test files.
  - Next.js 16 production build (`npm run build`): compiled cleanly with 0 errors.
- Updated all system markdown files (`API.md`, `ARCHITECTURE.md`, `README.md`, `worklog.md`).

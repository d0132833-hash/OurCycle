# Changelog — Our Cycle

All notable changes and architectural features introduced to the Our Cycle codebase are documented here.

---

## [0.7.0] — 2026-10-31

### 🛡️ Comprehensive Security Audit & Defense-in-Depth Hardening

#### 1. Authentication & Denial-of-Service Defense
- **Per-IP Sliding Lockout (`src/lib/lockout.ts`, `src/app/api/auth/login/route.ts`)**:
  - Scoped brute-force failed login counters to individual client IP addresses using an in-memory sliding window.
  - Prevents an unauthenticated remote attacker from locking legitimate vault owners out of the application (mitigating global DoS).
  - Converted database throttling into a high-threshold emergency circuit-breaker (25 consecutive failures) against distributed botnet attacks.
- **PIN Entropy Enforcement (`src/app/api/auth/setup/route.ts`, `src/app/api/auth/rotate/route.ts`, `src/components/app/vault-forms.tsx`)**:
  - Enforced a minimum 4-digit PIN requirement (`min(4)` up to `max(32)`) in backend Zod schemas and frontend forms.
  - Updated client-side PIN strength evaluator to flag PINs shorter than 4 digits.
- **Onboarding Gating (`src/app/api/auth/setup/route.ts`)**:
  - Added support for an optional `SETUP_TOKEN` environment variable to prevent unauthenticated vault claim races during initial production deployment.
- **Sudo Mode on Data Wipe (`src/app/api/reset/route.ts`, `src/components/app/settings-view.tsx`)**:
  - `POST /api/reset` now requires re-verifying the current vault PIN via Argon2id before wiping records.
  - Updated the reset confirmation dialog with a password input field and rate limiting.

#### 2. Client Privacy & Anti-Surveillance
- **PWA Service Worker Privacy (`public/sw.js`)**:
  - Excluded authenticated navigation HTML streams from permanent `CacheStorage`. Navigation fetches live data or falls back to the clean, generic `/offline` shell.
  - Prevents persistent plaintext storage of sensitive cycle records, symptoms, and notes on shared devices.
- **Vault Lock Eviction (`src/components/app/settings-view.tsx`)**:
  - Locking the vault / signing out now actively purges all browser `CacheStorage` instances and wipes pending mutation queues in `localStorage['ourcycle.queue']`.

#### 3. Injection Prevention & Defensive Headers
- **CSV Formula Injection Sanitization (`src/app/api/export/route.ts`)**:
  - Added `csvCell()` escaping that prepends a single quote (`'`) to any export cell starting with spreadsheet formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`), preventing DDE code execution and data exfiltration in Excel and Google Sheets.
  - Added `Cache-Control: no-store, no-cache, must-revalidate, private` to `/api/export` responses.
- **CSRF & Origin Validation (`src/lib/api-helpers.ts`, `src/app/api/auth/login/route.ts`)**:
  - Enhanced `isSameOrigin()` with `Sec-Fetch-Site: cross-site` detection and `x-forwarded-host` reverse proxy inspection.
  - Added origin check and IP rate limiting to `POST /api/auth/login`.
- **Browser Security Headers (`next.config.ts`, `src/proxy.ts`)**:
  - Configured `X-Frame-Options: DENY`, `Content-Security-Policy: ... frame-ancestors 'none'; object-src 'none'; ...`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`.

#### 4. Infrastructure, Dependency & Build Hygiene
- **Remediated Native Dependency Vulnerability (`package.json`)**:
  - Moved `sharp` from production runtime `dependencies` to `devDependencies` and upgraded to `^0.35.5`, eliminating high-severity libvips memory corruption CVEs.
- **Sanitized Health Check Errors (`src/app/api/health/route.ts`)**:
  - Replaced raw database driver exception messages with a sanitized generic response, logging details solely to the server console.
- **Local Storage Permissions (`src/lib/local-store.ts`)**:
  - Added `{ mode: 0o600 }` to file write operations and `0o700` to directories to prevent world-readable permission leakage on multi-user systems.
- **Strict Build Mode (`next.config.ts`)**:
  - Removed `ignoreBuildErrors: true` and enabled `reactStrictMode: true`. TypeScript compiler typechecking now executes strictly on every build.
- **Unit & Security Tests (`tests/api.test.ts`)**:
  - Added 4 automated security tests covering CSV sanitization, Cache-Control headers, sudo reset verification, and setup minimum PIN length (92/92 tests passing).

---

## [0.6.0] — 2026-10-31

### 🛒 Custom Shopping Checklist by Her, 🔋 Partner Social Battery Adjustment & 🎨 Route-Tailored Loading Skeletons

#### 1. Custom Items in Care & Comfort Shopping Checklist
- **Direct Addition in Her View (`partner-signal-shelf.tsx`)**:
  - Added a dedicated "Care & Comfort Shopping Wishlist" input directly below her 1-tap signals on Today view.
  - She can type any treat, comfort snack, or supply (e.g. "Salted caramel gelato", "Extra heating patches", "Iced matcha").
  - Displays her active requested shopping items with a "Waiting for him 💕" status badge and a 1-tap delete button.
- **Direct Addition in Partner Care View (`partner-view.tsx`)**:
  - Added an intuitive "Add custom comfort item" form directly in the "Care & Comfort Shopping Checklist" card.
  - Items requested by her appear highlighted at the top under a `"Requested by Her 💕"` section with custom checkboxes and delete controls.
- **Bi-directional Vault Sync & Copy List**:
  - Custom shopping items are serialized with the `shop:<name>` and `shop:done:<name>` tag convention in `day_entries.tags`, syncing across devices via the shared vault API (`/api/days`).
  - Increased `tags` validation max string length in `src/app/api/days/route.ts` from 50 to 100 characters to safely support descriptive treat names.
  - Enhanced `handleCopyGroceryList`: Clipboard export cleanly groups `🌟 Special Requests from Her:` at the top followed by `🛒 Curated Comfort Essentials:`.
- **Pure Intelligence Helpers (`partner-intelligence.ts`)**:
  - Added pure helpers: `parseCustomShoppingItems`, `addCustomShoppingTag`, `toggleCustomShoppingTag`, and `removeCustomShoppingTag`.
  - Added 5 comprehensive Vitest unit tests verifying parsing, duplicate prevention, active/done toggling, and tag removal.

#### 2. Social Battery Manual Adjustment in Partners Tab Only (`partner-view.tsx`)
- **Self-Reported Adjustment by Her**: If the automated algorithmic estimate feels inaccurate on any given day, she can adjust her real-time social battery directly inside the Partners tab.
- **Granular Slider & 1-Tap Presets**: Features an interactive range slider (10%–100%) and 5 instant quick presets (`Very Low (15%)`, `Low (30%)`, `Moderate (55%)`, `High (75%)`, `Peak (95%)`).
- **Visual Feedback & Badging**: When adjusted, the battery displays a distinct `"Adjusted by Her 💕"` badge and tailored summary copy so her partner immediately knows her actual state.
- **Seamless Reset Option**: Includes a 1-tap `"Reset auto"` button to revert back to the automated biological estimate at any time.
- **Vault Persistence**: Serialized through the `battery:override:<percentage>` tag in `day_entries.tags`, keeping both partner devices aligned in real time.
- **Unit Tested**: Added 3 new unit tests covering override extraction, tag manipulation, and manual adjustment resolution in `tests/partner-intelligence.test.ts` (88/88 tests passing).

#### 3. Unique Route-Tailored Loading Skeletons for Every Tab
- **Calendar Skeleton (`src/app/(app)/calendar/loading.tsx`)**:
  - Replaced the countdown ring placeholder with an authentic month calendar skeleton: month navigation bar, 7-column weekday headers, 35 day cells with cycle-like rose/peach tints, and legend badge skeletons.
- **Insights Skeleton (`src/app/(app)/insights/loading.tsx`)**:
  - Replaced the countdown ring with a full analytics dashboard skeleton: accuracy banner, and a 2-column responsive chart grid with simulated vertical bars for Cycle Lengths, Sex Drive by Phase, Pain & Symptoms by Phase, and Flow Shape.
- **Settings Skeleton (`src/app/(app)/settings/loading.tsx`)**:
  - Replaced the countdown ring with a 2-column settings console skeleton: appearance buttons, timezone dropdown, data export pills, cycle learning switch & slider, period history rows, and vault rotation form.
- **Doctor Report Skeleton (`src/app/(app)/report/loading.tsx`)**:
  - Added a clinical summary skeleton: report header with medical badge, 4 clinical stat cards, and a 6-column medical episode history table with striped rows.
- **Today Skeleton (`src/app/(app)/loading.tsx`)**:
  - Upgraded the default/Today skeleton to be fully responsive (`max-w-md md:max-w-4xl lg:max-w-6xl`), featuring the sticky countdown ring on the left (5 cols) and action/preview/signals skeleton on the right (7 cols) on tablet and laptop viewports.

---

## [0.5.0] — 2026-10-31

### 🧹 Repository Cleanup & Scaffolding De-bloat

#### 1. Removed Legacy Template Artifacts
- Purged container scaffolding and runtime scripts: `.zscripts/` (including stale process PID, runtime bash scripts, and temporary images).
- Removed unused shell test files from template testing: `tests/database-runtime-build.sh`, `tests/python-runtime-build.sh`, and `tests/python-runtime-container.sh`.
- Removed template microservice directories and demo apps: `mini-services/`, `examples/websocket/` (frontend & server), and `download/`.
- Removed reverse-proxy configuration leftover from cloud container sandbox: `Caddyfile`.
- Purged unneeded SQLite file: `db/custom.db`.
- Purged unused Prisma configuration: `prisma/schema.prisma` and removed unused Prisma CLI commands (`db:push`, `db:generate`, `db:migrate`, `db:reset`).

#### 2. Dependency Optimization & Modernization (`package.json`)
- Updated package identity from generic `nextjs_tailwind_shadcn_ts` to `our-cycle`.
- Removed 17 completely unused boilerplate dependencies:
  - `@prisma/client`, `prisma`, `z-ai-web-dev-sdk`
  - `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
  - `@mdxeditor/editor`, `next-auth`, `next-intl`, `react-syntax-highlighter`
  - `@reactuses/core`, `@tanstack/react-query`, `@tanstack/react-table`, `zustand`
  - `@hookform/resolvers`, `react-markdown`, `uuid`
- Pruned 350 packages from `node_modules`, dramatically speeding up install times and reducing disk footprint.
- Added `tsx` to devDependencies for direct TypeScript script execution (`npm run seed`).
- Removed stale `bun.lock` to establish `package-lock.json` as the single authoritative lockfile.

#### 3. Cross-Platform Script Hardening
- Fixed Windows file URL path bug in `scripts/gen-icons.mjs` using `fileURLToPath` and `path.join`.
- Added configurable `CHROME_PATH` environment variable support to `scripts/browser-test.mjs` and `scripts/responsive-test.mjs`.
- Cleaned npm scripts: simplified `dev` and `start` commands without POSIX-only pipes (`tee`), added `test:browser` and `test:responsive` convenience runners.

#### 4. Gitignore & Source Control Hygiene
- Removed 25 binary test screenshots (~6MB) from git tracking and added `screenshots/` to `.gitignore`.
- Exempted `.env.example` in `.gitignore` so environment setup instructions remain tracked for new developers.

---

## [0.4.0] — 2026-10-31

### 📱 Responsive Multi-Viewport Overhaul (Mobile, Tablet & Laptop/Desktop)

#### 1. Adaptive Shell & Dual-Navigation Architecture (`app-shell.tsx`)
- Eliminated the narrow `max-w-md` (448px) bottleneck. Shell container now dynamically expands across breakpoints:
  - Mobile (<768px): `max-w-md mx-auto px-4`
  - Tablet (768px–1024px): `max-w-4xl mx-auto px-6`
  - Laptop & Desktop (1024px+): `max-w-6xl mx-auto px-8`
- **Mobile Mode**: Retains touch-friendly floating bottom navigation bar with safe-area padding and active pills.
- **Tablet & Laptop Mode**: Bottom navigation bar automatically hides (`md:hidden`), avoiding the awkward floating bar. Replaced by a frosted top navigation bar in `<header>` (`hidden md:flex`) featuring tabs (`Today`, `Calendar`, `Insights`, `Settings`) and a quick action link to the **Doctor Report** (`/report`).
- Main content bottom padding adjusts from `pb-36` on mobile to `pb-12` on desktop.

#### 2. Today View 2-Column Dashboard (`today-view.tsx` & `countdown-ring.tsx`)
- On Tablet and Laptop viewports, "Her View" organizes into a 2-column layout (`grid-cols-1 md:grid-cols-12 gap-6 items-start`):
  - **Left Column (5 cols, sticky)**: Sized Countdown Ring (`h-48 sm:h-52 md:h-56`), phase heading/summary, expectation line, and regularity index badges.
  - **Right Column (7 cols)**: Primary action buttons (`Period started/ended today`, `Log today`, summary chip preview) and the 1-tap `PartnerSignalShelf`.
- Animated Countdown Ring text and circular SVG scale responsively with smooth transitions.

#### 3. Partner Care Command Center (`partner-view.tsx`)
- Arranged Hero Banner and Estimated Energy & Social Battery Gauge side-by-side (`grid md:grid-cols-2 gap-4 items-stretch`).
- Arranged Active Wishes from Her and Logged Symptoms Alert side-by-side (`grid md:grid-cols-2 gap-4`).
- Arranged Caring Check-in Generator and Care Grocery Checklist side-by-side (`grid lg:grid-cols-2 gap-5 items-start`).
- Phase-Synced Date Matchmaker renders as a responsive 3-column card grid (`grid md:grid-cols-2 lg:grid-cols-3 gap-3`).
- Intimacy Compass and Mindful Boundaries sit in balanced 2-column cards (`grid md:grid-cols-2 gap-4 items-stretch`).

#### 4. Calendar & Logging Sheet Responsiveness (`calendar-grid.tsx` & `day-sheet.tsx`)
- Calendar month grid expands to `max-w-4xl mx-auto` with responsive padding `p-4 sm:p-6 md:p-8`.
- Day cells scale from mobile `h-10 w-10` to tablet `sm:h-12 sm:w-12` and laptop `md:h-14 md:w-14` with rounded-2xl buttons, hover states, and clear indicator dots.
- `DaySheet` Drawer expands on tablet/laptop to `w-full max-w-lg md:max-w-2xl mx-auto rounded-t-3xl shadow-2xl`.
- Symptoms grid adapts from 2 columns to 3 columns (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5`).
- Quick 1-tap presets adapt to 4 columns in 1 row (`grid-cols-2 sm:grid-cols-4 gap-2`).
- Sleep, Hydration, BBT and Weight controls adapt to responsive side-by-side pairs (`grid-cols-1 sm:grid-cols-2 gap-2.5`).

#### 5. Analytics Dashboard Grid (`insights-view.tsx` & `advanced-analytics.tsx`)
- Core analytics charts (Cycle Lengths, Sex Drive by Phase, Pain & Symptoms by Phase, Flow Shape) now arrange in a 2-column responsive dashboard grid (`grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5 items-stretch`).
- Charts scale with responsive heights (`h-48 md:h-52`).
- Body Pattern Correlations in AdvancedAnalytics adapt to a 3-column responsive grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3`).
- Basal Body Temperature chart container expanded with responsive scaling (`h-56 md:h-72 lg:h-80 w-full`).

#### 6. Settings Console & Clinical Report (`settings-view.tsx` & `doctor-report.tsx`)
- Settings sections organized into a balanced 2-column console on tablet/laptop (`grid-cols-1 md:grid-cols-2 gap-5 items-start`).
- Modal dialogs adjusted to responsive width (`w-[92vw] max-w-sm sm:max-w-md rounded-2xl`).
- Doctor Report expanded to `max-w-3xl lg:max-w-4xl` with horizontal scroll wrapper (`overflow-x-auto nice-scroll`) on the 6-column episode history table to prevent mobile blowout.
- Form inputs across auth and bootstrap views enforce minimum 16px font sizes to prevent mobile Safari auto-zooming.

---

## [0.3.2] — 2026-10-31

### 🔒 Critical Security Patch: Eradication of Hardcoded Default Vault PIN & Setup Onboarding Enforcement

#### 1. Zero Hardcoded PINs in Auth Layer (`login/page.tsx` & `api/auth/login/route.ts`)
- Removed the development shortcut that previously auto-initialized the vault with PIN `2007` when no secret existed.
- `src/app/(auth)/login/page.tsx` now checks `!(await store.getSecret())` and redirects visitors straight to `/setup`.
- `POST /api/auth/login` returns `HTTP 400 - "Vault has not been initialized yet. Please complete setup first."` if called against an uninitialized vault. Attempting to brute-force or use `2007` fails outright.

#### 2. Enforced First-Time Setup Flow (`/setup`)
- Every new deployment (Vercel / Supabase) and clean database state now strictly routes through the secure `SetupForm` (`/setup`), ensuring users create and confirm their own private numerical PIN.

#### 3. Seed & Test Automation Hardening (`seed.ts` & `browser-test.mjs`)
- `scripts/seed.ts` now inspects `process.env.SEED_VAULT_PIN` or `process.env.VAULT_PIN`, leaving the vault uninitialized for first-time user setup if no PIN is explicitly provided.
- `scripts/browser-test.mjs` dynamically detects whether the app is in `/setup` or `/login` mode and supports `process.env.TEST_VAULT_PIN`.

#### 4. Local Database Sanity
- Local development store (`.data/db.json`) secret was cleared, enforcing the setup screen on local development while preserving all period histories, daily entries, and settings.

---

## [0.3.4] — 2026-10-31

### 🧹 Period Cycle Clearing, Calendar Real-Time Un-Highlight & Settings Adjustment

#### 1. Period Cycle Clearing on Day Clear (`/api/days` & `day-sheet.tsx`)
- Fixed bug where clearing a day only deleted the `day_entries` row without updating or removing the period episode in `period_logs`, which caused the calendar to still highlight the date as logged.
- `DELETE /api/days`:
  - Clearing the **first date** of a period episode now automatically deletes the entire period episode from `period_logs` and cascades cleanup to all auto-logged following days.
  - Clearing an **intermediate or ending day** shortens the period episode to end the day before, cleaning up any trailing days.
- Setting flow to `none` or `null` in `POST` / `PATCH` `/api/days` applies the same intelligent cascade, removing or shortening the period episode accordingly.

#### 2. Immediate Calendar Un-Highlighting (`calendar-grid.tsx`)
- Added `handleDayCleared` callback to `CalendarGrid` passed into `DaySheet`.
- Tapping "Clear" or selecting `None` flow now immediately removes the red period highlight from the cleared date and all following period days with zero reload lag.

#### 3. Robust Period Cycle Length Adjustment (`period-actions.tsx` & `api-helpers.ts`)
- Fixed root cause of `"couldnt update the period lenght"` error:
  - Enhanced `isSameOrigin` CSRF validation in `src/lib/api-helpers.ts` to recognize browser `Sec-Fetch-Site: same-origin` headers and interoperate between loopback addresses (`localhost` and `127.0.0.1`).
  - Extracted specific server error messages in `PeriodActions.saveLength()`.
  - Wrapped ongoing period episode synchronization in non-fatal handling so settings updates always succeed.

---

## [0.3.3] — 2026-10-31

### 🩸 Comprehensive Auto-Logging of Following Period Days & Calendar State Sync

#### 1. Universal Automatic Multi-Day Period Logging (`/api/days` & `day-sheet.tsx`)
- Fixed critical gap where logging flow in `DaySheet` (accessed via Calendar date tap or Today "Log today") only wrote to a single day entry without initiating a period episode or auto-logging following days.
- Extended `POST /api/days` and `PATCH /api/days` with `is_period_start` and `period_length`.
- When menstrual flow (`light`, `medium`, `heavy`) is logged or `is_period_start: true`, the system automatically inserts/updates the period episode in `period_logs` (`end_date = start_date + period_length - 1`), auto-upserts `day_entries` for all following days across the period cycle length, and synchronizes predictions.
- Added a dedicated, interactive "Period start date" banner in `DaySheet` with an inline cycle length stepper (`[-] {periodLen}d [+]`), allowing instant adjustment of how many days are auto-logged.

#### 2. Optimistic Instant Updates in Calendar Grid (`calendar-grid.tsx`)
- Added local optimistic state management in `CalendarGrid` for `episodes` and `entries`.
- When a user logs a period date in `DaySheet`, all `period_length` days immediately turn into solid period red (`#E11D48`) without any delay, flicker, or cache latency.
- Injected `settings.period_length` from `CalendarPage` down to `CalendarGrid` and `DaySheet`.

#### 3. Seamless Upsert in Period API & Ongoing Episode Priority
- Added `upsert?: boolean` option to `POST /api/periods`, eliminating 409 Conflict errors when re-starting or updating a period starting on an existing date.
- Adjusted ongoing episode lookup in `src/app/(app)/page.tsx` to search newest episodes first (`reverse().find`).
- Adjusting period length on an ongoing episode in `PeriodActions` now immediately syncs and resizes the active period's end date.

---

## [0.3.2] — 2026-10-31

### 📅 Calendar Accuracy & Multi-Month Forward Projections
- Fixed October 31 missing bug via `getDaysInMonth(yearMonth)` using `Date.UTC`.
- Fixed ovulation dot indicator condition in `CalendarGrid`.
- Added multi-month forward predictions (upcoming periods, fertile windows, and ovulation) projected 3 cycles forward.

---

### ✏️ Today Log Editing & System Workflow Enhancements

#### 1. Dynamic "Edit Today's Log" & Logged Preview Card (`period-actions.tsx`)
- When an entry is already logged for today, the action button dynamically converts from `"Log today"` to `"Edit today's log"` with a `PencilLine` icon.
- Added a dedicated **"Logged for Today"** preview card on "Her View" rendering live summary chips for recorded flow, mood, energy, libido, symptoms, and sleep hours, with an explicit 1-tap **"Edit"** button.
- Tapping opens the `DaySheet` drawer pre-populated with all saved metrics for seamless updating or clearing.

#### 2. Day Sheet Drawer Polish (`day-sheet.tsx`)
- Drawer header dynamically displays an `"Editing Entry"` badge when modifying an existing logged day.
- Primary CTA updates dynamically to `"Update entry"` (instead of generic `"Save day"`) when updating a day entry.
- Maintained the `"Clear"` action allowing users to wipe entries cleanly.

#### 3. Standardized Markdown Maintenance Protocol
- Added mandatory repository rule across system markdown files: *"After making changes, update all the system markdown files & then push everything to github"*.

---

## [0.3.0] — 2026-10-30

### 🚀 Major Feature Additions

#### 1. 💑 Partner View & Daily Care Guide (The "Two-Person" Experience)
- Added an instant perspective switcher on the Today screen (`[ 🌸 Her View | 🤝 Partner Care ]`).
- Biological phase-specific care advice for partners covering hormonal dynamics, actionable comfort tips, and topics to avoid.
- Real-time symptom awareness: automatically surfaces logged symptoms (cramps, headaches, fatigue) with targeted relief steps.
- Pre-crafted caring check-in messages with 1-tap clipboard copy.

#### 2. 📅 Calendar Integration (.ics Export & Alarms)
- Implemented `/api/calendar/ics` route generating standard RFC 5545 iCalendar feeds.
- Exports past period history, upcoming 3-cycle predictions with 1-day advance reminder alarms, fertile windows, and PMS heads-up alerts.
- Integrated 1-tap download buttons in both `CalendarGrid` and `SettingsView` (Data Portability).

#### 3. 📊 Advanced Health Charts & Analytics
- Added **Basal Body Temperature (BBT)** tracking chart with unit switching (°C / °F) and baseline reference indicator.
- Integrated **Correlation Intelligence Engine**: identifies recurring rhythms such as cramp peak day and estrogen-drop headaches.
- Added **Cycle-by-Cycle Comparison**: side-by-side assessment of the last 6 cycles against historical averages with outlier tagging.

#### 4. 🩺 Clinical Doctor Summary Report (Print & PDF)
- Created `/report` clinical report page formatted for OB/GYN and primary care consultations.
- Includes vital menstrual parameters, chronological cycle logs table, symptom incidence frequency, and physician consultation notes.
- Configured print-optimized CSS (`@media print`) for clean single/two-page PDF generation via system print dialog.

#### 5. ⚡ Quick-Log Enhancements & Lifestyle Tracking
- Added 1-tap symptom presets in `DaySheet`: *High Energy*, *Cramp & Rest*, *PMS Comfort*, *Gentle Reset*.
- Added sleep hours and water intake stepper.
- Added quick hashtag pills (`#heatingpad`, `#painkiller`, `#tea`, `#yoga`, etc.) that toggle directly into journal entries.

#### 6. 🎨 Aesthetic Theme Palettes & Discreet Privacy Mode
- Introduced 4 curated color palettes: **Rose** (signature), **Lavender** (calming violet), **Sage** (botanical green), **Terracotta** (earthy clay).
- Added **Discreet Privacy Mode**: disguises the application header to *"Personal Notes"* with a minimalist journal icon for privacy in public spaces.

#### 7. 📚 Comprehensive System Documentation
- Added `ARCHITECTURE.md`, `API.md`, `CONTRIBUTING.md`, `DEPLOYMENT.md`, `SECURITY.md`, and `CHANGELOG.md`.

---

## [0.2.1] — Earlier Releases
- Pure prediction engine with MAD outlier rejection and exponential recency weighting.
- Argon2id passphrase hashing and HMAC-SHA256 session management with sliding refresh.
- Dual storage architecture supporting local file store and Supabase Postgres.
- Offline-first mutation queue with automatic reconnect synchronization.

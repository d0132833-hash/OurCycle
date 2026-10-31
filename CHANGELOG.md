# Changelog — Our Cycle

All notable changes and architectural features introduced to the Our Cycle codebase are documented here.

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

## [0.3.1] — 2026-10-31

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


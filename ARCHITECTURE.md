# System Architecture — Our Cycle

Our Cycle is a private, two-person cycle tracking Progressive Web Application (PWA) built with **Next.js 16 (App Router)**, **React 19**, **Tailwind CSS v4**, and **TypeScript**. It is designed with an uncompromising offline-first, privacy-first, zero-telemetry architecture.

---

## 1. High-Level Architectural Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Device                         │
│  ┌─────────────────────────┐   ┌─────────────────────────┐  │
│  │   PWA Service Worker    │   │      Offline Queue      │  │
│  │   (App-shell Cache)     │   │     (localStorage)      │  │
│  └─────────────────────────┘   └─────────────────────────┘  │
│              ▲                              ▲               │
│              │ (Asset Cache)                │ (Sync On-Line)│
│              ▼                              ▼               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │               Next.js UI (React 19)                   │  │
│  │   • Today / Partner Care    • Calendar Grid           │  │
│  │   • Insights & Analytics    • Settings & Themes       │  │
│  │   • Clinical Doctor Report  • Day Sheet Drawer        │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON API
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Edge / Server                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │      Edge Middleware (Session HMAC & noindex)         │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │      API Route Handlers & Server Components           │  │
│  │      • Auth & Vault Rotation   • Periods & Days CRUD  │  │
│  │      • Predictions Engine      • Calendar .ics Feed   │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                              │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │            Pure Mathematical Engine                   │  │
│  │      (Zero I/O, MAD Outlier Rejection, Recency)       │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              Storage Abstraction Layer                │  │
│  │      (Store Interface: LocalFileStore / SupabaseStore)│  │
│  └───────────────────────────┬───────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌─────────────────────────┐           ┌─────────────────────────┐
│     Local Dev Store     │           │    Production Database  │
│     (.data/db.json)     │           │   (Supabase PostgreSQL  │
│   Zero external deps    │           │     RLS Deny-All)       │
└─────────────────────────┘           └─────────────────────────┘
```

### F. Responsive Multi-Viewport Architecture
- **Fluid Shell Boundaries**: Adapts seamlessly from mobile phone widths (`max-w-md`) to iPad/tablet (`max-w-4xl`) and desktop/laptop displays (`max-w-6xl`).
- **Dual Navigation Flow**: Mobile devices render an ergonomic bottom navigation bar with safe-area support; tablet and laptop viewports automatically hide the bottom bar and elevate navigation to a frosted top header bar with pill active indicators and a Doctor Report shortcut.
- **Adaptive Multi-Column Views**: Stacks single-column on mobile phones and expands to 2-column or 3-column dashboard grids on tablet and desktop across the Today screen, Partner Care Companion, Insights charts, and Settings console.

---

## 2. Core Architectural Pillars

### A. Pure Prediction Engine (Zero I/O)
All forecasting and biological cycle calculations reside in `src/lib/predictions.ts`.
- **Zero Side Effects**: The engine accepts pure data structures and returns deterministic prediction objects.
- **Outlier Rejection**: Modified Z-score using Median Absolute Deviation (MAD, $|z| > 3.5$) filters anomalous cycles caused by illness, surgery, or travel.
- **Recency-Weighted Mean**: Applies exponential decay with a half-life of 4 cycles ($w_i = 0.5^{\text{age}/4}$).
- **Uncertainty Quantification**: 80% prediction interval calculated as $\text{mean} \pm \max(1.28\sigma, 1)$ days, clamped to $\pm 7$ days.
- **Phase Mapping**: Determines follicular, ovulatory, and luteal windows relative to predicted anchor dates.

### B. Storage Abstraction Layer
The application operates against a uniform `Store` interface (`src/lib/storage.ts`):
- **`LocalFileStore` (`src/lib/local-store.ts`)**: Enables immediate zero-configuration local development using `.data/db.json` (or in-memory `:memory:` for unit tests).
- **`SupabaseStore` (`src/lib/supabase-store.ts`)**: Used in production with the Supabase PostgreSQL database using the `service_role` key. All tables enforce Row-Level Security (RLS) with zero policies (deny-all) so client keys can never read records directly.

### C. Offline-First & Progressive Web App (PWA)
- **Privacy-First Service Worker (`public/sw.js`)**: Caches static immutable bundles (JS, CSS, fonts, icons) and the generic `/offline` shell. Authenticated HTML navigation streams containing private reproductive logs are never persisted to `CacheStorage`.
- **Vault Lock Eviction**: Signing out actively clears all browser `CacheStorage` instances and purges pending mutation queues in `localStorage`.
- **Mutations Queue (`src/lib/client/offline-queue.ts`)**: Day logs and period episode writes performed while offline are enqueued in `localStorage` and automatically flushed in chronological order upon reconnect.

### D. Multi-Perspective & Care System
- **Her View (`src/components/app/today-view.tsx`, `period-actions.tsx`)**: Focuses on symptom logging, cycle tracking, countdown forecasting, and real-time entry editing. When an entry has been recorded for today, the primary button switches dynamically to *"Edit today's log"* and renders a *"Logged for Today"* preview card with symptom chips, linking to the pre-filled `DaySheet` drawer for instant updates or clears.
- **Partner View (`src/components/app/partner-view.tsx`)**: Translates biological phase changes into actionable empathy guidance, real-time symptom alerts, and unprompted support suggestions.

### E. Cryptography & Vault Security
- **Argon2id Hashing**: Passphrases and numerical PINs (minimum 4 digits, up to 32 digits) are hashed using OWASP-compliant parameters ($m=19456$, $t=2$, $p=1$) via `@noble/hashes` with constant-time verification.
- **Zero Default Passwords**: There are no hardcoded default passwords or backdoors. Uninitialized vaults enforce first-run onboarding at `/setup` with optional `SETUP_TOKEN` gating.
- **Session HMAC & Epoch Rotation**: Session cookies (`oc_session`) carry HMAC-SHA256 signatures with 30-day sliding refresh and an internal `session_epoch`. Rotating the vault PIN bumps the epoch, immediately invalidating all active cookies across all devices.
- **Per-IP Brute-Force Rate Limiting & DoS Prevention**: 5 failed login attempts from an IP locks that specific IP for 10 minutes, preventing an external attacker from locking out the legitimate vault owners.
- **Sudo Mode on Destructive Operations**: `POST /api/reset` requires re-verifying the current vault PIN before permanently clearing health records.
- **Defensive Browser Headers & Anti-Clickjacking**: Enforces `X-Frame-Options: DENY`, `Content-Security-Policy: ... frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, and `X-Robots-Tag: noindex, nofollow, noarchive`.

### F. Responsive Multi-Viewport Architecture
- **Fluid Shell Boundaries**: Adapts seamlessly from mobile phone widths (`max-w-md`) to iPad/tablet (`max-w-4xl`) and desktop/laptop displays (`max-w-6xl`).
- **Dual Navigation Flow**: Mobile devices render an ergonomic bottom navigation bar with safe-area support; tablet and laptop viewports automatically hide the bottom bar and elevate navigation to a frosted top header bar with pill active indicators and a Doctor Report shortcut.
- **Adaptive Multi-Column Views**: Stacks single-column on mobile phones and expands to 2-column or 3-column dashboard grids on tablet and desktop across the Today screen, Partner Care Companion, Insights charts, and Settings console.

---

## 3. Directory Layout

```
OurCycle/
├── public/                 # Static assets, PWA icons, sw.js, robots.txt
├── src/
│   ├── app/                # Next.js 16 App Router
│   │   ├── (auth)/         # Login, First-run setup routes
│   │   ├── (app)/          # Protected app shell: Today, Calendar, Insights, Settings, Report
│   │   ├── api/            # 11 REST API route handlers
│   │   ├── layout.tsx      # Root layout with fonts & ThemeProvider
│   │   └── manifest.ts     # Dynamic Web App Manifest
│   ├── components/
│   │   ├── app/            # Domain components (TodayView, PartnerView, AdvancedAnalytics, etc.)
│   │   ├── ui/             # Radix UI + Tailwind component library
│   │   └── pwa/            # Service worker registration
│   └── lib/                # Pure logic, cryptography, storage adapters, date utilities
├── supabase/
│   └── migration.sql       # Canonical database schema & RLS definitions
├── scripts/                # Seed script, PWA icon generator, viewport & browser tests
└── tests/                  # Pure Vitest unit and integration test suites
```

### Clean Architecture & Decoupled Tooling
- **Zero Template Clutter**: Stripped of legacy scaffolding artifacts (`.zscripts`, `Caddyfile`, `prisma/`, `mini-services/`, `examples/`).
- **Lean Dependency Footprint**: Removed ~350 redundant node modules, focusing strictly on Next.js 16, React 19, Tailwind CSS 4, Radix primitives, Recharts, and Supabase.
- **Lightweight Source Control**: Test execution screenshots and local data stores are untracked via `.gitignore`, keeping the repository compact and portable.
- **Per-Route Streaming & Loading Hierarchy**: Route-tailored `loading.tsx` skeletons for `/calendar` (month grid), `/insights` (analytics charts), `/settings` (settings console), and `/report` (clinical sheet) eliminate visual layout jump and replace generic countdown ring skeletons.
- **Care Shopping Tag Protocol**: Custom shopping items sync transparently across partners via the shared vault using `shop:<name>` (active) and `shop:done:<name>` (checked off) in `day_entries.tags`.
- **Social Battery Self-Adjustment Protocol**: If algorithmic estimates feel inaccurate, her real-time social battery can be adjusted directly in the Partners tab and synced via `battery:override:<percentage>` in `day_entries.tags`, with live feedback and 1-tap auto reset.

---

## 4. Maintenance & Repository Lifecycle Rule

> **Mandatory Developer Rule**: After making changes, update all the system markdown files (`README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `worklog.md`, `CONTRIBUTING.md`) & then push everything to github.



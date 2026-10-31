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
- **App-Shell Service Worker (`public/sw.js`)**: Network-first strategy for navigation with instant offline fallback, cache-first for immutable static bundles.
- **Mutations Queue (`src/lib/client/offline-queue.ts`)**: Day logs and period episode writes performed while offline are enqueued in `localStorage` and automatically flushed in chronological order upon reconnect.

### D. Multi-Perspective & Care System
- **Her View (`src/components/app/today-view.tsx`, `period-actions.tsx`)**: Focuses on symptom logging, cycle tracking, countdown forecasting, and real-time entry editing. When an entry has been recorded for today, the primary button switches dynamically to *"Edit today's log"* and renders a *"Logged for Today"* preview card with symptom chips, linking to the pre-filled `DaySheet` drawer for instant updates or clears.
- **Partner View (`src/components/app/partner-view.tsx`)**: Translates biological phase changes into actionable empathy guidance, real-time symptom alerts, and unprompted support suggestions.

### E. Cryptography & Vault Security
- **Argon2id Hashing**: Passphrases and numerical PINs are hashed using OWASP-compliant parameters ($m=19456$, $t=2$, $p=1$) via `@noble/hashes`.
- **Zero Default Passwords**: There are no hardcoded default passwords or backdoors. Uninitialized vaults automatically enforce first-run onboarding at `/setup`.
- **Session HMAC & Epoch Rotation**: Session cookies (`oc_session`) carry HMAC-SHA256 signatures with 30-day sliding refresh and an internal `session_epoch`. Rotating the vault PIN bumps the epoch, immediately invalidating all active cookies across all devices.

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
└── tests/                  # Vitest comprehensive unit test suites
```

---

## 4. Maintenance & Repository Lifecycle Rule

> **Mandatory Developer Rule**: After making changes, update all the system markdown files (`README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `worklog.md`, `CONTRIBUTING.md`) & then push everything to github.



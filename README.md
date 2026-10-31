# Our Cycle

A private, two-person menstrual cycle tracker, installed as a PWA straight from the browser. All data lives in **your own** Supabase project; one shared passphrase ("vault code") protects everything.

**Priority order (strict):** prediction accuracy → daily logging & insights → security & privacy → UI polish.

---

## The prediction engine

`src/lib/predictions.ts` is a **pure TypeScript module with zero I/O** — all functions take data in and return results, and it is covered by unit tests (`npm test`):

- Cycle lengths derived from consecutive starts, clamped to 21–45 days (out-of-range values are kept in history but flagged)
- Outlier rejection via **modified Z-score / MAD** (|z| > 3.5), so illness/travel spikes don't wreck the forecast
- **Recency-weighted mean** with exponential decay, half-life = 4 cycles
- 80% prediction interval = mean ± max(1.28σ, 1) days, capped at ±7
- Cold start: bootstrap "typical length" enters as a low-weight prior
- Sparse data (1–2 completed cycles): shrinkage `0.6 × hers + 0.4 × 28`
- Ovulation = next start − 14 · fertile window −5 → +1 · PMS window −5 → 0
- σ ≥ 3 → **irregular mode**: every date renders as a range, never a single date
- Today > predicted start + 10 → calm "No period logged yet" state (never "late" in red)
- Manual override ("Use fixed cycle length") bypasses learning while still reporting what auto-learn would predict
- Every add/edit/delete of a period triggers a full recompute; forecast accuracy is measured in `prediction_log` and surfaced as *"Model accuracy: X/6 within ±1 day"* on Insights

---

## 10-minute deploy runbook

### 1. Supabase (≈4 min)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the whole contents of [`supabase/migration.sql`](supabase/migration.sql), press **Run**. It creates all six tables and enables deny-all RLS on every one.
3. Collect two values: **Project Settings → API** → `Project URL` and `service_role` secret (**not** the anon key).

### 2. Vercel (≈4 min)

1. Push this repo to GitHub, then **Add New Project** on [vercel.com](https://vercel.com) and import it. Framework preset: Next.js (defaults are fine).
2. Add **exactly three environment variables** (Settings → Environment Variables):

   | Name                  | Value                        |
   | --------------------- | ---------------------------- |
   | `SUPABASE_URL`        | your Project URL             |
   | `SUPABASE_SERVICE_KEY`| your `service_role` secret   |
   | `SESSION_SECRET`      | any long random string (`openssl rand -hex 32`) |

3. Deploy. The service-role key is used **only** inside server routes — it is never shipped to the browser.

### 3. First-run setup (≈1 min)

1. Open the deployed URL → you are automatically redirected to `/setup` to create and confirm your own private numerical PIN (there are no hardcoded default passwords). It is stored strictly as an **Argon2id** hash in `app_secrets`.
2. You're redirected to Today → the bootstrap form asks for the first day of the last period + typical cycle length (slider 21–45, default 28). Predictions start immediately and sharpen with every log.

### 4. Install as an app (Add to Home Screen)

- **iPhone/iPad:** open in Safari → Share → **Add to Home Screen**.
- **Android:** open in Chrome → ⋮ menu → **Add to Home screen / Install**.

It then runs full-screen with an app-shell cache; day logs made offline are queued on-device and sync automatically on reconnect.

---

## Demo data (optional)

Eight realistic cycles (27–31 days, one 34-day outlier) plus ~8 months of daily logs, so charts, accuracy card and irregular handling are instantly explorable:

```bash
npm run seed            # local dev store (or: bun run seed)
# or against your Supabase project:
SUPABASE_URL=… SUPABASE_SERVICE_KEY=… npm run seed
```

If data already exists the script refuses; for a fresh run, truncate first (`TRUNCATE period_logs, day_entries, prediction_log;` in the Supabase SQL editor) or delete `.data/db.json` locally.

---

## Local development

```bash
npm install        # or: bun install
npm run dev        # http://localhost:3000
npm test           # prediction engine unit tests (vitest)
npm run lint
```

Without Supabase env vars the app transparently falls back to a JSON file store (`.data/db.json`, gitignored) with identical semantics — handy for trying everything without a cloud project. In production the env vars are always present, so that path is dead code.

`next/font` self-hosts Fraunces + DM Sans at build time; there are no external font CDNs, no analytics, no trackers.

---

## Multi-Device & Viewport Optimization

Our Cycle features an adaptive interface specifically optimized across **Mobile**, **Tablet**, and **Laptop/Desktop** screens:

- **Mobile Viewports (<768px)**:
  - Ergonomic 1-thumb interaction: bottom navigation bar with safe-area insets (`env(safe-area-inset-bottom)`), active indicators, and haptic feedback.
  - Smooth bottom sheet drawers (`Drawer`) for day logging and symptom presets.
  - Swipe gestures for monthly calendar navigation.
  - Minimum 16px input font sizing preventing unwanted iOS Safari auto-zooming.
- **Tablet Viewports (768px–1024px)**:
  - Container expands fluidly to `max-w-4xl px-6`.
  - Bottom navigation bar hides automatically; sleek frosted top navigation bar appears in the header with active pills and quick link to Doctor Report.
  - Today view activates a 2-column layout: sticky hero countdown ring on the left, action cards & partner signals on the right.
  - Calendar day cells expand to `sm:h-12 sm:w-12` with comfortable touch targets.
  - Insights charts and settings forms adapt to balanced 2-column grids.
- **Laptop & Desktop Viewports (1024px+)**:
  - Container expands to `max-w-6xl px-8`.
  - Executive-level dashboard layouts for both Her View and Partner Care Companion.
  - Full-width analytics with 2-column chart grids and responsive heights (`h-48 md:h-52`, BBT `h-72`).
  - Clinical Doctor Report formatted with clean printable sheets and scroll-protected tables.
  - Dedicated route-tailored loading skeletons across all views (Calendar month grid, Insights chart dashboard, Settings console, and Clinical summary table).
  - Integrated Care & Comfort Shopping Wishlist: she can request treats and comfort supplies directly from Her View or inside the Partner Care Companion checklist, with bi-directional vault sync.

---

## Workflow & Pushing Changes to GitHub

> **Core Rule**: After making changes, update all the system markdown files (`README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `worklog.md`, `CONTRIBUTING.md`) & then push everything to github.

After making code updates, styling tweaks, or new features, follow these steps to verify, document, and push everything to GitHub:

1. **Run tests and build verification:**
   ```bash
   npm test        # or: bun test
   npm run build   # verifies Next.js compilation and type safety
   ```

2. **Update all system markdown files:**
   After making changes, update all the system markdown files to reflect new features, UI enhancements, and work logs before pushing.

3. **Stage modified and new files:**
   ```bash
   git add .
   ```

4. **Check staged files:**
   ```bash
   git status
   ```

5. **Commit with a descriptive message:**
   ```bash
   git commit -m "feat: description of changes"
   ```

6. **Push everything to GitHub:**
   ```bash
   git push origin main
   ```

> **Note on SSH Key**: If using the repository-specific key, git uses `core.sshCommand = "ssh -i ~/.ssh/id_ourcycle -o IdentitiesOnly=yes"`.

---

## API surface (all server-side, 401 without a valid session)

| Route | Methods | Notes |
| --- | --- | --- |
| `/api/auth/setup` | POST | first run only, creates the vault |
| `/api/auth/login` | POST | 5 fails → 10-min lock, generic errors |
| `/api/auth/logout` | POST | clears the cookie |
| `/api/auth/rotate` | POST | re-hash + bump epoch → all old sessions die |
| `/api/periods` | GET / POST / PATCH / DELETE | every write recomputes predictions + `prediction_log` |
| `/api/days` | GET / POST / PATCH / DELETE | merge-upsert, one record per day |
| `/api/predictions` | GET | fresh prediction + accuracy report |
| `/api/settings` | GET / PATCH | override / timezone / bootstrap prior |
| `/api/calendar/ics` | GET | RFC 5545 calendar feed with reminders |
| `/api/partner/calendar` | GET | discreet partner companion calendar feed |
| `/api/export` | GET | complete JSON or CSV data backup |
| `/report` | GET | printable / PDF clinical summary for doctors |

Session: HMAC-SHA256-signed token in an `httpOnly · Secure · SameSite=Strict` cookie, 30-day sliding refresh. `src/proxy.ts` (Next.js 16 convention) guards every page and API path. `noindex` is enforced three ways: meta tag, `X-Robots-Tag` header, `robots.txt` disallow-all.

---

## Schema notes (deliberate, documented extensions)

`supabase/migration.sql` matches the spec exactly, plus two columns the features require:

- `app_secrets.session_epoch` — bumped on vault rotation so every previously issued cookie becomes invalid (acceptance criterion 8).
- `settings.bootstrap_cycle_length` — stores the cold-start "typical length" prior so the pure engine can use it as a low-weight observation.

## Acceptance criteria — where to verify

1. Engine unit tests incl. outlier/clamping/shrinkage/cold-start/recency → `bun test`
2. σ ≥ 3 → ranges only, no single date in UI → set override off, log irregular data (or see seeded mode) → Today/Calendar render ranges
3. Accuracy card counts from `prediction_log` fixtures → seeded data shows **5/6 within ±1 day**
4. API 401 without session / RLS deny-all → `curl` any route (401); RLS has zero policies in the migration
5. 5 failed logins → 10-min lock, generic copy → try it on `/login`
6. `noindex` meta + header + robots.txt → inspect any response
7. Rotation invalidates previous cookie → Settings → change vault code
8. PWA installable, offline queue → Lighthouse PWA audit on the deployed URL; airplane-mode a day log and watch it sync
9. `npm run build` clean; deploys with exactly 3 env vars → Vercel

## Project layout

```
src/lib/predictions.ts      ← PRIORITY 1: pure prediction engine
src/lib/{dates,types}.ts    ← day-safe date math + domain types
src/lib/{storage,db}.ts     ← Store interface + Supabase/local adapters
src/lib/{crypto,session-edge,api-auth,lockout}.ts
src/proxy.ts                ← edge guard + noindex + sliding refresh
src/app/(auth)/…            ← /login, /setup
src/app/(app)/…             ← Today, Calendar, Insights, Settings
src/app/api/…               ← the eight route groups above
public/sw.js                ← app-shell service worker
supabase/migration.sql      ← paste into Supabase SQL editor
scripts/seed.ts             ← demo data generator
tests/predictions.test.ts   ← engine unit tests
```

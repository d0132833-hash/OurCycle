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

1. Open the deployed URL → you land on **"Set your vault code"** (min 10 chars, strength meter). It is stored only as an **Argon2id** hash in `app_secrets`.
2. You're redirected to Today → the bootstrap form asks for the first day of the last period + typical cycle length (slider 21–45, default 28). Predictions start immediately and sharpen with every log.

### 4. Install as an app (Add to Home Screen)

- **iPhone/iPad:** open in Safari → Share → **Add to Home Screen**.
- **Android:** open in Chrome → ⋮ menu → **Add to Home screen / Install**.

It then runs full-screen with an app-shell cache; day logs made offline are queued on-device and sync automatically on reconnect.

---

## Demo data (optional)

Eight realistic cycles (27–31 days, one 34-day outlier) plus ~8 months of daily logs, so charts, accuracy card and irregular handling are instantly explorable:

```bash
bun run seed            # local dev store
# or against your Supabase project:
SUPABASE_URL=… SUPABASE_SERVICE_KEY=… bun run seed
```

If data already exists the script refuses; for a fresh run, truncate first (`TRUNCATE period_logs, day_entries, prediction_log;` in the Supabase SQL editor) or delete `.data/db.json` locally.

---

## Local development

```bash
bun install
bun run dev        # http://localhost:3000
bun test           # prediction engine unit tests (vitest)
bun run lint
```

Without Supabase env vars the app transparently falls back to a JSON file store (`.data/db.json`, gitignored) with identical semantics — handy for trying everything without a cloud project. In production the env vars are always present, so that path is dead code.

`next/font` self-hosts Fraunces + DM Sans at build time; there are no external font CDNs, no analytics, no trackers.

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

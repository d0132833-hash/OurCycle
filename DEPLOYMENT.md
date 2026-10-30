# Deployment Runbook — Our Cycle

This document describes the complete deployment process for Our Cycle to **Vercel + Supabase**, as well as standalone self-hosted Docker environments.

---

## 1. Quick Vercel + Supabase Deployment (Recommended)

### Step 1: Prepare Supabase Project (≈3 minutes)
1. Log in to [supabase.com](https://supabase.com) and create a new project.
2. Open the **SQL Editor** in the left sidebar, click **New query**.
3. Copy the entire contents of [`supabase/migration.sql`](supabase/migration.sql) and paste it into the editor.
4. Click **Run**.
   - This creates all required tables: `app_secrets`, `login_throttle`, `period_logs`, `day_entries`, `prediction_log`, and `settings`.
   - It enables Row-Level Security (RLS) with zero policies (deny-all) across all tables.
5. In **Project Settings → API**, copy:
   - **Project URL** (e.g. `https://xyzcompany.supabase.co`)
   - **`service_role` secret key** (*not* the anon public key).

### Step 2: Deploy to Vercel (≈3 minutes)
1. Push your repository to GitHub.
2. In [vercel.com](https://vercel.com), click **Add New Project** and import the repository.
3. Under **Environment Variables**, configure the 3 required variables:

| Variable Name | Description | Example |
|---|---|---|
| `SUPABASE_URL` | Supabase Project URL | `https://yourproject.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase `service_role` Secret | `eyJhbGciOi...` (secret role key) |
| `SESSION_SECRET` | 32+ character random encryption string | `openssl rand -hex 32` |

4. Click **Deploy**.

---

## 2. Troubleshooting Common Issues

### Issue: "Something went wrong" (500 Internal Server Error) on `/login` or `/setup`
- **Cause 1**: The database migration has not been run. Supabase returns `relation "public.app_secrets" does not exist`.
  - **Resolution**: Open Supabase SQL Editor and run `supabase/migration.sql`.
- **Cause 2**: The `anon` public key was entered instead of the `service_role` secret in Vercel.
  - **Resolution**: RLS deny-all blocks the anon key. Update `SUPABASE_SERVICE_KEY` in Vercel to the secret key found under Supabase Project Settings → API.
- **Cause 3**: `SESSION_SECRET` is missing in Vercel environment variables.
  - **Resolution**: In production mode, Next.js throws an error if `SESSION_SECRET` is undefined. Add any 32+ char random string in Vercel settings and redeploy.

---

## 3. Self-Hosting (Docker / Standalone Node)

Our Cycle can be deployed on any server (VPS, Railway, Fly.io, or Raspberry Pi) using standalone output:

```bash
# Build the standalone bundle
bun run build:standalone
# or:
npm run build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/

# Run the production server
cd .next/standalone
NODE_ENV=production node server.js
```

### Self-Hosted Local Mode (Without Supabase)
If `SUPABASE_URL` is omitted, the application operates against `.data/db.json` locally on the server filesystem. Make sure the `.data/` directory has write permissions.


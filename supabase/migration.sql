-- ============================================================
-- Our Cycle — Supabase migration
-- Paste this whole file into: Supabase Dashboard → SQL Editor → Run
--
-- Security model: Row Level Security is ENABLED on every table with
-- ZERO policies => deny-all for anon/authenticated roles. The app only
-- ever talks to Postgres from Next.js server routes using the
-- service-role key (which bypasses RLS). The browser never sees the DB.
--
-- Two small, deliberate extensions beyond the base spec (marked below):
--   1. app_secrets.session_epoch   -> invalidates all sessions when the
--      vault code is rotated (acceptance criterion 8).
--   2. settings.bootstrap_cycle_length -> stores the cold-start
--      "typical length" prior so the prediction engine can use it as a
--      low-weight observation until real cycles are learned.
-- ============================================================

create table if not exists period_logs (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  end_date date,                      -- null = ongoing
  flow text check (flow in ('spotting','light','medium','heavy')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- Prevent two episodes starting on the same day (double-tap protection)
create unique index if not exists period_logs_start_date_key on period_logs (start_date);
create index if not exists period_logs_start_date_idx on period_logs (start_date);

create table if not exists day_entries (
  date date primary key,
  flow text check (flow in ('none','spotting','light','medium','heavy')),
  mood int check (mood between 1 and 5),
  energy int check (energy between 1 and 5),
  libido int check (libido between 1 and 5),
  cramps int check (cramps between 0 and 3),
  headache int check (headache between 0 and 3),
  back_pain int check (back_pain between 0 and 3),
  breast_tenderness int check (breast_tenderness between 0 and 3),
  acne int check (acne between 0 and 3),
  bloating int check (bloating between 0 and 3),
  fatigue int check (fatigue between 0 and 3),
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Powers the accuracy self-report ("Model accuracy: 5/6 within ±1 day")
create table if not exists prediction_log (
  id uuid primary key default gen_random_uuid(),
  anchor_start date not null,        -- cycle start this forecast was made from
  predicted_start date not null,
  range_low date,
  range_high date,
  made_at timestamptz default now(),
  actual_start date                  -- filled when the real period starts
);
create index if not exists prediction_log_anchor_idx on prediction_log (anchor_start);
create index if not exists prediction_log_made_at_idx on prediction_log (made_at desc);

create table if not exists settings (
  id int primary key default 1,
  cycle_length_override int check (cycle_length_override between 21 and 45),
  timezone text default 'Asia/Calcutta',
  -- extension (2): cold-start prior, "typical length" from bootstrap
  bootstrap_cycle_length int check (bootstrap_cycle_length between 21 and 45)
);

create table if not exists app_secrets (
  id int primary key default 1,
  passphrase_hash text not null,
  -- extension (1): bumped on vault rotation; older sessions become invalid
  session_epoch int not null default 1
);

create table if not exists login_throttle (
  id int primary key default 1,
  fail_count int default 0,
  locked_until timestamptz
);

-- ------------------------------------------------------------
-- RLS: enable on ALL tables, create NO policies => deny-all.
-- (service_role bypasses RLS; anon/authenticated can read nothing)
-- ------------------------------------------------------------
alter table period_logs     enable row level security;
alter table day_entries     enable row level security;
alter table prediction_log  enable row level security;
alter table settings        enable row level security;
alter table app_secrets     enable row level security;
alter table login_throttle  enable row level security;

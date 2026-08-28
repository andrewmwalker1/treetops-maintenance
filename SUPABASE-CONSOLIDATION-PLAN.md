# Consolidating Tree Tops apps into one Supabase project — plan sketch (not started)

**Written:** 28 Aug 2026. **Status:** exploratory only — nothing below has been built.
Trigger: tonight's Maintenance app slowdown turned out to be Supabase's smallest
(Nano/Free) compute tier under load, not a bug — fixable for $25/mo (Pro +
Micro). That prompted the question: instead of paying that per app, could all
three Tree Tops apps (Hub, Maintenance, ParkMan2) share **one** Supabase
project and one bill?

This sits alongside `AZURE-SQL-MIGRATION-PLAN.md` (15 Aug) as the other side of
the same cost question — that plan was "leave Supabase for Azure SQL,"
multi-week, payoff only once there's a second park. This plan is "stay on
Supabase, just stop paying for three separate projects" — much smaller, and
useful regardless of whether the Hub ever gets gifted elsewhere.

## What's actually being compared

| | **Tree Tops Hub** | **Tree Tops Maintenance** | **ParkMan2** |
|---|---|---|---|
| Repo | `treetops-hub` | `treetops-maintenance` (this repo) | not accessible this session — see gap below |
| Supabase project | `qkbpsqlrzygcairtidye` | separate project (per this repo's own CLAUDE.md: "never point this app at the Hub's project") | unknown — presumed separate again |
| Data model | One generic `app_data` key/value table + `hub_admins`, `usage_events`, `push_subscriptions`. No multi-tenancy concept at all — single park, hardcoded. | Fully normalised, deliberately multi-tenant from day one: `organisations → sites → profiles/roles/groups → jobs`, ~30+ tables, heavy RLS. | Owns the master pitch/park data — Hub's own `public/pitches.json` is a static export *from* ParkMan2, already known to drift (Hub's CLAUDE.md: "14 pitches drawn on the map don't exist in ParkMan2"). |
| Auth | Real Supabase Auth, but only for `hub_admins` gating — the anon key is deliberately public, RLS/`security definer` functions are the only gate. Everyday guests are unauthenticated. | Full per-user auth, RLS keyed to `auth.uid()` everywhere, roles/permissions/site-scope model — see this repo's SYSTEMSPEC.md §5. | unknown |
| Edge Functions | `invite-hub-admin`, `send-notice-push` | `generate-scheduled-jobs`, `manage-users`, `rfid-login`, `send-contractor-job-email`, `contractor-document-reminders`, `flush-dnd-notifications` | unknown |
| Compute tier today | presumably Free/Nano | Free/Nano (tonight's incident) | unknown |

**Gap:** ParkMan2's repo isn't in this session's accessible list — everything
below about it is inferred from Hub's references, not a real scan. Before
committing to this plan, it needs the same repo-scan treatment Hub and
Maintenance got here.

## The one concrete collision already found

Hub has a `push_subscriptions` table. Maintenance has a `push_subscriptions`
table (SYSTEMSPEC.md §4.6). Same name, different shape, different meaning.
Naively merging both apps' schemas into one Postgres `public` schema would
silently break one or both. **This is exactly the kind of thing Postgres
schemas (not just table-naming discipline) solve properly** — see below.

## Two different things "one database" could mean

These are genuinely different projects with very different risk/cost, and
worth deciding between explicitly rather than drifting into one:

### Option A — Same project, separate Postgres schemas (recommended first step)

Each app keeps its own tables, RLS policies, and internal data model exactly
as-is, just inside dedicated Postgres schemas (`hub.*`, `maintenance.*`,
`parkman.*`) instead of three separate Supabase projects. PostgREST (what
Supabase's client library talks to) can expose multiple schemas, and
`supabase-js` supports `.schema('hub')` to target one explicitly. This is the
direct Postgres equivalent of the Azure plan's "elastic pool" idea — one
shared compute footprint, several logically independent databases-in-
everything-but-name.

- **Solves the actual problem** (three separate Free-tier projects, one of
  which already needed upgrading) with the least new design work.
  Fixes the `push_subscriptions` collision and any future ones for free —
  each app's tables live in their own namespace.
- Each app's RLS, auth assumptions, and security posture stay untouched — no
  need to reconcile Hub's "anon key is public by design" model with
  Maintenance's "every table is RLS-gated per authenticated user" model,
  since they never touch the same rows.
- Shared secrets get to be genuinely shared instead of duplicated per
  project: one `RESEND_API_KEY`, one set of VAPID keys, one service role key
  to rotate instead of three.
- Auth is the one real wrinkle: Supabase Auth's `auth.users` table is
  project-wide, not per-schema. Hub's `hub_admins` and Maintenance's
  `profiles` would both reference the *same* `auth.users` pool. That's
  probably fine (an email either has an account or doesn't; nothing forces
  cross-app visibility), but needs a deliberate check that Hub's admin
  invite flow and Maintenance's staff invite flow don't collide if the same
  person ever needs both.

### Option B — Genuinely shared data model (bigger, separate initiative)

Beyond Option A: actually unify overlapping concepts — one canonical
`pitches` table instead of Maintenance's `pitches` + ParkMan2's pitch data +
Hub's static `pitches.json` export, one login working across all three apps,
shared reference data (areas, equipment) visible everywhere it's relevant.
This is where the *real* long-term value is — it would retire the
already-documented pitch-data drift between Hub and ParkMan2 — but it means
redesigning each app's data model around shared tables, not just relocating
them. Genuinely a separate, larger project. **Recommend treating this as a
future phase, not part of the cost-saving consolidation itself** — mixing
"save money by sharing compute" with "redesign our data model" in one
migration multiplies risk for no immediate reason.

## Proposed plan (Option A)

1. **Decide the home project.** Either provision a fresh, empty Supabase
   project as the shared home (cleanest cutover, easiest rollback — the old
   projects stay untouched until everything's verified), or repurpose
   Maintenance's existing project (it's already the most sophisticated
   schema and likely the first to need a Pro-tier upgrade anyway, per
   tonight). Recommend the fresh-project route — decommissioning three old
   projects at the end is the same either way, but a fresh home means
   nothing about the migration can accidentally disrupt Maintenance's
   already-live, already-fixed-tonight production data mid-move.
2. **Create dedicated schemas** (`hub`, `maintenance`, `parkman`) in the new
   project; enable them in PostgREST's exposed-schemas config
   (Project Settings → API → Exposed schemas).
3. **Port each app's SQL migrations into its schema** — mostly mechanical
   (`create table public.foo` → `create table hub.foo`), but every RLS
   policy, `security definer` function, and storage bucket policy needs its
   fully-qualified schema references checked, not just table names.
4. **Migrate data** — `pg_dump`/`pg_restore` per app's existing project,
   loaded into its new schema in the shared project (there are only three
   sources, none large from what's been scanned so far).
5. **Consolidate secrets** — one `RESEND_API_KEY`, one VAPID key pair, redeploy
   each app's Edge Functions into the one project.
6. **Repoint each app's frontend** — new `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`,
   and every `supabase-js` call site needs `.schema('hub')` (or whichever)
   added if it isn't already scoped. For Maintenance specifically, this
   touches every file listed in SYSTEMSPEC.md §8.5 (the shared query
   modules) plus every direct `supabase.from(...)` call — a real but
   mechanical find-and-adjust pass.
7. **Verify, then decommission** the three old projects only once each app
   has run against the shared project in production for a real stretch of
   time (recommend at least a week, given how today's issue only showed up
   under real usage).

## Honest effort/risk read

- **Small:** Hub's port (Phase 3) — only ~4 tables, 2 Edge Functions, 1
  storage bucket, per the Azure plan's own repo scan.
- **Medium:** Maintenance's port — the schema is large (30+ tables) but
  mechanical; the real work is re-checking every RLS policy's schema
  references, since this app's security model leans on RLS more heavily
  than Hub's does.
- **Unknown, likely medium:** ParkMan2 — needs its own repo scan before this
  estimate means anything.
- **The genuine risk, not the busywork:** verifying no RLS policy
  accidentally becomes *more* permissive once everything shares one
  Postgres instance and one `auth.users` table. Two apps built years apart
  with two different security philosophies (Hub: "anon is public, RLS
  narrows it down"; Maintenance: "everything's gated, RLS is the only
  thing standing between a request and the data") sitting in the same
  database is the part worth taking slowly and testing thoroughly, not the
  schema-renaming.

## Cost read

Today: up to three Supabase projects, at least one (Maintenance) now needing
Pro + Micro ($25/mo) after tonight. If Hub or ParkMan2 hit the same growth
wall independently, that's potentially 2–3× $25/mo separately. Consolidated
onto one Pro project: **$25/mo total** covers all three apps' compute unless
combined load genuinely outgrows Micro — a real, near-term saving, not a
someday one (contrast with the Azure plan, whose payoff explicitly doesn't
land until there's a second park).

## Before starting

1. Get ParkMan2's repo added so it gets the same real scan Hub and
   Maintenance got here, rather than this plan guessing at its scope.
2. Decide fresh-project vs repurpose-Maintenance's-project (recommend fresh).
3. Confirm nobody currently needs a Hub admin account and a Maintenance
   staff account to be genuinely separate identities — Option A puts them
   in the same `auth.users` pool.

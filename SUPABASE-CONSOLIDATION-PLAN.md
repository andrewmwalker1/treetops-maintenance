# Consolidating Tree Tops apps into one Supabase project — plan sketch (not started)

**Written:** 28 Aug 2026, updated same day after scanning ParkMan2.
**Status:** exploratory only — nothing below has been built.
Trigger: tonight's Maintenance app slowdown turned out to be Supabase's smallest
(Nano/Free) compute tier under load, not a bug — fixable for $25/mo (Pro +
Micro). That prompted the question: instead of paying that per app, could all
three Tree Tops apps (Hub, Maintenance, ParkMan2) share **one** Supabase
project and one bill?

This sits alongside `AZURE-SQL-MIGRATION-PLAN.md` (15 Aug, in the Hub repo) as
the other side of the same cost question — that plan was "leave Supabase for
Azure SQL," multi-week, payoff only once there's a second park. This plan is
"stay on Supabase, stop paying for separate projects" — smaller, and useful
regardless of whether the Hub ever gets gifted elsewhere.

## Important correction: two of the three apps are already consolidated

The original version of this doc assumed three separate Supabase projects.
That was wrong. **ParkMan2's own `PROJECT-BRIEF.md` and `supabase/01-schema.sql`
show it already runs inside Hub's project** (`qkbpsqlrzygcairtidye`), in a
dedicated `parkman2` Postgres schema — chosen back on 7 Aug 2026 as "a
temporary bridge" because a third free-tier project was paused and reactivating
it meant paying anyway. ParkMan2's own brief explicitly flags the exact
question this doc is now answering: *"at that point also revisit whether
ParkMan2 and Maintenance should eventually share one permanent project
instead... since that's the one choice that actually matters for how easily a
future merge goes."*

So the real current state is **two projects, not three**:

| | **Hub + ParkMan2** (already merged) | **Maintenance** (separate) |
|---|---|---|
| Supabase project | `qkbpsqlrzygcairtidye` | separate project (this repo's own CLAUDE.md: "never point this app at the Hub's project") |
| Schema layout | Hub in `public`, ParkMan2 in its own `parkman2` schema (`alter role authenticator set pgrst.db_schemas = 'public, parkman2'`) | everything in `public` |
| `auth.users` | shared between Hub and ParkMan2 already — "Andy's Hub login also works [in ParkMan2]" | its own separate pool |
| Anon access | Hub's anon key is deliberately public (guest-facing, no login) — RLS is the only gate | ParkMan2 grants `authenticated` only, explicitly **no** anon grant (staff-only app, no public use case) — same posture as Maintenance |
| Data model | Hub: one generic `app_data` key/value table + `hub_admins`, `usage_events`, `push_subscriptions`. No multi-tenancy. ParkMan2: real relational schema — `business, park, area, season, customer, caravan, pitch, ownership, placement, licence, insurance`, plus invoicing/nominal codes/VAT/roles/document register (26 migration files, genuinely the most complex of the three commercially). | Fully normalised, deliberately multi-tenant: `organisations → sites → profiles/roles/groups → jobs`, 30+ tables, heavy RLS (this repo's SYSTEMSPEC.md §5). |
| Edge Functions | `invite-hub-admin`, `send-notice-push` (Hub) · `parkman2-manage-users` (ParkMan2 — already app-prefixed, no collision) | `generate-scheduled-jobs`, `manage-users`, `rfid-login`, `send-contractor-job-email`, `contractor-document-reminders`, `flush-dnd-notifications` |
| Compute tier | presumably still Free/Nano | Free/Nano (tonight's incident) |

**What this changes:** the question isn't "prove schema-per-app works" — it
already does, in production, for two of three apps. The question is narrower:
**does Maintenance join that existing project too**, or does everything move
to a fresh one. Also worth noting: ParkMan2's own plan already called for
*leaving* the shared project once Maintenance was "fully live" and Andy was
paying for Supabase anyway — this doc proposes the opposite of that original
intent (staying merged, and pulling Maintenance in rather than splitting
ParkMan2 out), because the cost logic changed once Maintenance needed its own
paid tier regardless.

## One concrete naming collision (unaffected by the above)

Hub has a `public.push_subscriptions` table. Maintenance has a
`public.push_subscriptions` table (SYSTEMSPEC.md §4.6). Same name, different
shape. If Maintenance's tables ever moved into the shared project's `public`
schema this would break silently — but per the pattern ParkMan2 already
proved out, Maintenance should get its **own** dedicated schema
(`maintenance`, mirroring `parkman2`), not land in `public` at all. Doing that
sidesteps this collision and any future one for free.

## Two different things "one database" could mean

Worth keeping deliberately separate, same as before:

### Option A — Maintenance joins the existing Hub+ParkMan2 project, in its own schema (recommended)

Concretely: create a `maintenance` schema in the `qkbpsqlrzygcairtidye`
project, port this repo's ~30 tables and RLS policies into it verbatim (same
tables, same policies, just schema-qualified), expose it via the same
`pgrst.db_schemas` mechanism ParkMan2 already uses, migrate the data, repoint
this app's `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` and add
`.schema('maintenance')` to its `supabase-js` client. Three apps, one
project, one bill, each still fully independent under the hood.

- **This is provably low-risk** — it's the exact pattern already running in
  production for Hub+ParkMan2, not a new idea being tried for the first time.
- Auth is the one real wrinkle, same as ParkMan2 already accepted: Maintenance's
  `profiles` and ParkMan2's `parkman2.profiles` would both sit on top of the
  same shared `auth.users`. That's presumably fine (same business, likely
  overlapping staff — Andy already uses one login across Hub and ParkMan2)
  but is worth a deliberate one-time check: does anyone currently have a
  Maintenance account and a Hub/ParkMan2 account with different emails that
  would now need reconciling?
- Hub's public-anon model living alongside Maintenance's fully-gated model is
  **already the exact situation ParkMan2 solved** — its own `03-expose-schema.sql`
  explicitly grants schema usage to `authenticated` only, never `anon`, for
  precisely this reason. Maintenance's migration should copy that same
  grant shape.
- Shared secrets stop being duplicated: one `RESEND_API_KEY` (Maintenance
  already uses this for contractor emails; worth checking whether Hub/ParkMan2
  need email too), one VAPID key pair (Hub and Maintenance both do push
  notifications independently today), one service role key to rotate.

### Option B — Genuinely shared data model (bigger, already partly road-mapped)

ParkMan2's own `PROJECT-BRIEF.md` already names this explicitly under
"Maintenance integration": pulling Maintenance's job-tracking into ParkMan2
so work on pitches/caravans can be tracked and billed in one place, and
explicitly plans reusing Maintenance's `site_scope` (`profile_id, site_id`)
pattern for ParkMan2's own future multi-park access control, and
Maintenance's `role_permissions` pattern for ParkMan2's own future
section-level permission gating. None of this is built yet — ParkMan2's brief
is explicit that it's "deliberately not designed or built yet," to avoid
guessing ahead of the real merge being scheduled.

This is real, already-intended future work, not a new idea — but it's a data
model redesign (one canonical `pitches` table instead of Maintenance's
`pitches` + ParkMan2's `parkman2.pitch` + Hub's static `pitches.json` export,
which is already known to drift), not a relocation. **Recommend treating this
as the follow-up phase once Option A is live and stable**, exactly as
ParkMan2's own brief already anticipated ("revisit... once that merge is
actually being planned").

## Proposed plan (Option A)

1. **Confirm the target stays `qkbpsqlrzygcairtidye`** rather than a fresh
   project — unlike the original version of this doc, there's now a real
   reason to prefer reusing it: two of three apps are already there and
   working, and moving *them* again would undo real, tested infrastructure
   for no benefit. Maintenance is the one that should move, not the other
   two.
2. **Create the `maintenance` schema**, copy the exact GRANT/expose pattern
   from ParkMan2's `03-expose-schema.sql` (`authenticated` only, no `anon`
   grant — Maintenance has no public/guest use case).
3. **Port this repo's SQL migrations** into the `maintenance` schema —
   mechanical for table definitions, but every RLS policy and `security
   definer` function needs its schema-qualified references checked, and
   this repo leans on RLS more heavily than either Hub or ParkMan2 (see
   SYSTEMSPEC.md §5's helper-function pattern) — this is the part worth
   taking slowly.
4. **Migrate data** — `pg_dump`/`pg_restore` from Maintenance's current
   project into the `maintenance` schema in the shared project.
5. **Consolidate secrets** — one `RESEND_API_KEY`, one VAPID key pair, three
   apps' worth of Edge Functions redeployed into the one project
   (`generate-scheduled-jobs`, `manage-users` — note this collides in name
   with nothing today, but would be worth prefixing `maintenance-manage-users`
   to match ParkMan2's own `parkman2-manage-users` convention, rather than
   relying on it never colliding with something Hub or ParkMan2 add later —
   etc., alongside `rfid-login`, `send-contractor-job-email`,
   `contractor-document-reminders`, `flush-dnd-notifications`).
6. **Repoint Maintenance's frontend** — new `VITE_SUPABASE_URL`/
   `VITE_SUPABASE_ANON_KEY`, and `.schema('maintenance')` added wherever this
   app's `supabase-js` client is constructed, plus checking every direct
   `supabase.from(...)` call site (this repo's SYSTEMSPEC.md §8.5 lists the
   shared query modules — start there).
7. **Verify, then decommission** Maintenance's old project only once it's
   run against the shared project in production for a real stretch (at
   least a week, given tonight's issue only showed up under real usage).

## Honest effort/risk read

- **Already done:** proving schema-per-app works in production — Hub+ParkMan2
  already demonstrate it. This is the one thing the original version of this
  doc treated as the main open risk, and it turns out to already be solved.
- **Medium:** Maintenance's port — the schema is the largest of the three
  (30+ tables) but mechanical; the real work is re-checking every RLS policy
  and `security definer` function's schema references.
- **Small, but worth doing deliberately:** the `auth.users` overlap check —
  does any current Maintenance user's email need reconciling against an
  existing Hub/ParkMan2 account for the same person.
- **Not a risk any more:** ParkMan2's own unknowns are gone now that it's
  been scanned directly — its schema, auth model, and even the exact GRANT
  pattern to reuse are all in hand.

## Cost read

Today: **two** Supabase projects, not three. Hub+ParkMan2 already share one
(presumably still Free/Nano); Maintenance is separate and now needs Pro+Micro
($25/mo) after tonight regardless of this plan. Folding Maintenance into the
existing shared project means that **one** $25/mo Pro upgrade covers all
three apps' compute, rather than Maintenance paying for its own upgrade while
Hub+ParkMan2 separately risk hitting the same Free-tier wall later and paying
again. Real, near-term saving either way — the only question is whether it's
paid once or (potentially) twice.

## Before starting

1. ~~Get ParkMan2's repo added~~ — done, scanned directly (28 Aug 2026).
2. Confirm with Andy: does anyone hold both a Maintenance account and a
   Hub/ParkMan2 account under different email addresses? That's the one
   thing worth resolving before merging `auth.users` pools, not after.
3. Decide whether to also rename `manage-users` → `maintenance-manage-users`
   as part of the move, matching ParkMan2's own naming convention, purely to
   keep future additions from colliding by accident.

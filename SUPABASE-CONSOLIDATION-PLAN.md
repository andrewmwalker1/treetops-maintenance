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
2. ~~Confirm with Andy: does anyone hold both a Maintenance account and a
   Hub/ParkMan2 account under different email addresses?~~ — confirmed no
   (28 Aug 2026): everyone uses the same email across whichever Tree Tops
   apps they use, so merging into one shared `auth.users` pool is safe.
3. Decide whether to also rename `manage-users` → `maintenance-manage-users`
   as part of the move, matching ParkMan2's own naming convention, purely to
   keep future additions from colliding by accident. **Resolved below: yes,
   rename all 8 of Maintenance's Edge Functions, not just this one** — see
   risk #2 in the runbook.

---

# Execution runbook (28 Aug 2026)

Status: **plan approved by Andy, not yet executed.** Blocked on the network
constraint noted at the bottom — pick up execution from a **local** Claude
Code session (on Andy's own PC), not a cloud/web one.

## Four risks this plan corrects that the analysis above missed

1. **Auth Hooks are project-wide, not per-schema.**
   `supabase/46-terminal-session-scoped-login-context.sql`'s
   `custom_access_token_hook` must be wired up in Dashboard → Authentication
   → Hooks. If Hub/ParkMan2 already has one configured there, they'd
   collide — must check the live dashboard before enabling (cannot tell
   from code). This is Phase 0 step 3 below.
2. **Edge Function names collide.** Maintenance has a `send-notice-push`
   function; Hub already has a function by that exact name live in the
   shared project. **Fix: prefix all 8 of Maintenance's functions
   `maintenance-*`**, matching ParkMan2's own `parkman2-manage-users`
   convention.
3. **Every Edge Function needs a one-line source edit, not just
   redeployment.** None of Maintenance's 8 functions currently pass
   `db: { schema: ... }` to `createClient()` (confirmed by grep — all 38
   `.from()` calls across them default to `public`). Add
   `{ db: { schema: "maintenance" } }`, mirroring
   `parkman2/supabase/functions/parkman2-manage-users/index.ts`.
4. **Edge Function secrets are one flat namespace per project.**
   Maintenance's `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`
   could silently overwrite Hub's own push secrets if Hub already uses
   those generic names. **Fix: prefix Maintenance's as
   `MAINTENANCE_VAPID_*`**, update the two functions that read them.
   `RESEND_API_KEY` is safe to share unprefixed (neither Hub nor ParkMan2
   use Resend — confirmed by grep).

**Also: keep Maintenance's existing VAPID key pair unchanged** — do not
consolidate VAPID keys across apps. A VAPID key pair is bound to every
already-issued browser push subscription; changing it silently breaks push
for every device until they resubscribe. There's no cost benefit to
sharing it (VAPID keys aren't billed), so the only fix needed is the
naming collision in #4, not a shared key.

## Design decisions for the hard parts

**Schema relocation** — `pg_dump --schema=public` to plain SQL, then
text-substitute `public.` → `maintenance.` before applying to the target.
Safe specifically in this codebase because: modern `pg_dump` fully
schema-qualifies every object in its output (empty `search_path` by
default), and this repo's own SQL already schema-qualifies everything as
`public.X` with no reliance on implicit resolution — `auth.*` references
are a different string and untouched by the substitution. One exception
needing a manual (not automated) edit:
`grant usage on schema public to supabase_auth_admin;` in migration 46 has
no trailing dot, won't be caught by the substitution, and must be
hand-changed to `schema maintenance`. No sequences exist in this schema
(everything uses `gen_random_uuid()`), so no sequence-ownership step
needed.

**Update (network-blocker workaround):** since a local session can reach
Supabase directly, `pg_dump`/`psql` against the *source* project is back
on the table and is the most reliable way to get the schema out. But an
equally valid, arguably simpler alternative now available: since this
repo's `supabase/01-schema.sql` through `49-equipment-repair-jobs.sql`
already **are** the authoritative schema definition (idempotent, safe to
re-run per this repo's own CLAUDE.md), you can just replay those 49 files
against the target with `public.` → `maintenance.` substituted, exactly as
they were each originally pasted into the SQL Editor — no need to dump the
live source schema at all. Only the *data already sitting in tables*
(actual job/equipment/fault rows) needs to come from a real source dump —
the schema/RLS/functions can come straight from git.

**Auth identity reconciliation** — Only `profiles.id` is a direct FK to
`auth.users(id)`; every other reference goes through `profiles`, not
`auth.users` directly, and no FK uses `ON UPDATE CASCADE`. So: for each
source `auth.users` email, look up in target `auth.users` by email — reuse
the UID if found, otherwise create via
`admin.createUser({ email, email_confirm: true })` (same "force-confirm"
pattern `manage-users` already uses; no passwords exist to migrate, this
app is passwordless-only). Build an old→new UID map, then inside one
transaction with `set constraints all deferred;`, update `profiles.id` and
the ~20 FK columns across ~15 tables that reference it (re-derive the
authoritative column list live via `information_schema` right before
running, don't trust a hand-typed list) — deferred constraints make table
update order irrelevant and the whole remap atomic.

**Storage files** — Bucket *rows* are covered by the schema dump; actual
file bytes are not (`storage` schema is project-scoped, outside
`--schema=public`). Copy via a Node script using the Storage REST API with
service-role keys on both projects: list bucket contents (one folder level
deep, matches this app's `<id>/<filename>` path convention), download from
source, upload to target with `upsert: true` (safe to re-run). Keep bucket
names unchanged (`job-photos`, `fault-photos`, `ra-ms-pdfs`,
`contractor-documents`) — no naming collision exists today, and keeping
them avoids editing 11 frontend call sites and 3 RLS-policy files for no
functional benefit.

**Cutover** — No maintenance-mode flag exists in the app, so downtime is a
real (if short) freeze communicated to staff directly (small team, not the
public), not something enforced in-app. Do the irreversible-feeling parts
(schema port, auth reconciliation, storage copy) while the old project is
still live serving traffic; only freeze for a final full re-run (not a
diffed delta — simpler and safer given the schema's size) plus the actual
flip.

## Runbook

### Phase 0 — Pre-flight (no production risk, do this once credentials are in hand)
1. Get from Andy: **Personal Access Token** (Account → Access Tokens —
   works across both projects, needed for Management API calls) and
   **secret keys** (`sb_secret_...`, one per project, from Settings → API
   Keys). Database passwords are only needed if running `pg_dump`/`psql`
   directly (possible from a local session) — the Management API route
   doesn't need them.
2. Trigger a manual Supabase dashboard backup of the source project, **and**
   independently `pg_dump` the whole source DB to a local file kept until
   Phase 5 decommission.
3. Check target's Dashboard → Authentication → Hooks for an existing
   Custom Access Token Hook (Hub/ParkMan2 might already have one) — resolve
   any conflict before Phase 3 step 23 if found.
4. List actually-deployed Edge Functions on the target
   (`supabase functions list --project-ref qkbpsqlrzygcairtidye`) — don't
   trust either repo's committed source, Hub's is known incomplete.
5. List target's current Edge Function secret names (not values) —
   confirms whether the VAPID-prefixing in risk #4 is actually necessary.
6. Get the target's live `pgrst.db_schemas` value
   (`select rolconfig from pg_roles where rolname = 'authenticator';`) so
   Phase 1 step 9 appends rather than clobbers.
7. Get the source's real cron schedule
   (`select jobname, schedule, active from cron.job;`) so Phase 4 step 27
   replicates it exactly, not a guessed cron string.
8. Confirmed with Andy: keep bucket names as-is, prefix all 8 functions
   `maintenance-*`, prefix VAPID secrets `MAINTENANCE_VAPID_*`, share
   `RESEND_API_KEY` unprefixed.

### Phase 1 — Schema + data port (target only; source stays live, untouched)
9. Create `maintenance` schema + grants on target; set `pgrst.db_schemas`
   to the real current value plus `, maintenance`.
10. Port schema either via replaying this repo's 49 SQL files
    (`public.` → `maintenance.` substituted) or via `pg_dump` of source
    `public` schema with the same substitution — hand-fix the one
    `schema public` grant line in migration 46's ported copy either way.
11. Apply to target. Verify row counts per table match source vs target
    (`pg_stat_user_tables`) as a completeness gate.
12. Run table/function grants on `maintenance` schema for `authenticated`
    (no `anon` grant — staff-only, mirrors ParkMan2).
13. **Checkpoint**: nothing reads from target yet. Safe to pause
    indefinitely here.

### Phase 2 — Auth reconciliation (target only; source untouched)
14. Query target `auth.users` for every email present in source
    `auth.users` (joined via source `profiles`).
15. Create target users for unmatched emails via
    `admin.createUser({ email, email_confirm: true })` — no email sent, no
    password set.
16. Build the full old→new UID map (including identity entries for
    already-existing target UIDs).
17. One transaction, `set constraints all deferred;`, update `profiles.id`
    + all FK columns referencing it (list re-derived live via
    `information_schema`), commit.
18. **Gate**: `select count(*) from maintenance.profiles p left join
    auth.users u on u.id = p.id where u.id is null;` must be `0` before
    proceeding.

### Phase 3 — Storage, secrets, functions, cron (target only; source untouched)
19. Run the storage byte-copy script for all 4 buckets; verify object
    counts match source vs target.
20. Set target secrets: `RESEND_API_KEY` (shared),
    `MAINTENANCE_VAPID_PUBLIC_KEY`/`_PRIVATE_KEY`/`_SUBJECT` (Maintenance's
    existing values, unchanged).
21. Edit each of the 8 Edge Functions' source: add
    `{ db: { schema: "maintenance" } }` to `createClient()`; update the two
    VAPID-reading functions to the prefixed secret names; rename function
    folders to `maintenance-*`.
22. Deploy all 8 renamed functions to target.
23. Enable `maintenance.custom_access_token_hook` in target's Auth Hooks —
    only if Phase 0 step 3 found no conflict.
24. Do **not** schedule the two cron jobs yet — deliberately deferred to
    Phase 4 to avoid both projects generating scheduled jobs on the same
    day.

### Phase 4 — Freeze window and cutover (the only phase with real downtime)
Pick a quiet evening. Tell staff directly not to use the app for ~15–30
min (no in-app banner exists to enforce this).
25. Freeze source: unschedule its two cron jobs first.
26. Re-run the full Phase 1 (steps 10–11) and Phase 2 (14–18) end to end
    (truncate-and-redo, not a diff — simpler and safe at this schema's
    size) to pick up everything created since the bulk copy. Re-run the
    storage copy the same way (`upsert: true` makes this cheap).
27. Schedule the two cron jobs on target using the real schedule from
    Phase 0 step 7, pointing at the (renamed) target functions.
28. Repoint `src/lib/supabaseClient.js`: add
    `db: { schema: "maintenance" }`, mirroring
    `parkman2/src/lib/supabaseClient.js`. Update the ~11
    `functions.invoke("...")` call sites if functions were renamed.
29. Repoint this repo's GitHub Actions secrets
    `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` to the target project
    (`VITE_VAPID_PUBLIC_KEY` stays unchanged).
30. Commit + push to `main` → auto-deploys to `jobs.treetops.co.uk`.
31. End the freeze, tell staff it's back.

### Phase 5 — Verification and decommission
32. Smoke test as a real staff login: sign in, view/open a job with an
    existing photo (proves storage + path integrity), create a job, check
    kiosk/RFID sign-in, check Admin → Users looks right (proves auth
    reconciliation), trigger one throwaway `manage-users` invite.
33. Next day: confirm both cron jobs actually fired
    (`cron.job_run_details` on target) and did something sensible.
34. Confirm zero new write activity on the old project for 48h (catches
    any stale PWA still pointed at the old URL).
35. Keep the old project alive, untouched, for **at least one full week**
    of real use as a rollback safety net.
36. After that week: delete the old Maintenance project (this is when the
    second bill actually stops) and the local backup dump file from Phase
    0 step 2.

## Where real, non-recoverable risk remains
- Step 17's UID remap: mitigated by one transaction + deferred
  constraints — either all FKs move or none do; safe to re-run on failure.
- Storage copy: `upsert: true` makes re-runs safe; the object-count check
  in step 19/26 is the gate — don't cut over on a mismatch.
- The Auth Hook collision (risk #1): the one thing this plan can't resolve
  from code — must be checked live in Phase 0 step 3.
- **Step 36 (deleting the old project) is the only truly irreversible
  action in this whole plan.** Don't shorten the one-week window under
  cost pressure.

## Credentials already collected (28 Aug 2026 session — re-verify/rotate)
- Maintenance project ref: `ozhwgrzlpvfdemmogmav`, region `eu-west-1`
  (Ireland).
- Target project ref: `qkbpsqlrzygcairtidye`, region unconfirmed.
- Publishable and secret keys for both projects, and a Personal Access
  Token, were shared directly in that session's chat — **not recorded
  here on purpose.** Get fresh ones (or reuse the same ones if Andy still
  has them) when picking this up — do not go looking for them in old chat
  history as a substitute for asking Andy directly, and rotate/delete them
  once the migration is verified done, per the plan's own hygiene notes
  above.

---

# Direction reversed (28 Aug 2026, later same evening)

**Status: new direction approved by Andy, execution not yet resumed.**

Everything above (target = `qkbpsqlrzygcairtidye`, Maintenance moves) was
Phase-0-preflighted and about to start Phase 1 when Andy reconsidered the
target choice mid-session:

> "My view is everything should move into the maintenance DB as that is by
> far the most live app. Hub is pretty simple and ParkMan2 is a prototype."
>
> "parkman2 is a prototype, it may be complex but it's far from live.
> Maintenance is live and you did an amazing job on it"

**New direction: Hub + ParkMan2 move into Maintenance's project
(`ozhwgrzlpvfdemmogmav`). Maintenance itself stays completely untouched.**

Nothing had been written to either database when this happened (Phase 1
step 9 was about to run) — clean point to redirect, no rollback needed.

## Why this isn't just swapping which project ref is "target"

The original plan chose `qkbpsqlrzygcairtidye` specifically because only
*one* app (Maintenance) needed to move — Hub and ParkMan2 were already
co-located there. Reversing it means **two** apps need the full
port/reconcile/cutover treatment instead of one, and — discovered during
re-preflighting below — Hub's SQL is written in a meaningfully messier
style than Maintenance's, so it isn't a mechanical find/replace like
Maintenance's port would have been.

Andy's reasoning stands regardless: Maintenance is the busiest, most
relied-on app day-to-day (RFID kiosk, staff constantly checking
in/out/completing jobs), and not putting it through a migration at all is
worth the extra work of moving the other two instead. ParkMan2's
complexity (26 migration files, real customer/invoicing data) is schema
complexity, not usage risk — Andy's assessment is it's genuinely
low-traffic ("a prototype... far from live") — so porting it is
lower-stakes than its table count suggests.

## Re-preflighted: Maintenance project as target (ozhwgrzlpvfdemmogmav)

Same checks as original Phase 0 steps 3–7, re-run against the new target:

- **No Auth Hook conflict** — `hook_custom_access_token_enabled: false`.
  (Side note: Maintenance's own `custom_access_token_hook`, created by its
  migration 46, was never actually wired up here either — irrelevant now
  since Maintenance isn't moving.)
- **`pgrst.db_schemas`**: currently unset (serves only `public` —
  Maintenance's own schema). Will become
  `public, hub, parkman2` once both land.
- **8 Edge Functions already live**: `manage-users`,
  `generate-scheduled-jobs`, `rfid-login`, `send-notice-push`,
  `flush-dnd-notifications`, `send-contractor-job-email`,
  `contractor-document-reminders`, `register-terminal-session`.
- **Secrets already set**: the `SUPABASE_*` platform-provided ones,
  `RESEND_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.

### Collisions found (same shape as before, direction reversed)

1. **`send-notice-push`** — Maintenance already runs one live. **Hub's**
   copy is the one that must be renamed now (`hub-send-notice-push`),
   not Maintenance's.
2. **`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`** — Maintenance's are
   already set and in active use. **Hub's** VAPID secrets must be
   prefixed `HUB_VAPID_PUBLIC_KEY` / `HUB_VAPID_PRIVATE_KEY` /
   `HUB_VAPID_SUBJECT` this time.
3. **`RESEND_API_KEY`** — Maintenance already uses this; safe to keep
   shared/unprefixed (unchanged conclusion from before).
4. **`push_subscriptions` table name** — Maintenance already has its own
   (2 rows, live). Not a real conflict once Hub's copy is correctly
   schema-qualified into `hub.push_subscriptions` — see below for why
   that's less automatic than it sounds for Hub specifically.

## ParkMan2 → `parkman2` schema (straightforward — already isolated)

Scanned all 24 SQL files in `ParkMan2/supabase/`: **zero** unqualified
references anywhere — every single object reference across all 24 files
is already schema-qualified as `parkman2.` (confirmed by grep count,
`public.` count is 0 in every file). This app was built *for* this exact
consolidation pattern from day one.

- Replay files `01, 02, 04–26` verbatim, no text substitution needed at
  all. Skip `03-expose-schema.sql` — write a new equivalent for the new
  target instead (same `grant usage on schema parkman2 to authenticated`
  / `grant select, insert, update, delete on all tables in schema
  parkman2 to authenticated` / `alter default privileges...` pattern,
  just pointed at `ozhwgrzlpvfdemmogmav`).
- The 5 standalone `public` occurrences found are all benign: comments,
  the `pgrst.db_schemas` value string (handled separately, not via
  substitution), and two `storage.buckets (id, name, public)` column
  lists (the boolean "is this bucket public" column, unrelated to
  schemas).
- Edge Function `parkman2-manage-users` already passes
  `{ db: { schema: "parkman2" } }` to `createClient()` — **zero source
  changes needed**, redeploy as-is. No name collision with Maintenance's
  8 functions.
- Storage buckets: need to check ParkMan2's actual bucket names for
  collisions against Maintenance's 4 (`job-photos`, `fault-photos`,
  `ra-ms-pdfs`, `contractor-documents`) before Phase 3 — not yet checked.

## Hub → new `hub` schema (the genuinely new complexity)

Unlike Maintenance and ParkMan2, **Hub's SQL is not consistently
schema-qualified** — grep found 4 of 8 files with **zero** `public.`
references at all, relying entirely on the session's default
`search_path`. A blind `public.` → `hub.` substitution (which worked
cleanly for Maintenance) would silently miss all of these and let
objects land in Maintenance's own `public` schema instead — exactly the
kind of mistake this project's CLAUDE.md warns about generally
("never trust a filename alone... this has happened before").

Full accounting, file by file:

| File | `public.`-qualified? | Needs |
|---|---|---|
| `01-app-data-baseline.sql` | Yes (10) | substitution + 3× `schemaname = 'public'` string-literal fix |
| `03-device-stats.sql` | **No (0)** | `SET search_path = hub;` wrapper + 2× `search_path = public` → `hub` |
| `04-full-table-stats.sql` | **No (0)** | `SET search_path = hub;` wrapper + 1× `search_path = public` → `hub` |
| `04-info-pdfs-storage.sql` | **No (0)**, but only touches `storage.*` | replay verbatim, no change needed |
| `05-real-admin-auth.sql` | Yes (16) | substitution + 2× `schemaname = 'public'` string-literal fix |
| `06-fix-hub-admins-rls-recursion.sql` | Yes (12) | substitution + `search_path = public, pg_temp` → `hub, pg_temp` |
| `07-fix-public-write-policy-names.sql` | Yes (3) | substitution only (policy names like `"Public write"` are quoted identifiers, not schema refs — untouched by design) |
| `setup-admin-pin.sql` | **No (0)** | **skip entirely** — see below |

Additional substitution categories beyond plain `public.` → `hub.`,
found by classifying every standalone (non-dot-qualified) `public` token
across all 8 files:
- `search_path = public` → `search_path = hub` (5 occurrences; one is
  `search_path = public, extensions` in the skipped
  `setup-admin-pin.sql`, moot).
- `schemaname = 'public'` → `schemaname = 'hub'` (6 occurrences, all
  inside `pg_policies` existence checks in `do $$ ... $$` blocks —
  **not** caught by dot-based substitution since these are string
  literals, not identifiers. Missing this would make the idempotency
  checks silently always-false on any future re-run, always trying to
  recreate policies that already exist.)
- `storage.buckets (id, name, public)` (4 occurrences, the boolean
  column) and `revoke ... from authenticated, anon, public` (PUBLIC
  role keyword) — confirmed present in Maintenance's files too, both
  naturally safe since neither matches `public.` with a trailing dot.

**`setup-admin-pin.sql` should be skipped, not ported.** It creates a
`admin_auth` table + `verify_admin_pin()` function for an old PIN-based
admin check. Grepped `App.jsx` (the live app) for both names — zero
references. It's dead code, superseded by `05-real-admin-auth.sql`'s real
Supabase Auth login. Porting it would just add unused surface area.

### Edge Functions — two different fix patterns needed, not one

Only `invite-hub-admin`'s source is in the repo; `send-notice-push` isn't
(matches the original plan's warning: "Hub's [repo source] is known
incomplete"). Downloaded the real deployed source via
`supabase functions download send-notice-push --project-ref
qkbpsqlrzygcairtidye` to check it directly:

- **`invite-hub-admin`** — uses `createClient()` with no schema option,
  same pattern as Maintenance's functions. Fix: add
  `{ db: { schema: "hub" } }`. No name collision, can keep its name.
- **`send-notice-push`** — does **not** use `supabase-js`'s
  `createClient()` at all. It calls the PostgREST REST API directly via
  raw `fetch()` (`${SUPABASE_URL}/rest/v1/push_subscriptions...`). Schema
  selection for raw REST calls isn't a client option — it's the
  `Accept-Profile` header (GET) / `Content-Profile` header
  (POST/PATCH/DELETE). Fix is different from every other function in
  this whole migration: add `"Accept-Profile": "hub"` to the GET request
  headers and `"Content-Profile": "hub"` to the DELETE request headers,
  **and** rename to `hub-send-notice-push`, **and** update it to read
  `HUB_VAPID_PUBLIC_KEY` / `HUB_VAPID_PRIVATE_KEY` / `HUB_VAPID_SUBJECT`.

## Updated runbook (supersedes the Phase 1–5 numbering above for this direction)

Phase 0 (credentials, backup approach, risk-check method) carries over
unchanged in *method* — just re-run against the new target/sources.
Already re-done above for the target. Still needed before Phase 1:
- Backup + independent data dump of **both** Hub's and ParkMan2's current
  database (they're moving *out* of `qkbpsqlrzygcairtidye`, which itself
  doesn't need backing up since it's not being decommissioned — but the
  data leaving it does).
- ParkMan2 storage bucket names (not yet checked against Maintenance's 4).
- Whether any Hub or ParkMan2 user email needs reconciling against an
  existing Maintenance account — the original "everyone uses the same
  email" confirmation was scoped to Hub/ParkMan2 overlap, not Maintenance.
  **Needs asking Andy again for this direction specifically.**

Phase 1 (schema + data port), Phase 2 (auth reconciliation), Phase 3
(storage/secrets/functions/cron), Phase 4 (freeze + cutover), Phase 5
(verify + decommission) — same shapes as the original runbook, just run
twice (once for Hub into `hub` schema, once for ParkMan2 into `parkman2`
schema), against `ozhwgrzlpvfdemmogmav` as target throughout. Maintenance's
own cron jobs (`generate-scheduled-jobs-daily`,
`contractor-document-reminders-daily`) are untouched throughout — nothing
about them changes since Maintenance never moves.

The old `qkbpsqlrzygcairtidye` project doesn't get decommissioned the same
way the original plan's old Maintenance project would have — it currently
also hosts nothing else, so once both Hub and ParkMan2 are verified moved,
it becomes the one to eventually delete (same one-week-safety-net rule
applies).

## Why this needs a local Claude Code session, not a cloud one
Discovered 28 Aug 2026: a cloud/web Claude Code session's network egress
policy blocks **all** outbound traffic to Supabase — both the direct
Postgres port (no IPv6 route, and the IPv4 session-pooler port timed out
entirely) and `api.supabase.com`/`*.supabase.co` over HTTPS (explicit 403
from the egress proxy). Neither `pg_dump`/`psql` nor the Management
API/Storage/Auth Admin API workaround could reach Supabase at all from
that environment. A local session (Claude Code running directly on Andy's
own PC) uses the PC's normal internet connection and has none of these
restrictions — pick up execution there.

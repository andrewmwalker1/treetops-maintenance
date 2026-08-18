# Tree Tops Maintenance Platform — Claude Code instructions

Read BUILD-BRIEF.md for the full architecture/spec and RUNBOOK.md for
setup/deploy steps. This file is the short version: things to check or do
automatically, every session.

## Before doing anything

1. Run `git status` and `git log -1` — confirm a clean, up to date `main`
   before editing anything.
2. This is a **separate Supabase project** from Tree Tops Hub
   (`qkbpsqlrzygcairtidye`) — never point this app at the Hub's project,
   and never assume Hub migrations/tables apply here.
3. The deploy pipeline (`.github/workflows/deploy.yml`, GitHub Pages) is
   **confirmed live**, hooked up to the custom domain
   `jobs.treetops.co.uk`. Pushing to `main` builds and deploys
   automatically — no need to ask before assuming this works.

## Architecture (see BUILD-BRIEF.md for full detail)

- React + Vite, PWA-first (no Capacitor wrapper yet, but code is
  structured so that's a swap not a rewrite later — see BUILD-BRIEF.md
  §2 for the three platform-abstraction modules:
  `src/platform/notifications.js`, `syncQueue.js`, `camera.js`. Every
  other part of the app should call these, never the underlying browser
  APIs directly).
- Supabase backend: multi-tenant data model (organisations → sites →
  profiles/roles/groups → jobs), built multi-tenant-ready from day one
  even though Tree Tops is currently the only org — don't add
  multi-tenant UI/admin screens beyond what Tree Tops itself needs yet.
- Offline support via IndexedDB + foreground flush (not true background
  sync — iOS Safari doesn't support the Background Sync API, so don't
  rely on it; flush is triggered on app load/foreground and
  `window.online` events).

## Hard rules — do not violate these

- Any Supabase SQL change: add a new numbered file in `supabase/` (don't
  edit an already-applied one) AND actually run it against the live
  project — every migration file is idempotent, safe to re-run.
- Never put the Supabase **service role key** in `.env` or any
  `VITE_`-prefixed variable — it must never reach the browser. Only
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and
  `VITE_VAPID_PUBLIC_KEY` belong client-side.
- Every dependency change → regenerate `package-lock.json` in the same
  commit, or `npm ci` fails in CI.
- `role_visibility` beyond Head Gardener needs Andy's confirmation before
  building further on it (flagged as pending in BUILD-BRIEF.md/RUNBOOK.md
  since the project started).

## Current known state (from git log — confirm anything time-sensitive
with Andy rather than assuming it's still accurate)

Already built: job creation/scheduling, offline sync with RLS fixes,
equipment CRUD (Admin, with Make/Model/serial/other ID/date added,
filter by type, popout modal for mobile), Roles & Permissions admin
screen, checklist item editing, template activities, user admin, RA/MS
documents on equipment types (mirrors activity types, same admin pattern),
and a kiosk Health & Safety screen (browse/filter every RA/MS document by
activity or equipment type) plus a Health & Safety button on kiosk
check-out (now reachable even when a type has zero available units, not
just once units exist). Kiosk jobs list now matches the main app's default
(open jobs only, Completed behind a Filters toggle) and shows the same
location/assignee detail line as the desktop job cards. Kiosk check-in now
supports the same tick-many-then-continue flow as check-out for
multi-checkout equipment types. The admin "Checkout Log" is now "Equipment
history" — checkouts, faults, and repairs merged into one chronological,
filterable log per machine. Contractors can now have documents (proof of
qualifications/insurance/H&S, each with an optional expiry) attached via a
"Documents" button; `contractor-document-reminders` (daily cron, not yet
deployed/scheduled — see RUNBOOK.md) raises an Office job and emails the
contractor 7 days before each document's expiry.

Since then: **push notifications** now actually fire — job creation and
reassignment push the person/group assignee (`src/lib/jobAssignmentNotify.js`),
and the recurring-job generator pushes both on generation and with a
same-day due-date reminder if a scheduled job isn't completed yet (see
SYSTEMSPEC.md §7/§13). **Recurring jobs (Schedules)** now have full field
parity with New Job — required description, priority, person/group
assignee, pitch/area location, activity types — plus a **pause/resume**
toggle (`schedules.is_active`) instead of delete-only. **Mobile UI**: the
header's account controls collapse into a single avatar menu below 640px
(`AccountMenu` in `Layout.jsx`) so more than one job is visible on a
phone screen, and the Jobs list's status/priority filter chip strips show
a fading edge hint when they scroll. **User admin** can now edit a user's
email address (`manage-users`' `update_email` action); the "Signups not
allowed for this instance" bug some invited users hit at login is fixed
by force-confirming email at invite time (root cause: `signInWithOtp` on
a never-confirmed account is treated as a blocked fresh signup — see
SYSTEMSPEC.md §7's `manage-users` row). **Per-checklist-item photo
requirement**: safety-critical checklist items can be flagged (camera
icon replaces the checkbox) via `can_require_checklist_item_photo`, with
a separate `can_check_off_item_without_photo` override kept explicitly
visible rather than folded into a checkbox — both granted to Head
Gardener as well as Admin. Full detail in SYSTEMSPEC.md §6.3a.

Still open per RUNBOOK.md: pitch CSV not yet supplied (pitches table has
only `pitch_number_or_name` until Andy sends real data), genuine offline
testing (aeroplane mode) not yet done. Deploy pipeline is confirmed live
(see note above).

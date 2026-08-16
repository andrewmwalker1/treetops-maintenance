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
3. **RUNBOOK.md's "What's NOT done yet" section says no deploy pipeline
   exists** — but `.github/workflows/deploy.yml` (GitHub Pages, same
   pattern as Hub) is present in the repo. RUNBOOK.md is out of date on
   this point specifically; confirm with Andy whether the Pages deploy is
   actually live and hooked up to a real domain before assuming either
   way.

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

- Any Supabase SQL change: update the matching file in `supabase/` AND
  actually run it against the live project — the four migration files
  are idempotent, safe to re-run.
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
screen, checklist item editing, template activities, user admin.

Still open per RUNBOOK.md: pitch CSV not yet supplied (pitches table has
only `pitch_number_or_name` until Andy sends real data), genuine offline
testing (aeroplane mode) not yet done, deploy pipeline status unconfirmed
(see note above).

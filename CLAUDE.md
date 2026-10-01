# Tree Tops Maintenance Platform — Claude Code instructions

Read BUILD-BRIEF.md for the full architecture/spec and RUNBOOK.md for
setup/deploy steps. This file is the short version: things to check or do
automatically, every session.

## Before doing anything

1. Run `git status` and `git log -1` — confirm a clean, up to date `main`
   before editing anything.
2. This app owns the shared Supabase project (`ozhwgrzlpvfdemmogmav`) —
   Tree Tops Hub and ParkMan2 were migrated into it on 28 Aug 2026 (see
   `SUPABASE-CONSOLIDATION-PLAN.md`), each in its own schema (`hub`,
   `parkman2`), while this app keeps using `public` and stays otherwise
   untouched. Never write cross-schema queries or assume Hub/ParkMan2
   tables live in `public` — they're isolated by schema, not by project.
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
- **Bump the version on every push to `main`** (each push is a deploy):
  `npm version patch --no-git-tag-version` (updates `package.json` and
  `package-lock.json` together) in the same commit, so 1.1.0 → 1.1.1 →
  1.1.2… Only bump the minor number (`npm version minor
  --no-git-tag-version`, e.g. → 1.2.0) when Andy says a release is a new
  version. Numbering started at 1.1.0 on 24 Sep 2026. It's shown to users
  as `v1.1.0 · 24 Sep 2026, 16:32` (`src/lib/buildInfo.js`).
- `role_visibility` beyond Head Gardener needs Andy's confirmation before
  building further on it (flagged as pending in BUILD-BRIEF.md/RUNBOOK.md
  since the project started).

## UI rules

Full detail and rationale: BUILD-BRIEF.md §8 (single source of visual
truth — update it in the same commit as any token change).

- All colour, size, spacing and radius come from a token
  (`src/styles/tokens.css`, or `src/lib/theme.js` in an inline style) —
  never a literal hex, px or `rgba(...)`.
- All controls are built from `src/ui/` (`Button`, `Field`, `Card`,
  `Table`, `Modal`, `Menu`, `Pill`, `Chip`, `PageHeader`, `EmptyState`,
  `Alert`, the icon set…), not a raw `<button style={{}}>` or a
  re-declared local `fieldStyle`/`labelStyle`.
- The print components (`src/components/Printable*`,
  `src/lib/printJobCards.jsx`) are the one documented exception — a
  separate document these tokens never reach, so they carry a deliberate,
  duplicated copy of the few values they need.
- `scripts/check-styles.mjs` checks changed files for the first two rules
  and fails the deploy workflow (`.github/workflows/deploy.yml`) on any
  violation, so fix its warnings before pushing. Run it locally against a
  specific base commit with
  `CHECK_STYLES_BASE=<sha> node scripts/check-styles.mjs`.

## Current state

What's built lives in `git log` and SYSTEMSPEC.md — read those rather
than a summary here, and confirm anything time-sensitive with Andy.

Still open (RUNBOOK.md, "What's NOT done yet"): the
`equipment-document-reminders` cron isn't scheduled yet, `role_visibility`
beyond Head Gardener (see Hard rules), and genuine offline testing
(aeroplane mode) hasn't been done.

# Security plan (review of 17 Nov 2026)

A whole-system security review found one serious issue and a few smaller
ones. Nothing below has been built yet — Andy approved the plan and will
schedule it. Work through it top to bottom; the first two items belong in
the same PR.

## What's already in good shape (checked 17 Nov 2026)

- All 91 `public` tables have RLS enabled; every policy checks the caller
  (`rfid_login_attempts` has none on purpose — service role only).
- Every storage bucket this app owns is private, confirmed on the live
  project, not just in the migrations.
- All 43 `security definer` functions set `search_path`. The holiday
  balance functions gate on `can_view_holiday_status()`.
- No secret keys in the live bundle or in git history — only the anon /
  publishable key, which is public by design.
- `manage-users` and `send-contractor-job-email` check permissions;
  contractor emails escape their HTML.
- HTTPS is enforced (HSTS); no `dangerouslySetInnerHTML` in `src/`.
- Supabase Auth → "Allow new users to sign up" is **off** (Andy confirmed).

## 1. Fob sign-in can be used from anywhere (serious)

**Problem.** `supabase/functions/rfid-login` returns a working magic-link
sign-in for whoever sends it a fob's tag UID. It never checks that the
request came from a kiosk or key station, and a fob UID isn't secret — any
NFC phone reads it. 14 fobs are registered, including Admin, Office and
Park Manager. The caller can also skip `register-terminal-session`, so the
session gets no `login_context` and none of the kiosk restrictions apply:
a full account session.

**Constraint.** Admin, Office and Park Manager check keys out, so their
fobs can't simply be removed. Nic sometimes signs in to the key station by
fob on her office PC, which she also uses for the main system.

**Fix — two parts:**

1. *Device passes.* New `terminal_devices` table (org, kind
   `kiosk`|`key_station`, label, hashed token, created_by/at, revoked_at)
   plus a new Edge Function (or RPC) that an admin calls, signed in by
   email **on the device itself**, from **Admin → Devices → "Set up this
   device for fob sign-in"**. It returns a random token, stored only in
   that device's `localStorage`. `rfid-login` requires the token (header),
   checks it against an unrevoked row of the matching kind, and registers
   the terminal session server-side so `login_context` is always set.
   Rollout switch: an org-level setting "Only set-up devices can use fob
   sign-in", off until every device is set up, so nothing breaks
   mid-rollout. A device whose storage is cleared shows "This device isn't
   set up for fob sign-in" — redo the setup. Lost device: revoke it in the
   Devices list.
2. *Fob sessions limited in the database.* A session with
   `login_context` set may only do kiosk/key-station work (key and
   equipment checkout/check-in, fault reports), whatever the role — RLS /
   RPC checks on `session_login_context()`, matching what `App.jsx`
   already restricts in the UI. Admin work still needs the normal email
   sign-in.

**Unchanged for staff:** the office RFID reader (Admin → Key tags, the
Key register pages) types tag IDs into the normal signed-in app and never
touches `rfid-login`. Admin can still tap in at the garage terminal to
check out kit. Nic can carry on as now — her PC gets set up as a key
station; her email login and the main system are unaffected.

**Optional extra:** if the park broadband has a fixed public IP, restrict
`rfid-login` to it.

**Devices to set up:** garage kit terminal (kiosk), key station, Nic's PC
(key station).

## 2. Bank-holiday helpers callable by any user (medium)

**Status (18 Nov 2026):** migration written —
`supabase/89-revoke-bank-holiday-helpers.sql`. Not yet run against the
live project (no SQL route from a cloud session); run it in the SQL Editor.

`apply_bank_holiday_for_profile` and `remove_bank_holiday_for_profile`
(`70-holiday-accrual-and-booking.sql`) are `security definer` with no
caller check and Postgres's default `EXECUTE` to `PUBLIC`, so any signed-in
user can add or delete bank-holiday rows on anyone's timesheet via
`/rest/v1/rpc/…`. They're only meant to be called from triggers.

**Fix:** new migration —
`revoke execute on function public.apply_bank_holiday_for_profile(uuid, uuid) from public, anon, authenticated;`
(same for `remove_…`). The triggers keep working: their own `security
definer` functions run as the owner.

## 3. Push notices accept anything (lower)

`send-notice-push` only checks the caller is signed in, then takes any
title, body, priority (including `safety_critical`, which bypasses Do Not
Disturb) and `data` (whose `url` `sw.js` opens on tap). The app itself
only ever sends `job_assigned` and `linked_job_closed`, `operational`,
with `data: { jobId }`.

**Fix:** for non-service callers, accept only those two trigger types plus
a `jobId` the caller can see, build title/body server-side from the job,
force `operational`; in `sw.js`, only open same-origin URLs.

## 4. Cron functions callable with the public key (low)

`generate-scheduled-jobs`, `contractor-document-reminders` and
`equipment-document-reminders` have no caller check. They de-duplicate,
so the worst case is an early run. **Fix:** require the service-role
bearer the cron job already sends.

## 5. Housekeeping (low)

- `npm audit`: `react-router` / `react-router-dom` have 2 moderate
  advisories → `npm audit fix`, commit `package-lock.json`.
- The public `info-pdfs` bucket (Hub/ParkMan2, not this app) holds guest
  notices — fine — but check the Wi-Fi User Guide doesn't include the
  Wi-Fi password.
- Backup/DR tier is still open (BUILD-BRIEF.md §11).

## Doing it

Remote part: merge the PR; run the migration in the SQL editor (Maintenance
Hub, `ozhwgrzlpvfdemmogmav`); deploy `rfid-login`, `send-notice-push`, the
new device-setup function and the three cron functions (RUNBOOK §5). If a
Supabase access token is added to the cloud environment, Claude can run
the SQL and deploys itself. On-site part: set up each device (≈2 min
each), then switch on "Only set-up devices can use fob sign-in".

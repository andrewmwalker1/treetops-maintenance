# [Your Business Name] Maintenance Platform — Claude Code Build Brief

*Adapted as a generic starting brief for a fresh, independent build — hand
this to Claude Code, in your own repo, connected to your own Supabase
project, as-is. It describes a working system (maintenance + H&S job
tracking) that was originally built for a different, unrelated business;
names, industry-specific terms, and secrets have been stripped out and
replaced with placeholders. Nothing about this document or the companion
`SYSTEMSPEC.md` requires any connection to that original system — this is
meant to be the seed of a completely separate codebase, database, and
deployment.*

**Before you start, know this one limitation:** the data model below is
deliberately built "multi-tenant-ready" — organisations → sites → jobs —
so that, in principle, one deployment could serve several sites or several
businesses. **In practice, no admin screen was ever built to create a
second site, switch between sites, or manage per-site settings.** The app
only actually works for a single site per deployment today (see Section 11
and the note on `site_scope` in Section 3). If you need multiple sites or
locations from day one, budget time to build that admin UI as part of this
build — don't assume it exists just because the database could support it.

## 0. What this is

A working maintenance + health & safety job-tracking app: staff log jobs
against locations, attach photos and checklists, follow recurring
schedules, and manage a fleet of shared equipment (tools, machinery —
whatever your business actually uses) including fault reporting.

The platform was originally designed as the first deployment of a
multi-tenant system meant to support multiple organisations, multiple
sites, and different industries — but only ever built out for **one**
organisation and **one** site's actual needs (see the callout above).
Don't build multi-tenant UI/admin screens beyond what your own business
needs yet; do get the *data model and access control* right from day one,
since retrofitting tenant isolation later is far more painful than
building it in now.

Visual direction, tone, and full UI reference: a complete working design
system exists (see Section 8) — reproduce its tokens exactly rather than
reinterpreting, unless you'd rather restyle the app for your own brand
from the start (in which case, treat Section 8 as a reference for *how*
to structure theming, not the specific colours/fonts to use).

---

## 1. Architecture Decisions

- **Backend**: Supabase — Postgres, Auth, Row Level Security, Storage (for photos).
- **Frontend**: React, mobile-first responsive design (not two separate codebases for mobile/web).
- **Delivery**: **PWA first.** Do not build a Capacitor/native wrapper yet. However, structure the code so that migrating to Capacitor later is a swap, not a rewrite — see Section 2.
- **Fresh start** — no existing job records or legacy system to migrate from.

### 2. Platform abstraction boundary (important — read before starting)

Three areas of the app touch platform-specific capability. Isolate each behind a small module with a stable function signature, so the *internals* can be swapped for Capacitor later without touching calling code elsewhere in the app:

- **`src/platform/notifications.js`** — expose `subscribeToPush()`, `sendNotification(payload)`, `isDNDEnabled()`. Implement now using the Web Push API. Do not let any other file call the Web Push API directly.
- **`src/platform/syncQueue.js`** — expose `queueJob(jobData)`, `flushQueue()`, `getQueueStatus()`. Implement now using IndexedDB + a foreground flush triggered on app load/foreground (not true background sync — iOS Safari doesn't support Background Sync API, so don't rely on it). Call `flushQueue()` on app mount and on `window.online` events.
- **`src/platform/camera.js`** — expose `capturePhoto()`. Implement now using a standard `<input type="file" accept="image/*" capture>`.

Every other part of the app should call these three modules, never the underlying browser APIs directly.

---

## 3. Data Model

### Tenancy & structure
- **organisations**: `id`, `name`, `created_at`. Seed: one row, "[Your Business Name] Ltd".
- **sites**: `id`, `org_id`, `name`, `site_type` (enum/text — pick a short slug for your industry), `terminology_overrides` (jsonb, nullable — per-key label overrides), `branding_overrides` (jsonb, nullable — logo url, colours). Seed: one row, "[Your Business Name]".
- **terminology_templates**: `id`, `site_type`, `key`, `default_label`. Seed whatever location/unit terms your business actually uses (the original used `park`→Park, `pitch`→Pitch, `area`→Area for a caravan park; use your own equivalents — "site"/"building"/"zone", "unit"/"room"/"pitch", whatever fits).
- **pitches** (rename freely — this is "the specific locations work happens against", called `pitches` in the original because that business was a caravan park): `id`, `site_id`, plus an identifier column and whatever other fields your business needs to track locations. Seed from a real export of your own location data once you have it — a placeholder structure is fine to start.
- **areas**: `id`, `site_id`, `name` (free text), `created_by`, `created_at`. Grows via usage; simple admin CRUD to merge/rename.

### People & access
- **profiles**: `id` (matches `auth.users.id`), `org_id`, `role_id`, `display_name`, `is_contractor` (boolean), `dnd_enabled` (boolean, default false).
- **roles**: `id`, `org_id`, `name`. Seed with whatever roles match your own team structure — typically one Admin plus a small number of operational roles.
- **permissions**: fixed list of permission keys (`can_reallocate_jobs`, `can_export_jobs`, `can_manage_equipment_status`, etc.) — implement as a `role_permissions` join table (`role_id`, `permission_key`, `enabled`).
- **role_visibility**: `role_id`, `visible_role_id` — which other roles' jobs this role can see. Fixed per org, configured once. There's no universal default — decide this deliberately for your own team (e.g. a supervisor role seeing the roles beneath it but not an office/admin-only role).
- **groups**: `id`, `org_id`, `name`. Seed one group per operational role that needs group-level job assignment.
- **group_members**: `group_id`, `profile_id`.
- **site_scope**: `profile_id`, `site_id` — which sites a user can access. For a single-site deployment every user gets one row; this table is what makes the "skip the site picker" UI rule work (if a user's site_scope resolves to exactly one site, don't show a site selector) — see the callout at the top of this document before assuming you'll always be single-site.
- **platform_admins**: `profile_id` — structurally separate from any org's Admin role. Not needed for a first release but include the table now so the RLS pattern (see Section 4) is in place from the start.

### Jobs
- **job_types**: `id`, `org_id`, `name`, `template_schema` (jsonb — defines checklist fields), `task_type_id` (nullable, links to risk assessment + equipment category), `requires_completion_photo` (boolean).
- **task_types**: `id`, `org_id`, `name` (e.g. an activity your team performs regularly), `risk_assessment_id`, `equipment_category` (nullable).
- **jobs**: `id`, `org_id`, `site_id`, `job_type_id` (nullable), `description`, `assignee_profile_id` (nullable), `assignee_group_id` (nullable — exactly one of these two should be set), `priority` (enum: low/medium/high/immediate), `status_id`, `due_date` (nullable), `lead_in_date` (nullable), `pitch_id` (nullable), `area_id` (nullable), `closed_by` (nullable, profile_id — who moved it to a completed status; may differ from assignee), `created_by`, `created_at`, `client_generated_id` (uuid, for offline creation dedup).
- **job_statuses**: `id`, `org_id`, `name`, `is_completed` (boolean), `sort_order`. Default seed: Open, In Progress, Completed, Cancelled.
- **job_photos**: `id`, `job_id`, `storage_path`, `uploaded_by`, `uploaded_at`.
- **job_subtasks**: `id`, `job_id`, `label`, `is_checked`, `sort_order`.
- **job_activity**: `id`, `job_id`, `event_type` (status_change / reallocation / comment / edit), `actor_profile_id`, `previous_value` (jsonb, nullable), `new_value` (jsonb, nullable), `created_at`. Edits tracked, not immutable — don't hard-delete or hard-block updates to this table, but never allow deleting rows.
- **schedules**: `id`, `org_id`, `site_id`, `job_type_id`, `rrule` (text, standard RRULE format), `lead_in_days` (int), `last_generated_date` (nullable).

### Equipment & H&S
- **equipment**: `id`, `org_id`, `site_id` (nullable if employee-held), `held_by_profile_id` (nullable if site-held — exactly one of `site_id`/`held_by_profile_id` context matters, but site_id may still be set for org reference even when held by a person; decide which convention fits your business if ambiguous), `name`, `status` (enum: in_service/faulty/in_repair/scrapped), `check_frequency_days`.
- **equipment_checks**: `id`, `equipment_id`, `checked_by`, `checked_at`, `passed` (boolean).
- **fault_reports**: `id`, `equipment_id`, `reported_by`, `description`, `appointed_person_id`, `created_at`.
- **fault_photos**: `id`, `fault_report_id`, `storage_path`.
- **repair_records**: `id`, `equipment_id`, `fault_report_id` (nullable), `note` (required), `cost` (nullable), `vendor` (nullable), `repaired_at` (nullable), `repaired_by`.
- **risk_assessments**: `id`, `org_id`, `task_type_id`, `content` (rich text or structured), `updated_at`.
- **training_videos**: `id`, `org_id`, `task_type_id` (nullable), `equipment_category` (nullable), `youtube_url`, `title`.

### Notifications & exports
- **notifications**: `id`, `recipient_profile_id`, `trigger_type`, `priority` (`safety_critical` / `operational`), `payload` (jsonb), `delivered_at` (nullable — null means queued behind DND).
- **export_logs**: `id`, `exported_by`, `org_id`, `filters_used` (jsonb), `exported_at`.

---

## 4. Access Control (Row Level Security)

Enforce all of the following at the Postgres level. Never rely on client-side filtering for anything security-relevant.

1. **Organisation boundary**: every tenant-scoped table's RLS policy requires `org_id` to match the requesting user's `org_id` (read from their `profiles` row via `auth.uid()`).
2. **Site scope**: for site-scoped tables (jobs, equipment, pitches, areas), the row's `site_id` must be in the user's `site_scope`.
3. **Role visibility**: for `jobs` specifically, a row is visible if: `site_id` is in scope, **AND** (`assignee_profile_id = auth.uid()` OR `assignee_group_id` is one of the user's groups OR the assignee's role is in the user's `role_visibility` list OR the user has an org-wide "see everything" permission).
4. `job_activity` inherits visibility from its parent `jobs` row (write a policy that joins back to `jobs` and applies the same check).
5. **Platform admin carve-out**: add narrow additional policies (not a blanket bypass) allowing rows where `EXISTS (SELECT 1 FROM platform_admins WHERE profile_id = auth.uid())` — apply this only to tables that genuinely need it (organisations, sites for onboarding; full read access to client data for support, per Section 6 below), not universally.
6. Every `platform_admins` access to another org's operational data should be logged — add an `admin_access_log` table (`profile_id`, `org_id`, `table_accessed`, `accessed_at`) if implementing this now, though it can be deferred if you're truly the only org for launch.

**Auth / contractor login**: use standard Supabase Auth invite flow (`inviteUserByEmail`) for every user type — staff and contractors are both just `profiles` rows with a `site_scope`. There is no separate contractor auth mechanism needed.

---

## 5. Job Lifecycle Logic

- **Status workflow**: seed with Open → In Progress → Completed, plus Cancelled. `is_completed` flag on a status determines when `closed_by` gets set and when your designated admin/office role gains visibility (visibility only — do not reassign `assignee_profile_id` on completion).
- **Completion photo rule**: on attempting to move a job to a status where `is_completed = true`:
  - If the job's `job_type.requires_completion_photo` is true, and there are zero rows in `job_photos` for this job, **and** `closed_by = assignee_profile_id`, show a confirm dialog ("No photo added — complete anyway?") — do not hard-block.
  - If `closed_by != assignee_profile_id` (someone completing on another person's behalf), skip this check entirely — no warning.
- **Scheduling**: implement as a Supabase Edge Function running daily (cron). For each active `schedule`, calculate the next occurrence from its RRULE; if `today >= next_due_date - lead_in_days` and a job hasn't already been generated for that occurrence, create the `job` row with a link back to the `schedule_id` and set `last_generated_date`.
- **Offline job creation**: on the client, generate jobs with a `client_generated_id` (uuid) the moment the user saves, write to local IndexedDB via `syncQueue.js`, and attempt `flushQueue()` immediately and on reconnect. No conflict resolution logic needed for v1 — last-write-wins is acceptable given this is treated as a rare edge case.
- **Reallocation**: gated by `can_reallocate_jobs` permission; writes a `job_activity` row (`event_type = 'reallocation'`, previous/new assignee in the value fields). Note: reallocation across `site_scope` boundaries is an open question (does the new assignee need implicit access to that job specifically, or the whole site?) — for a single-site launch this doesn't arise in practice, but don't hardcode an assumption that would break when a second site/org is added.

---

## 6. Terminology & Theming

- Every UI string that could vary by industry must be pulled from a terminology lookup (site's `terminology_overrides` merged over its `terminology_templates` defaults), never hardcoded as an industry-specific term in components.
- Branding (logo, colours) follows the same override pattern: org-level default, site-level override. For a single-org, single-site deployment this is trivial, but build the lookup mechanism properly rather than hardcoding your own colours directly into components.

---

## 7. Notifications & Reporting

- Push via Web Push API (see `platform/notifications.js`). Every notification carries `priority`. `safety_critical` sends immediately regardless of `dnd_enabled`. `operational` checks `dnd_enabled` first; if true, leave `delivered_at` null and deliver everything queued the moment the user's `dnd_enabled` flips to false.
- Dashboard, job list filtering, and CSV export all reuse the same underlying query (site scope × role visibility × filters) — build one filtered-jobs query function and reuse it across all three surfaces rather than three separate implementations.
- CSV export gated by `can_export_jobs`; every export writes an `export_logs` row (who, filters, timestamp) before returning data.

---

## 8. Visual Design Reference (an example design system — "Field Journal")

This is the original app's design direction, included as a complete, working example you can reproduce exactly if you like it, or treat purely as a reference for *how* the app structures theming (a single token module, no hardcoded colours in components) while picking your own palette/fonts instead.

**Colours**
```
--bg:        #E7E2CC   (page background)
--paper:     #FBF9F1   (card/panel surface)
--ink:       #31382D   (primary text)
--ink-soft:  #78806E   (secondary text)
--moss:      #5C7A4E   (primary action colour, low priority)
--moss-dark: #3F5837   (headings, nav active state)
--clay:      #A65A34   (high priority, secondary accent)
--gold:      #C9962F   (medium priority, "open" status tag)
--immediate: #8C3A22   (immediate priority — combine with a diagonal hazard stripe pattern, not solid fill)
--line:      #DDD6BC
--line-strong: #CBC2A0
```

**Priority indicator**: use a solid rounded colour bar (6px wide, rounded, `moss`/`gold`/`clay`/`immediate`-with-hazard-stripe) next to each job, not icon-based badges.

**Typography**: `Lora` (serif, weight 600–700, sometimes italic for headings) for display/headings; `Work Sans` for body and UI; `IBM Plex Mono` for IDs, timestamps, data labels.

**Shape language**: generously rounded corners (12–20px on cards/buttons), soft shadows, pill-shaped tags and buttons — warm and approachable, not sharp/industrial.

**Status tags**: pill-shaped, filled colour, white text — Open = gold, In Progress = clay, Completed = moss.

---

## 9. Example Seed Data

*The shape below mirrors the original deployment's seed (a small caravan-park gardening/maintenance team) — replace the actual names, roles, and groups with whatever fits your own business before running the seed script. The structure (one Admin, a handful of operational roles, matching groups) is the part worth keeping; the specific labels aren't.*

- **Organisation**: "[Your Business Name] Ltd"
- **Site**: "[Your Business Name]", `site_type` — pick a short slug for your industry
- **Roles** (example): Admin, plus 2-4 operational roles matching how your team is actually organised (e.g. a supervisor role, one or two "does the work" roles, an office/admin-visibility role)
- **Groups**: one per operational role that needs group-assignment of jobs, mirroring the roles above
- **Users**: one Admin (you), plus one real user per role/group you seed — use real email addresses from the start; there's no placeholder-email step to remember to undo later
- **Role visibility**: decide, per role, which other roles' jobs it should see (see Section 4, `role_visibility`) — there's no default that fits every business, so this needs a deliberate decision up front
- **Site scope**: every user scoped to the single site (so the "skip site picker" behaviour applies automatically) — see the callout at the top of this document before assuming this stays true as you grow.

---

## 10. Suggested Build Order

1. Supabase schema migration (all tables in Section 3), plain SQL.
2. RLS policies (Section 4) — write and test these before building any UI against them.
3. Auth + seed script (roles, groups, users) using `inviteUserByEmail`.
4. Core job CRUD + job list, filtered by site scope × role visibility (server-side, verified via RLS not just query filters).
5. Job detail screen: checklist, photos, comments, activity log.
6. Equipment + fault reporting.
7. Scheduling Edge Function.
8. Notifications (Web Push).
9. Dashboard + CSV export.
10. PWA manifest, service worker, offline queue (`platform/syncQueue.js`), test genuinely offline (aeroplane mode) before considering this done.

---

## 11. Open Questions to Resolve During or Before Build

- **Multi-site admin UI does not exist** (see the callout at the top of this document) — if you need more than one site under this organisation, treat building a site picker + site-management admin screen as new scope, not something already covered by the data model.
- Exact `role_visibility` mapping for every role in your own team — there's no sensible default to copy; decide this deliberately.
- Location/pitch data — seed a placeholder structure until you have a real export of your own locations to import.
- Backup/DR tier on Supabase — review against your own actual scale; not a blocker for initial build but confirm before go-live.

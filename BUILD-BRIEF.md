# Tree Tops Maintenance Platform — Claude Code Build Brief

*Prepared July 2026. This is the starting brief for implementation — hand this to Claude Code as-is.*

## 0. What this is

Tree Tops Caravan Park Ltd needs a working maintenance + H&S tracking app, migrated from an existing client-side React prototype (`treetops-maintenance.jsx`, using `window.storage`, no real backend) to a proper Supabase-backed system.

Tree Tops is the **first deployment** of a platform designed from the outset to support multiple organisations, multiple sites, and different industries (not just caravan parks) — but build for Tree Tops' actual needs first. Don't build multi-tenant UI/admin screens Tree Tops doesn't need yet; do get the *data model and access control* right from day one, since retrofitting tenant isolation later is far more painful than building it in now.

Visual direction, tone, and full UI reference: four working HTML/CSS prototypes have already been produced and approved (see Section 8 — reproduce their design tokens exactly rather than reinterpreting).

---

## 1. Architecture Decisions

- **Backend**: Supabase — Postgres, Auth, Row Level Security, Storage (for photos).
- **Frontend**: React, mobile-first responsive design (not two separate codebases for mobile/web).
- **Delivery**: **PWA first.** Do not build a Capacitor/native wrapper yet. However, structure the code so that migrating to Capacitor later is a swap, not a rewrite — see Section 2.
- **No data migration needed** — this is a fresh start, no existing job records to carry forward from the old prototype.

### 2. Platform abstraction boundary (important — read before starting)

Three areas of the app touch platform-specific capability. Isolate each behind a small module with a stable function signature, so the *internals* can be swapped for Capacitor later without touching calling code elsewhere in the app:

- **`src/platform/notifications.js`** — expose `subscribeToPush()`, `sendNotification(payload)`, `isDNDEnabled()`. Implement now using the Web Push API. Do not let any other file call the Web Push API directly.
- **`src/platform/syncQueue.js`** — expose `queueJob(jobData)`, `flushQueue()`, `getQueueStatus()`. Implement now using IndexedDB + a foreground flush triggered on app load/foreground (not true background sync — iOS Safari doesn't support Background Sync API, so don't rely on it). Call `flushQueue()` on app mount and on `window.online` events.
- **`src/platform/camera.js`** — expose `capturePhoto()`. Implement now using a standard `<input type="file" accept="image/*" capture>`.

Every other part of the app should call these three modules, never the underlying browser APIs directly.

---

## 3. Data Model

### Tenancy & structure
- **organisations**: `id`, `name`, `created_at`. Tree Tops seed: one row, "Tree Tops Caravan Park Ltd".
- **sites**: `id`, `org_id`, `name`, `site_type` (enum/text — start with `'caravan_park'`), `terminology_overrides` (jsonb, nullable — per-key label overrides), `branding_overrides` (jsonb, nullable — logo url, colours). Tree Tops seed: one row, "Tree Tops", `site_type = 'caravan_park'`.
- **terminology_templates**: `id`, `site_type`, `key`, `default_label`. Seed at least: `park→Park`, `pitch→Pitch`, `area→Area`.
- **pitches**: `id`, `site_id`, `pitch_number_or_name`, plus whatever fields are in the CSV Andy will supply (ask for it / use placeholder structure if not yet available).
- **areas**: `id`, `site_id`, `name` (free text), `created_by`, `created_at`. Grows via usage; simple admin CRUD to merge/rename.

### People & access
- **profiles**: `id` (matches `auth.users.id`), `org_id`, `role_id`, `display_name`, `is_contractor` (boolean), `dnd_enabled` (boolean, default false).
- **roles**: `id`, `org_id`, `name`. Tree Tops seed: Admin, Head Gardener, Gardener, Maintenance, Office.
- **permissions**: fixed list of permission keys (`can_reallocate_jobs`, `can_export_jobs`, `can_manage_equipment_status`, etc.) — implement as a `role_permissions` join table (`role_id`, `permission_key`, `enabled`).
- **role_visibility**: `role_id`, `visible_role_id` — which other roles' jobs this role can see. Fixed per org, configured once. Tree Tops seed: Head Gardener sees Gardener + Maintenance (not Office); Admin sees all; Gardener/Maintenance/Office see only their own role by default (adjust per Andy's actual requirements when confirmed).
- **groups**: `id`, `org_id`, `name`. Tree Tops seed: Gardeners, Maintenance, Office.
- **group_members**: `group_id`, `profile_id`.
- **site_scope**: `profile_id`, `site_id` — which sites a user can access. For Tree Tops (single site) every user gets one row; this table is what makes the "skip the site picker" UI rule work (if a user's site_scope resolves to exactly one site, don't show a site selector).
- **platform_admins**: `profile_id` — structurally separate from any org's Admin role. Not needed for Tree Tops' first release but include the table now so the RLS pattern (see Section 4) is in place from the start.

### Jobs
- **job_types**: `id`, `org_id`, `name`, `template_schema` (jsonb — defines checklist fields), `task_type_id` (nullable, links to risk assessment + equipment category), `requires_completion_photo` (boolean).
- **task_types**: `id`, `org_id`, `name` (e.g. "Strimming"), `risk_assessment_id`, `equipment_category` (nullable).
- **jobs**: `id`, `org_id`, `site_id`, `job_type_id` (nullable), `description`, `assignee_profile_id` (nullable), `assignee_group_id` (nullable — exactly one of these two should be set), `priority` (enum: low/medium/high/immediate), `status_id`, `due_date` (nullable), `lead_in_date` (nullable), `pitch_id` (nullable), `area_id` (nullable), `closed_by` (nullable, profile_id — who moved it to a completed status; may differ from assignee), `created_by`, `created_at`, `client_generated_id` (uuid, for offline creation dedup).
- **job_statuses**: `id`, `org_id`, `name`, `is_completed` (boolean), `sort_order`. Tree Tops default seed: Open, In Progress, Completed, Cancelled.
- **job_photos**: `id`, `job_id`, `storage_path`, `uploaded_by`, `uploaded_at`.
- **job_subtasks**: `id`, `job_id`, `label`, `is_checked`, `sort_order`.
- **job_activity**: `id`, `job_id`, `event_type` (status_change / reallocation / comment / edit), `actor_profile_id`, `previous_value` (jsonb, nullable), `new_value` (jsonb, nullable), `created_at`. Edits tracked, not immutable — don't hard-delete or hard-block updates to this table, but never allow deleting rows.
- **schedules**: `id`, `org_id`, `site_id`, `job_type_id`, `rrule` (text, standard RRULE format), `lead_in_days` (int), `last_generated_date` (nullable).

### Equipment & H&S
- **equipment**: `id`, `org_id`, `site_id` (nullable if employee-held), `held_by_profile_id` (nullable if site-held — exactly one of `site_id`/`held_by_profile_id` context matters, but site_id may still be set for org reference even when held by a person; clarify with Andy if ambiguous), `name`, `status` (enum: in_service/faulty/in_repair/scrapped), `check_frequency_days`.
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
6. Every `platform_admins` access to another org's operational data should be logged — add an `admin_access_log` table (`profile_id`, `org_id`, `table_accessed`, `accessed_at`) if implementing this now, though it can be deferred if Tree Tops is truly the only org for launch.

**Auth / contractor login**: use standard Supabase Auth invite flow (`inviteUserByEmail`) for every user type — staff and contractors are both just `profiles` rows with a `site_scope`. This resolves the previously open question on contractor login method; there is no separate contractor auth mechanism.

---

## 5. Job Lifecycle Logic

- **Status workflow**: seed Tree Tops with Open → In Progress → Completed, plus Cancelled. `is_completed` flag on a status determines when `closed_by` gets set and when the "Office" role gains visibility (visibility only — do not reassign `assignee_profile_id` on completion).
- **Completion photo rule**: on attempting to move a job to a status where `is_completed = true`:
  - If the job's `job_type.requires_completion_photo` is true, and there are zero rows in `job_photos` for this job, **and** `closed_by = assignee_profile_id`, show a confirm dialog ("No photo added — complete anyway?") — do not hard-block.
  - If `closed_by != assignee_profile_id` (someone completing on another person's behalf), skip this check entirely — no warning.
- **Scheduling**: implement as a Supabase Edge Function running daily (cron). For each active `schedule`, calculate the next occurrence from its RRULE; if `today >= next_due_date - lead_in_days` and a job hasn't already been generated for that occurrence, create the `job` row with a link back to the `schedule_id` and set `last_generated_date`.
- **Offline job creation**: on the client, generate jobs with a `client_generated_id` (uuid) the moment the user saves, write to local IndexedDB via `syncQueue.js`, and attempt `flushQueue()` immediately and on reconnect. No conflict resolution logic needed for v1 — last-write-wins is acceptable given this is treated as a rare edge case.
- **Reallocation**: gated by `can_reallocate_jobs` permission; writes a `job_activity` row (`event_type = 'reallocation'`, previous/new assignee in the value fields). Note: reallocation across `site_scope` boundaries is an open question (does the new assignee need implicit access to that job specifically, or the whole site?) — for Tree Tops' single-site launch this doesn't arise in practice, but don't hardcode an assumption that would break when a second site/org is added.

---

## 6. Terminology & Theming

- Every UI string that could vary by industry must be pulled from a terminology lookup (site's `terminology_overrides` merged over its `terminology_templates` defaults), never hardcoded as "Park" or "Pitch" in components.
- Branding (logo, colours) follows the same override pattern: org-level default, site-level override. For Tree Tops (one org, one site) this is trivial, but build the lookup mechanism properly rather than hardcoding Tree Tops' colours directly into components.

---

## 7. Notifications & Reporting

- Push via Web Push API (see `platform/notifications.js`). Every notification carries `priority`. `safety_critical` sends immediately regardless of `dnd_enabled`. `operational` checks `dnd_enabled` first; if true, leave `delivered_at` null and deliver everything queued the moment the user's `dnd_enabled` flips to false.
- Dashboard, job list filtering, and CSV export all reuse the same underlying query (site scope × role visibility × filters) — build one filtered-jobs query function and reuse it across all three surfaces rather than three separate implementations.
- CSV export gated by `can_export_jobs`; every export writes an `export_logs` row (who, filters, timestamp) before returning data.

---

## 8. Visual Design Reference (Field Journal direction — approved)

Reproduce these tokens exactly. Full working HTML/CSS reference prototypes exist (mobile: jobs list, job detail, new job form, equipment; desktop: dashboard, job detail) — request them if not already provided alongside this brief.

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

**Priority indicator — important, revised from initial draft**: use a solid rounded colour bar (6px wide, rounded, `moss`/`gold`/`clay`/`immediate`-with-hazard-stripe) next to each job, NOT icon-based badges. This was explicitly preferred over an earlier icon-based ("leaf emoji") version — don't reintroduce icons for priority.

**Typography**: `Lora` (serif, weight 600–700, sometimes italic for headings) for display/headings; `Work Sans` for body and UI; `IBM Plex Mono` for IDs, timestamps, data labels.

**Shape language**: generously rounded corners (12–20px on cards/buttons), soft shadows, pill-shaped tags and buttons — warm and approachable, not sharp/industrial.

**Status tags**: pill-shaped, filled colour, white text — Open = gold, In Progress = clay, Completed = moss.

---

## 9. Tree Tops Seed Data

- **Organisation**: "Tree Tops Caravan Park Ltd"
- **Site**: "Tree Tops", `site_type = caravan_park`
- **Roles**: Admin, Head Gardener, Gardener, Maintenance, Office
- **Groups**: Gardeners, Maintenance, Office
- **Users**: Andy (Admin), Hazel (Head Gardener, member of Gardeners), Dave (Maintenance, member of Maintenance), Peter (Gardener, member of Gardeners), Sam (Office, member of Office) — replace placeholder emails with real addresses before running the invite script (per the earlier migration brief's open item).
- **Role visibility**: Head Gardener → sees Gardener + Maintenance roles' jobs (not Office); Admin → sees everything; others → own role only, pending Andy's confirmation on exact requirements per role.
- **Site scope**: every user scoped to the single Tree Tops site (so the "skip site picker" behaviour applies automatically).

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

- Exact `role_visibility` mapping for every role at Tree Tops (only Head Gardener's has been explicitly specified so far — confirm the rest with Andy).
- Pitch data — need the actual CSV from Andy to seed `pitches` correctly.
- Backup/DR tier on Supabase — Andy is reviewing this against Tree Tops' actual scale; not a blocker for initial build but confirm before go-live.

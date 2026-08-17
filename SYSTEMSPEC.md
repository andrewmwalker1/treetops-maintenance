# Tree Tops Maintenance Platform — System Specification

*Reverse-engineered from the working application as of August 2026 (22 SQL
migrations, 6 Edge Functions, full React frontend + kiosk). This document
describes what is actually built and running today, not the original
build brief — treat it as the authoritative reference for a developer
tasked with replicating this system exactly, on this stack or another.*

*Companion documents already in the repo: `BUILD-BRIEF.md` (the original
starting brief — superseded in many places by decisions made during
build; kept for historical context) and `RUNBOOK.md` (ops steps for
standing up a fresh Supabase project). This document supersedes both for
"what does the system actually do."*

---

## Table of contents

1. [What this system is](#1-what-this-system-is)
2. [Tech stack & architecture](#2-tech-stack--architecture)
3. [Repository layout](#3-repository-layout)
4. [Data model](#4-data-model)
5. [Access control (Row Level Security)](#5-access-control-row-level-security)
6. [Server-side business rules (triggers & RPCs)](#6-server-side-business-rules-triggers--rpcs)
7. [Edge Functions](#7-edge-functions)
8. [Frontend architecture](#8-frontend-architecture)
9. [Design system](#9-design-system)
10. [Screen-by-screen specification](#10-screen-by-screen-specification)
11. [Admin screens](#11-admin-screens)
12. [Kiosk mode](#12-kiosk-mode)
13. [Notifications](#13-notifications)
14. [Offline support & PWA](#14-offline-support--pwa)
15. [Build & deployment](#15-build--deployment)
16. [Seed data & bootstrap](#16-seed-data--bootstrap)
17. [Known gaps & open decisions](#17-known-gaps--open-decisions)
18. [Suggested build order for a rebuild](#18-suggested-build-order-for-a-rebuild)

---

## 1. What this system is

A maintenance and health & safety job-tracking Progressive Web App for
**Tree Tops Caravan Park Ltd**. Staff (gardeners, maintenance, office,
management) and occasional contractors track work items ("jobs") against
pitches or free-text areas of the park, attach photos and checklists,
follow recurring schedules, and manage a fleet of shared equipment
(strimmers, mowers, etc.) including fault reporting and a physical
workshop check-out/check-in kiosk driven by RFID fobs.

The system was **designed as the first deployment of a multi-tenant
platform** (organisations → sites → jobs/equipment), but only one
organisation (Tree Tops) and one site exist in practice. The data model
supports multiple organisations and multiple sites per organisation;
the UI, in its current state, **does not** — there is no site picker
anywhere in the app (see §17). Multi-tenancy is enforced correctly at
the database layer (RLS) even though nothing in the UI exercises it yet.

Core entities: **jobs** (the primary unit of work), **equipment** (the
tool fleet), **users/roles/groups/contractors** (who does the work),
**pitches/areas** (where work happens), **task types / RA-MS documents**
(what the work is and its associated H&S paperwork), and **schedules**
(recurring job generation).

---

## 2. Tech stack & architecture

| Layer | Choice |
|---|---|
| Backend | Supabase: Postgres + Row Level Security, Supabase Auth, Supabase Storage, Edge Functions (Deno) |
| Frontend | React 18, Vite 5, react-router-dom 6 — single-page app, no server-side rendering |
| Styling | No CSS framework. Every component uses inline `style={}` objects built from a shared design-token module (`src/lib/theme.js`). No component library. |
| State | React state + Context only. No Redux/Zustand/React Query — every page does its own Supabase queries in `useEffect`. |
| Delivery | PWA (installable, offline-tolerant), hosted as a static build on **GitHub Pages** with a client-side SPA-fallback trick (no server routing available). |
| Auth | Supabase Auth, **passwordless only** — magic link + 8-digit numeric OTP code, sent by email. No password field exists anywhere. A separate RFID-fob flow mints sessions for the workshop kiosk (see §12). |
| Push notifications | Web Push API (VAPID), no third-party push service. |
| Recurring jobs | `rrule` npm package (RFC5545 RRULE strings), evaluated server-side by a daily-cron Edge Function. |
| Offline queue | IndexedDB, foreground-flush only (no Background Sync API — iOS Safari doesn't support it). |
| Outbound email (contractor jobs) | Resend API, called from an Edge Function. |

### Platform abstraction boundary

Three browser capabilities are deliberately isolated behind small modules
with stable function signatures, so a future Capacitor/native wrapper can
swap the *internals* without touching any calling code elsewhere in the
app. **No other file may call these underlying browser APIs directly.**

- `src/platform/notifications.js` — `subscribeToPush()`, `sendNotification(payload)`, `isDNDEnabled()`, `setDNDEnabled(enabled)`. Implemented today with the Web Push API.
- `src/platform/syncQueue.js` — `queueJob(jobData)`, `flushQueue()`, `getQueueStatus()`. Implemented today with IndexedDB + foreground flush (on app load and on `window`'s `online` event).
- `src/platform/camera.js` — `capturePhoto()`. Implemented today with `<input type="file" accept="image/*" capture="environment">`.

---

## 3. Repository layout

```
supabase/
  01-schema.sql .. 22-contractor-email-activity-type.sql   -- ordered, idempotent SQL migrations, run once each in sequence
  functions/
    generate-scheduled-jobs/    -- daily cron: expands schedules into job rows
    send-notice-push/           -- sends a single Web Push notification (respects DND)
    flush-dnd-notifications/    -- delivers everything queued behind DND once it's turned off
    manage-users/               -- invite / deactivate / reactivate users (Auth Admin API)
    rfid-login/                 -- turns a scanned RFID tag UID into a magic-link session
    send-contractor-job-email/  -- emails a job's details to its assigned contractor
    contractor-document-reminders/ -- daily cron: Office job + contractor email 7 days before a document expires
scripts/
  seed-users.mjs                -- one-shot: invites the initial Tree Tops team
src/
  App.jsx                       -- top-level routing + auth gate
  lib/                          -- cross-cutting: auth, permissions, terminology, theme, shared queries
  components/                   -- shared UI: ChecklistBuilder, Layout, Modal, JobCard, PhotoThumb, PrintableJobCard, RfidScanListener, SafetyDocumentLink
  pages/                        -- top-level screens (Login, Dashboard, JobsList, NewJob, JobDetail, EquipmentList, EquipmentDetail, HealthAndSafety, Admin)
  pages/admin/                  -- the 13 admin tabs
  kiosk/                        -- self-contained workshop kiosk app (separate chrome/theme)
  platform/                     -- the three platform-abstraction modules
public/                         -- PWA icons, 404.html (SPA fallback), CNAME
sw.js                           -- hand-written service worker (Workbox libraries, custom logic)
vite.config.js                  -- build config + PWA manifest
index.html                      -- font loading + SPA-fallback bootstrap script
```

---

## 4. Data model

All tables live in the `public` schema of a single Postgres database.
`pgcrypto` is enabled for `gen_random_uuid()`. Every table uses `uuid`
primary keys. Postgres enums used: `job_priority` (low/medium/high/immediate),
`equipment_status` (in_service/faulty/in_repair/scrapped),
`notification_priority` (safety_critical/operational),
`job_activity_event_type` (status_change/reallocation/comment/edit/contractor_email),
`safety_document_type` (risk_assessment/method_statement).

### 4.1 Tenancy & structure

| Table | Key columns | Notes |
|---|---|---|
| **organisations** | `id`, `name`, `created_at` | Root tenant. One row today ("Tree Tops Caravan Park Ltd"). |
| **sites** | `id`, `org_id→organisations`, `name`, `site_type` (text, default `'caravan_park'`), `terminology_overrides` (jsonb, nullable), `branding_overrides` (jsonb, nullable), `created_at` | One row today ("Tree Tops"). `terminology_overrides` and `branding_overrides` let a site override the org-level industry defaults per-key without a schema change. |
| **terminology_templates** | `id`, `site_type`, `key`, `default_label`, unique(`site_type`,`key`) | Shared reference data (not tenant-scoped, readable by any authenticated user). Seeded keys for `caravan_park`: `park`→"Park", `pitch`→"Pitch", `area`→"Area". Only `pitch` and `area` are actually consumed by the UI today. |
| **pitches** | `id`, `site_id→sites`, `pitch_number_or_name`, `created_at`, unique(`site_id`,`pitch_number_or_name`) | Seeded from a real CSV export (206 codes, e.g. `OM-L01`, `PN-A17`). Minimal schema — extend if a future org needs richer pitch data. |
| **areas** | `id`, `site_id→sites`, `name` (free text), `created_by→profiles`, `created_at` | Grows organically: any user in site scope can create one by typing a new name in a job's location field. No admin merge/rename UI exists today despite being anticipated. |

### 4.2 People & access

| Table | Key columns | Notes |
|---|---|---|
| **profiles** | `id` (= `auth.users.id`), `org_id→organisations`, `role_id→roles` (nullable, `ON DELETE SET NULL`), `display_name`, `is_contractor` (bool), `dnd_enabled` (bool, default false), `is_active` (bool, default true) | The app-level user record. No `email` column — email lives on `auth.users`; a security-definer RPC (`list_org_users`) is the only way the client reads it. |
| **roles** | `id`, `org_id→organisations`, `name`, unique(`org_id`,`name`) | Full CRUD from the admin UI. Seed: Admin, Head Gardener, Gardener, Maintenance, Office. A role in use by any profile cannot be deleted (enforced by trigger). |
| **permissions** | `key` (text, PK), `description` | A fixed, growing list of permission keys — new features add new keys via migration, never a free-text/dynamic permission system. Full current list in §5.2. |
| **role_permissions** | `role_id→roles`, `permission_key→permissions`, `enabled` (bool), PK(`role_id`,`permission_key`) | The actual grant table. Managed via the Roles & Permissions admin matrix. |
| **role_visibility** | `role_id→roles`, `visible_role_id→roles`, PK(both) | Which *other roles'* job assignees a role can see jobs for. Fixed per org, configured once (no admin UI exists for this table — it's seed-only today). |
| **groups** | `id`, `org_id→organisations`, `name`, unique(`org_id`,`name`) | Seed: Gardeners, Maintenance, Office. Full CRUD via admin. |
| **group_members** | `group_id→groups`, `profile_id→profiles`, PK(both) | Managed inline on the Groups admin tab (checkbox list, diffed on save). |
| **site_scope** | `profile_id→profiles`, `site_id→sites`, PK(both) | Which sites a user can access. **A user with exactly one row here has that site auto-selected — no picker UI exists for 2+.** |
| **platform_admins** | `profile_id→profiles` (PK) | Structurally separate from any org's Admin role — cross-org support access. Table exists and is wired into RLS; not used operationally yet (no UI to add a platform admin). |
| **admin_access_log** | `id`, `profile_id`, `org_id`, `table_accessed`, `accessed_at` | Intended audit trail for `platform_admins` cross-org reads. Table exists; nothing currently writes to it (deferred — see §17). |
| **contractors** | `id`, `org_id→organisations`, `name`, `address`, `main_email`, `main_phone`, `notes`, `created_at` | Contractor **companies**, not `profiles`/`auth.users` rows — most contractors never log in. Full CRUD via admin. |
| **contractor_documents** | `id`, `org_id→organisations`, `contractor_id→contractors`, `description`, `expiry_date` (date, nullable), `storage_path` (nullable), `uploaded_by→profiles`, `uploaded_at`, `reminder_triggered_at` (nullable), `reminder_job_id→jobs` (nullable) | Proof of qualifications/insurance/H&S per contractor — one row per document, each with its own independent expiry. `reminder_triggered_at` gates the daily `contractor-document-reminders` Edge Function so a document's 7-day-before job + email fire once per expiry, not once per day; a trigger resets it to null whenever `expiry_date` changes (a renewed document earns a fresh cycle). Gated behind `can_manage_contractors` for select as well as write, unlike `contractors` itself. |
| **rfid_tags** | `id`, `tag_uid` (text, unique), `profile_id→profiles`, `created_at` | Maps a physical fob UID to an existing profile (staff only — contractors don't get fobs). Admin-managed. |

### 4.3 Jobs

| Table | Key columns | Notes |
|---|---|---|
| **job_statuses** | `id`, `org_id`, `name`, `is_completed` (bool), `sort_order`, unique(`org_id`,`name`) | Seed: Open (1), In Progress (2), Completed (3, `is_completed=true`), Cancelled (4, `is_completed=true`). Full CRUD is *not* exposed anywhere — statuses are effectively fixed post-seed. |
| **job_types** | `id`, `org_id`, `name`, `template_schema` (jsonb — ordered array of checklist-item label strings), `requires_completion_photo` (bool, default false) | "Job templates" in the UI. Picking one on New Job pre-fills description/checklist/default activity types; the checklist remains freely editable afterward. |
| **job_type_task_types** | `job_type_id→job_types`, `task_type_id→task_types`, PK(both) | The *default* activity types a template pre-ticks on New Job — not a hard link; `job_activity_types` (below) is the real per-job source of truth. |
| **schedules** | `id`, `org_id`, `site_id`, `job_type_id`, `rrule` (text — full RFC5545 string **including DTSTART**), `lead_in_days` (int), `last_generated_date` (date, nullable) | No active/paused flag exists — every row is always "live" (see §17). |
| **jobs** | `id`, `org_id`, `site_id`, `job_type_id` (nullable), `description` (required), `assignee_profile_id` / `assignee_group_id` / `assignee_contractor_id` (nullable, **at most one set — `num_nonnulls(...) <= 1`**), `priority` (`job_priority`, default medium), `status_id` (required), `due_date` (date, nullable), `lead_in_date` (date, nullable), `pitch_id` / `area_id` (nullable), `schedule_id→schedules` (nullable — set only by the generator), `closed_by→profiles` (nullable), `created_by→profiles` (nullable — null for scheduler-generated jobs), `created_at`, `client_generated_id` (uuid, unique — offline creation dedup), `completed_date` (date, nullable — the date work actually happened, may be backdated, distinct from `created_at`), `requires_photo` (bool, default false — hard per-job flag, distinct from `job_type.requires_completion_photo`, see §6.3) | Indexed on (`org_id`,`site_id`), `assignee_profile_id`, `assignee_group_id`, `status_id`. |
| **job_photos** | `id`, `job_id→jobs`, `storage_path`, `uploaded_by→profiles`, `uploaded_at` | Storage path convention: `<job_id>/<uuid>-<filename>` in the `job-photos` bucket. |
| **job_subtasks** | `id`, `job_id→jobs`, `label`, `is_checked` (bool), `sort_order` (int) | The per-job checklist. Checking an item off never requires a permission; renaming/reordering/deleting an existing item requires `can_edit_job_checklist` (enforced server-side, not just hidden client-side — see §6.2). |
| **job_activity** | `id`, `job_id→jobs`, `event_type` (`status_change`/`reallocation`/`comment`/`edit`/`contractor_email`), `actor_profile_id→profiles`, `previous_value` (jsonb), `new_value` (jsonb), `created_at` | **Append-only.** A DB trigger unconditionally blocks `DELETE` on this table (with one narrow, transaction-scoped exception used only by the `delete_job` RPC's cascade — see §6.5). Rows *can* be corrected via `UPDATE`. |
| **job_activity_types** | `job_id→jobs`, `task_type_id→task_types`, PK(both) | Many-to-many: zero or more activity types per job, chosen independently of `job_type`. Drives which RA/MS documents surface on the job. |

### 4.4 Activity types & the H&S library

| Table | Key columns | Notes |
|---|---|---|
| **task_types** | `id`, `org_id`, `name`, `equipment_category` (text, nullable) | "Activity types" in the UI (e.g. "Strimming"). Originally 1:1-linked to a single risk assessment; that design was replaced (see below) before any data existed against it. |
| **ra_ms_documents** | `id`, `org_id`, `type` (`risk_assessment`/`method_statement`), `title`, `description` (nullable, secondary summary — the PDF is authoritative), `pdf_storage_path` (nullable), `created_at`, `updated_at` | The reusable RA/MS library. |
| **activity_type_documents** | `task_type_id→task_types`, `document_id→ra_ms_documents`, PK(both) | Many-to-many: one document can cover several activities; one activity can need several documents. |
| **training_videos** | `id`, `org_id`, `task_type_id` (nullable), `equipment_category` (text, nullable), `youtube_url`, `title` | Linked either to an activity type or standalone by equipment category. No admin CRUD screen exists for this table (no `training_videos` admin tab was ever built — content must be inserted directly in the DB today; see §17). |

### 4.5 Equipment

| Table | Key columns | Notes |
|---|---|---|
| **equipment_types** | `id`, `org_id`, `name`, unique(`org_id`,`name`), `pre_use_checklist` (jsonb, same shape as `job_types.template_schema`), `sort_order` (int), `allow_multi_checkout` (bool, default false) | Groups individual units by what they are (e.g. all of ST1/ST2/ST3 are "Strimmer"). `pre_use_checklist` is shown read-only on the kiosk before checkout. `sort_order` controls the kiosk's checkout category grid order. `allow_multi_checkout` switches the kiosk's unit picker to a tick-many-then-continue flow (e.g. batteries). |
| **equipment_type_documents** | `equipment_type_id→equipment_types`, `document_id→ra_ms_documents`, PK(both) | Many-to-many, same shape as `activity_type_documents` (§4.4) — lets an equipment type (not just an activity type) carry its own linked RA/MS documents. Managed from the Equipment Types admin tab (§11); surfaced as a "Health & Safety" button on the kiosk check-out screen (§12.5) and browsable stand-alone from the kiosk's Health & Safety screen (§12.8). |
| **equipment** | `id`, `org_id`, `site_id` (nullable), `held_by_profile_id→profiles` (nullable — long-term personal issue, distinct from kiosk checkouts, nothing currently writes it from the UI), `name` ("Kit ID" in the UI, e.g. `ST1`), `status` (`equipment_status`, default in_service), `check_frequency_days` (int, nullable — loaded but never surfaced in any UI), `equipment_type_id→equipment_types` (nullable), `make`, `model` (text, nullable), `serial_number`, `other_id_number` (text, nullable), `date_added` (date, nullable) | |
| **equipment_checks** | `id`, `equipment_id→equipment`, `checked_by→profiles`, `checked_at`, `passed` (bool) | Any signed-in user (not permission-gated) can log a pass/fail check from the Equipment Detail page. |
| **fault_reports** | `id`, `equipment_id→equipment`, `reported_by→profiles`, `description`, `appointed_person_id→profiles` (nullable — loaded nowhere currently, dead field), `created_at` | |
| **fault_photos** | `id`, `fault_report_id→fault_reports`, `storage_path` | Storage path: `<equipment_id>/<uuid>-<filename>` in the `fault-photos` bucket. |
| **repair_records** | `id`, `equipment_id→equipment`, `fault_report_id→fault_reports` (nullable), `note` (required), `cost` (numeric, nullable), `vendor` (text, nullable), `repaired_at` (nullable), `repaired_by→profiles` | Logged only by `can_manage_equipment_status` holders; visible to anyone who can see the equipment. |
| **common_fault_descriptions** | `id`, `org_id`, `equipment_type_id→equipment_types`, `description`, `sort_order` | Admin-managed picklist shown on the kiosk's "Report an Issue" screen, scoped per equipment type. |
| **equipment_checkouts** | `id`, `equipment_id→equipment`, `profile_id→profiles`, `checked_out_at`, `checked_in_at` (nullable), `checked_in_by→profiles` (nullable), `checkin_fault_report_id→fault_reports` (nullable) | The short-term "who currently has this out" log driven by the kiosk. **Deliberately a separate concept from `equipment.held_by_profile_id`.** A partial unique index on `equipment_id` **where `checked_in_at is null`** DB-enforces "at most one open checkout per unit at a time" — not just filtered client-side. |
| **rfid_login_attempts** | `id`, `tag_uid`, `ip`, `succeeded` (bool), `attempted_at` | Rate-limit log for the kiosk sign-in Edge Function. RLS enabled with **zero policies** — default-deny for every role except the service-role function itself; never user-readable. |

### 4.6 Notifications & exports

| Table | Key columns | Notes |
|---|---|---|
| **notifications** | `id`, `recipient_profile_id→profiles`, `trigger_type` (text), `priority` (`notification_priority`), `payload` (jsonb — `{title, body, data}`), `delivered_at` (nullable — null means queued behind DND) | |
| **push_subscriptions** | `id`, `profile_id→profiles`, `endpoint` (text, unique), `subscription` (jsonb — the full `PushSubscription` object), `created_at` | One row per browser subscription per profile; dead endpoints (410/404 on send) are pruned automatically. |
| **export_logs** | `id`, `exported_by→profiles`, `org_id`, `filters_used` (jsonb), `exported_at` | Written **before** any CSV export query runs — if the insert is rejected by RLS (no permission), the export aborts before touching data. Two export surfaces both write here: jobs CSV (`can_export_jobs`) and equipment-checkout-log CSV (`can_manage_equipment_status`). |

---

## 5. Access control (Row Level Security)

**All access control is enforced at the Postgres level via RLS. The
client-side `usePermissions()` hook is UI-only (show/hide controls) and
must never be treated as the real gate — every meaningful mutation has a
matching server-side policy, trigger, or security-definer RPC.**

### 5.1 Helper functions (all `security definer stable`, explicit `search_path`)

- `current_org_id()` — the caller's `profiles.org_id`.
- `current_role_id()` — the caller's `profiles.role_id`.
- `has_site_scope(site_id)` — is there a `site_scope` row for this caller + site.
- `has_permission(key)` — does the caller's role have an **enabled** `role_permissions` row for this key.
- `is_platform_admin()` — is the caller in `platform_admins`.
- `is_in_group(group_id)` — is the caller a `group_members` row for this group.
- `role_can_see_role(visible_role_id)` — does the caller's role have a `role_visibility` row for this target role.
- `can_see_job(job_id)` — the master job-visibility predicate (see below).
- `can_see_equipment(equipment_id)` — site-scope OR personal-holder OR org-wide-with-permission OR platform admin.
- `can_see_document(document_id)` — org match on `ra_ms_documents`.

### 5.2 Permission keys (current full list)

| Key | Gates |
|---|---|
| `can_reallocate_jobs` | Changing a job's assignee (person/group/contractor) |
| `can_export_jobs` | CSV export of the jobs list |
| `can_manage_equipment_status` | Equipment status changes, equipment/equipment-type/common-fault CRUD, equipment-type RA/MS document links, repair records, force check-in, equipment checkout CSV export |
| `can_see_all_jobs` | Org-wide job visibility regardless of `role_visibility` |
| `can_edit_job_checklist` | Renaming/reordering/deleting checklist items on an existing job (checking one off is always allowed) |
| `can_manage_reference_data` | Job templates, activity types, safety library, schedules |
| `can_manage_roles_and_permissions` | The role↔permission matrix and role CRUD |
| `can_manage_users` | Inviting/editing/deactivating users, site-scope, groups, RFID fob registration |
| `can_reopen_completed_jobs` | Moving a job's status from Completed/Cancelled back to an open status |
| `can_delete_jobs` | Permanently deleting a job (via RPC only — see §6.5) |
| `can_require_job_photo` | Showing the "require photo" checkbox on New Job |
| `can_complete_job_without_photo` | Bypassing a hard `requires_photo` block at completion time |
| `can_manage_contractors` | Contractor CRUD, sending the "email job to contractor" action |
| `can_see_contractor_jobs` | Seeing jobs assigned to a contractor |

Tree Tops seed grants: **Admin** holds every permission. **Head Gardener**
and **Office** hold `can_edit_job_checklist` + `can_manage_reference_data`.
No other role holds any permission by default — confirm the intended
final matrix with the business owner before going live with a second
organisation.

### 5.3 Job visibility — the core rule

A row in `jobs` is visible to a caller if **all** of:
1. The caller has `site_scope` for the job's `site_id` (or is a platform admin — see §5.5), **AND**
2. At least one of:
   - `assignee_profile_id = caller`
   - `assignee_group_id` is one the caller belongs to
   - the assignee (if a person) has a role the caller's `role_visibility` includes
   - the job is assigned to a contractor **and** the caller holds `can_see_contractor_jobs`
   - the caller holds `can_see_all_jobs`

This single predicate (`can_see_job`) is reused everywhere: the `jobs`
table's own SELECT/UPDATE policies, and every child table
(`job_photos`, `job_subtasks`, `job_activity`, `job_activity_types`) via a
join back to the parent job. Storage bucket policies for `job-photos`
also call `can_see_job()` against the first path segment
(`<job_id>/...`).

### 5.4 General tenancy/site pattern

- Org-scoped reference tables (roles, groups, job_statuses, job_types,
  task_types, training_videos, contractors, equipment_types,
  ra_ms_documents, permissions catalogue): `org_id = current_org_id()`.
- Site-scoped tables (pitches, areas, schedules): `has_site_scope(site_id)`.
- `areas` insert is open to any scoped user (areas grow via usage) —
  `created_by` must match the caller.
- Every write policy that isn't a plain org/site check is additionally
  gated by the relevant `has_permission(...)` key from §5.2.

### 5.5 Platform admin carve-out

`platform_admins` membership grants read access to organisation/site
rows for onboarding, and a narrow bypass inside `can_see_job` /
`can_see_equipment`. It is **not** a blanket bypass on every table — each
carve-out is added individually where actually needed. The
`admin_access_log` table exists to record every platform-admin read of
another org's operational data but nothing currently writes to it (see
§17 — acceptable while Tree Tops is the only tenant, must be wired up
before a second org is onboarded).

---

## 6. Server-side business rules (triggers & RPCs)

These enforce rules RLS's row-level `USING`/`WITH CHECK` clauses can't
express on their own (mainly: "which *columns* changed," and "run this
exact sequence server-side, atomically, regardless of who's calling").

### 6.1 Job reallocation gate
`enforce_job_reallocation_permission` (BEFORE UPDATE trigger on `jobs`):
if `assignee_profile_id`, `assignee_group_id`, or `assignee_contractor_id`
changes and the caller lacks `can_reallocate_jobs`, the update is
rejected with an exception. Every other column may be freely updated by
anyone who can see the job.

### 6.2 Checklist edit gate
`enforce_job_subtask_edit_permission` (BEFORE UPDATE trigger on
`job_subtasks`): if `label` or `sort_order` changes and the caller lacks
`can_edit_job_checklist`, rejected. Toggling `is_checked` alone is always
allowed. Deleting a row outright is gated the same way via a plain RLS
DELETE policy.

### 6.3 Completion photo requirements — **two independent mechanisms**
These are not the same feature and must both be implemented distinctly:

1. **Job-type-level "soft" rule** (`job_types.requires_completion_photo`):
   client-side only. When the assignee themself moves their own job to a
   completed status with zero photos, show
   `window.confirm("No photo added — complete anyway?")` — don't hard
   block. If someone *other than* the assignee is closing the job, skip
   the check entirely (no warning at all).
2. **Per-job "hard" flag** (`jobs.requires_photo`, set at job-creation
   time, gated by `can_require_job_photo`): enforced **server-side** by
   `enforce_job_completion_photo_requirement` (BEFORE UPDATE trigger on
   `jobs`, fires when `status_id` changes to a completed status from a
   non-completed one). If `requires_photo` is true, there are zero
   `job_photos` rows, and the caller lacks
   `can_complete_job_without_photo`, the transaction is rejected outright
   — not a dialog the user can click through.

### 6.4 Reopen gate
`enforce_job_reopen_permission` (BEFORE UPDATE trigger on `jobs`, fires
on `status_id` change): moving from an `is_completed=true` status to an
`is_completed=false` one requires `can_reopen_completed_jobs`, checked
server-side (the client also blocks this in the UI, but the trigger is
the real gate).

### 6.5 Job deletion — RPC only, no DELETE policy
There is **no** `jobs` DELETE RLS policy at all — a raw client
`.delete()` call is always rejected by RLS's default-deny. The only way
to delete a job is `delete_job(p_job_id)`, a `security definer` function
that: re-checks `can_see_job` + `can_delete_jobs` itself, sets a
transaction-local flag (`app.allow_job_activity_delete = true`) that the
otherwise-unconditional "never delete `job_activity`" trigger honours
*only within that transaction*, then deletes the job (cascading to
subtasks/photos/activity/activity-types). This keeps the permission
check in exactly one place. Storage objects for the job's photos are
**not** cascade-deleted by the database — the client must explicitly
remove them from the `job-photos` bucket after the RPC succeeds.

### 6.6 Equipment checkout concurrency
- A partial unique index (`equipment_id` where `checked_in_at is null`)
  DB-enforces "at most one open checkout per unit" — a race between two
  people checking out the same unit produces a real unique-violation
  (Postgres code `23505`), which the client must catch and surface as
  "That unit was just checked out by someone else."
- The insert policy additionally re-checks `equipment.status = 'in_service'`
  server-side at write time (not just filtered client-side).
- `enforce_equipment_checkout_immutable_fields` (BEFORE UPDATE trigger):
  once created, `equipment_id`/`profile_id`/`checked_out_at` can never be
  changed by *any* update path (self check-in, fault-report RPC, or
  admin force-check-in) — only the checked-in-family columns may move.

### 6.7 `report_equipment_fault(equipment_id, description, close_checkout_id?)`
Security-definer RPC ("pink ticketing" a machine, in the business's own
terminology). Atomically: inserts a `fault_reports` row, flips
`equipment.status` to `faulty`, and — if a matching open checkout id
belonging to the caller is supplied — closes that checkout in the same
transaction, recording the fault report id on it. Lets an ordinary staff
member flip equipment status through this one narrow, audited path
without weakening the general `equipment_update` policy (which still
requires `can_manage_equipment_status` for arbitrary status changes).

### 6.8 `admin_force_check_in(checkout_id)`
Security-definer RPC, requires `can_manage_equipment_status`. Closes
someone else's forgotten open checkout. Used by both the Equipment admin
tab and the Equipment Checkout Log admin tab.

### 6.9 Role deletion guard
`forbid_role_delete_if_in_use` (BEFORE DELETE trigger on `roles`): raises
a plain exception (not a typed error code) if any `profiles` row still
references the role — shown to the admin verbatim, since `profiles.role_id`
is `ON DELETE SET NULL` and would otherwise silently orphan users.

### 6.10 `job_activity` immutability
`forbid_job_activity_delete` (BEFORE DELETE trigger): unconditionally
raises unless the transaction-local `app.allow_job_activity_delete` flag
is set (only ever set by `delete_job`, §6.5). Rows can be corrected via
UPDATE, never removed.

### 6.11 `list_org_users()`
Security-definer RPC, the only client-facing way to read `auth.users.email`
alongside profile/role/site-scope data. Checks `can_manage_users` inside
the function body (not left to the caller) and always scopes to the
caller's own org.

---

## 7. Edge Functions

All run on Deno via Supabase Edge Functions. All use the **service role
key** (bypassing RLS by design) because they need Auth Admin API access
or need to act with authority the calling RLS session doesn't have — and
each re-implements its own authorization check inside the function body
rather than relying on anything upstream, since bypassing RLS means
nothing else enforces access. All (except `generate-scheduled-jobs`,
which is cron-triggered with no browser caller) return explicit CORS
headers (`Access-Control-Allow-Origin: *` + the standard Supabase header
set) on every response including `OPTIONS`, because they're invoked
cross-origin from the browser and a missing header fails silently
client-side with a generic "Failed to send a request to the Edge
Function" message.

| Function | Trigger | Auth check | Behavior |
|---|---|---|---|
| **generate-scheduled-jobs** | Daily cron (Supabase Dashboard → Edge Functions → Cron, e.g. `0 6 * * *`) | none (service role, no logged-in user) | For every `schedules` row: parses `rrule` (must include a `DTSTART` line — a bare `FREQ=...` string fails), computes occurrences due between `last_generated_date + 1 day` (or `dtstart` if never generated) and `today + lead_in_days`, creates one `jobs` row per due occurrence (org's lowest-`sort_order` non-completed status, priority `medium`, `description` = the job type's name, `schedule_id` set, `created_by` null), then advances `last_generated_date` to the last occurrence created. No pause/active flag exists — every schedule row is always live. |
| **send-notice-push** | Called from `notifications.js`'s `sendNotification()` | none beyond a valid recipient id (any authenticated caller may trigger a push to any recipient — no sender-side restriction today) | `priority: 'safety_critical'` always sends immediately. `priority: 'operational'` checks the recipient's `dnd_enabled`; if true, inserts the `notifications` row with `delivered_at: null` (queued) and does **not** push. Prunes dead `push_subscriptions` on 410/404. |
| **flush-dnd-notifications** | Called from `notifications.js` right after `setDNDEnabled(false)` | none | Delivers every queued (`delivered_at is null`) notification for the given `profileId` to every registered subscription, marking each delivered. |
| **manage-users** | Called from `UsersTab.jsx` | Bearer token → resolves caller's profile → requires `can_manage_users` enabled for their role | `action: "invite"` — `auth.admin.inviteUserByEmail`, then inserts `profiles` + `site_scope` rows. `action: "deactivate"/"reactivate"` — sets `profiles.is_active` **and** bans/unbans the `auth.users` row (`ban_duration: "876000h"` ≈ 100 years, or `"none"`) so an existing session is cut off immediately, not just on next profile check. |
| **rfid-login** | Called from `KioskSignIn.jsx`, **no session required** (this is how a kiosk session is created) | Rate-limited only: 8 failed attempts per `tag_uid` in a rolling 15-minute window locks that tag out (`rfid_login_attempts`, logged for every attempt, success or failure) | Looks up `tag_uid` → `profile_id`, checks the profile is active, then `auth.admin.generateLink({type:"magiclink", email, redirectTo})` and returns the resulting `action_link` for the client to navigate to directly (`window.location.href`, a full page load through Supabase's own magic-link verification — not a client-side `verifyOtp` call). |
| **send-contractor-job-email** | Called from `JobDetail.jsx`'s "Send email to contractor" button | Bearer token → requires `can_manage_contractors` | Loads the job + checklist, requires the job to have a contractor assignee with a `main_email`, sends via **Resend** (`from: "Tree Tops Maintenance <noreply@treetopscaravanpark.co.uk>"`, HTML body: description/priority/due date/location/requester/checklist), then logs a `job_activity` row with `event_type: "contractor_email"`. No dedicated "resend" — calling again just sends again and adds another log entry, giving a full send history. |
| **contractor-document-reminders** | Daily cron (Supabase Dashboard → Edge Functions → Cron, same pattern as `generate-scheduled-jobs`) | none (service role, no logged-in user) | For every `contractor_documents` row with a non-null `expiry_date` within 7 days (or already past) and `reminder_triggered_at` still null: creates a `jobs` row assigned to the org's "Office" group (priority `high`, due date = the document's expiry date, on the org's first site since documents aren't site-scoped), sends a **Resend** email to the contractor if `main_email` is set (skipped, not retried, if not), then stamps `reminder_triggered_at`/`reminder_job_id` so it isn't repeated tomorrow. Each document is processed independently, so a contractor with several documents gets a separate job/email per document as each one individually crosses the 7-day mark. |

---

## 8. Frontend architecture

### 8.1 Routing (`src/App.jsx`)

`location.pathname.startsWith("/kiosk")` branches into an entirely
separate render tree **before** the normal session guard, because RFID
sign-in must be reachable with no session yet.

Non-kiosk routes (all wrapped in `<Layout>`, only reachable once
`session` exists and the profile isn't deactivated):

| Path | Screen |
|---|---|
| `/` | JobsList |
| `/jobs/new` | NewJob |
| `/jobs/:id` | JobDetail |
| `/equipment` | EquipmentList |
| `/equipment/:id` | EquipmentDetail |
| `/dashboard` | Dashboard |
| `/safety` | HealthAndSafety |
| `/admin` | Admin (self-guards its own tab list by permission; shows "You don't have access to this section." if the caller holds none of the tab-gating permissions) |

Kiosk routes (inside `KioskApp`, no `<Layout>`, own chrome):
`/kiosk` (menu), `/kiosk/jobs`, `/kiosk/checkout`, `/kiosk/checkin`.

No catch-all/404 route exists inside the SPA — an unmatched path under
`/` renders nothing. GitHub Pages' own 404 is handled separately (see
§15.3).

### 8.2 Auth (`src/lib/AuthContext.jsx`)

`AuthProvider`/`useAuth()` exposes `session`, `profile`, `org`, `sites`
(array), `activeSite`, `setActiveSite`, `terminology`, `loading`,
`deactivated`, `signOut`.

On sign-in, `loadProfileAndScope(userId)`:
1. Loads the `profiles` row (with `roles(name)` joined). If `is_active === false`, sets `deactivated=true` and force-signs-out — belt-and-braces on top of the Auth Admin ban, covering an access token that's still technically valid until it naturally expires.
2. Loads the `organisations` row.
3. Loads `site_scope` joined to `sites`. **If the user has exactly one scoped site, it's auto-selected as `activeSite` and its terminology loaded. There is no UI to choose among 2+ sites** — replicate this only if the target deployment is genuinely single-site per user, or build the missing picker (see §17).

Auth-state-change handling has a documented quirk to preserve: Supabase
JS re-fires `SIGNED_IN` on every tab-focus/visibility recovery, not only
on genuine new sign-ins. A ref tracking the last-loaded user id is used
to skip re-running the full profile load (which would otherwise bounce
the whole app back to a loading screen and unmount whatever page/form
was open) unless the signed-in user id actually changed.

### 8.3 Permissions (`src/lib/permissions.js`)

`usePermissions()` loads the caller's `role_permissions` (enabled only)
into a `Set<string>` for `.has(key)` checks — explicitly documented as
UI-only; never trust it for anything security-relevant.

### 8.4 Terminology (`src/lib/terminology.js`)

`loadTerminology(site)` merges `terminology_templates` (for the site's
`site_type`) with `site.terminology_overrides` (overrides win). Every UI
string that could plausibly vary by industry is meant to flow through
this — in the current build only the "Pitch" and "Area" labels actually
do.

### 8.5 Shared query/business-logic modules

These exist specifically to prevent the "same logic implemented three
times, drifting apart" failure mode — reuse the single implementation
everywhere the behavior is needed, don't reimplement per-screen.

- **`jobsQuery.js`** → `queryJobs(siteId, filters)` — the single job-listing query, reused by JobsList, Dashboard, KioskJobs, and CSV export. Supported filters: `statusIds[]`, `priorities[]`, `assigneeProfileId`, `assigneeGroupId`, `dueBefore`/`dueAfter`. Always ordered `priority desc, due_date asc (nulls last)`. RLS is the real narrowing; these are additional UI-level filters on top.
- **`loadJobForPrint.js`** → `loadJobForPrint(jobId)` — everything a job detail screen or a printed job sheet needs in one call: job row, subtasks, photos, activity (newest first, actor names joined), activity types, and their linked RA/MS documents.
- **`csvExport.js`** → `exportJobsCsv` / `exportEquipmentCheckoutsCsv` — both write an `export_logs` row **first**; a permission-denied insert aborts the export before any data is queried (see §6, §4.6). Jobs CSV columns: description, priority, status, assignee, due_date, location, created_at. Checkout CSV columns: equipment, equipment_type, checked_out_by, checked_out_date, checked_out_time, checked_in_by, checked_in_date, checked_in_time, status, fault_reported, fault_description.
- **`equipmentCheckoutsQuery.js`** → `queryEquipmentCheckouts(filters)` — used by the admin checkout log and its export; filters on equipment, equipment type, person, date range, open/closed status, faults-only.
- **`equipmentAvailability.js`** → `getEquipmentTypeAvailabilityCounts(orgId)` / `getAvailableUnits(equipmentTypeId)` — a unit counts as "available" only if `status === 'in_service'` AND has no currently-open `equipment_checkouts` row. Deliberately ignores `held_by_profile_id`.
- **`printJobCards.jsx`** → `openPrintWindow()` (must be called **synchronously** from the triggering click — any `await` before `window.open()` gets silently popup-blocked on iOS Safari) + `writeAndPrintJobBundles(printWindow, bundles, terminology)` (server-renders `PrintableJobCard` via `renderToStaticMarkup` into the new window, one page-break per card, waits for the window's `load` event before calling `.print()` — avoids the documented brokenness of in-page `window.print()`/`@media print` under a service-worker-controlled PWA on iOS Safari).
- **`completeJob.js`** → `writeJobCompletion({...})` — the single "mark job complete" write path shared by JobDetail and the kiosk: updates `status_id`/`closed_by`/`completed_date`, logs a `status_change` activity row, and an additional `comment` activity row if a comment was supplied. Does not own the photo-confirmation dialog — that stays with each caller.

### 8.6 Shared components

- **`ChecklistBuilder.jsx`** — reusable ordered-list editor (`{items, onChange, readOnly}`): add via Enter or button, inline-edit, ↑/↓ reorder, ✕ remove. `readOnly` renders plain text with no controls. Reused across New Job, Job Detail, Job Templates admin, Equipment Types admin (pre-use checklist), and the kiosk (always read-only there).
- **`RfidScanListener.jsx`** — a visually-hidden, always-refocused `<input>` that captures HID-keyboard-emulation input from a physical RFID reader (types the UID, then Enter — indistinguishable from real typing, which is how it's tested without hardware). Calls `onScan(uid)` on Enter. Shared by kiosk sign-in and admin fob registration.
- **`Layout.jsx`** — header (org + site name), nav (Jobs, Equipment, Dashboard, Safety, conditionally Admin), DND toggle, "Enable notifications" button, display name, sign-out. Footer shows build metadata (`v{version} · {git sha} · built {timestamp}`, injected at build time by `vite.config.js`).
- **`SafetyDocumentLink.jsx`** — resolves a 1-hour signed URL for a `ra_ms_documents` row's PDF on mount; shows unlinked "(no PDF yet)" text if none uploaded.
- **`JobCard.jsx`** — the job-list row: priority bar, description, status pill, location, assignee, due date; optional selection checkbox.
- **`Modal.jsx`** — generic overlay (click-outside-to-close), reused for save-as-template, job completion, and job reopening.
- **`PhotoThumb.jsx`** — resolves a 1-hour signed URL (or accepts a pre-resolved one for batch print), click-to-expand lightbox.
- **`PrintableJobCard.jsx`** — the printed job sheet: header/label table, Safety section (activity types + linked docs), Checklist, Photos, Activity feed, and a Sign-off section with blank signature/print-name/date-completed lines for a paper trail.

---

## 9. Design system

Design direction name: **"Field Journal."** Reproduce these tokens
exactly (`src/lib/theme.js`) — do not reinterpret.

**Colours**
```
--bg:          #E7E2CC   page background
--paper:       #FBF9F1   card/panel surface
--ink:         #31382D   primary text
--ink-soft:    #78806E   secondary text
--moss:        #5C7A4E   primary action colour, low priority, Completed status
--moss-dark:   #3F5837   headings, nav active state, theme-color meta
--clay:        #A65A34   high priority, In Progress status, secondary accent
--gold:        #C9962F   medium priority, Open status
--immediate:   #8C3A22   immediate priority (combined with a diagonal hazard-stripe pattern — never a solid fill)
--line:        #DDD6BC
--line-strong: #CBC2A0
```

**Typography**: `Lora` (serif, 600–700, sometimes italic) for
display/headings; `Work Sans` for body/UI; `IBM Plex Mono` for IDs,
timestamps, and data labels. Loaded via Google Fonts `<link>` in
`index.html`.

**Priority indicator**: a solid rounded colour bar, 6px wide, full
height, next to each job — **never icon-based badges** (an earlier
icon/leaf-emoji version was explicitly rejected). The `immediate` bar
uses a 45°-diagonal `repeating-linear-gradient` hazard stripe
(`#8C3A22`/`#6b2a18`), not a flat fill.

**Status pills**: pill-shaped, filled colour, white text. Open = gold,
In Progress = clay, Completed = moss. Any unrecognised status name falls
back to `ink-soft`.

**Shape language**: generously rounded corners (12–20px on
cards/buttons), soft shadows, pill-shaped tags and buttons — warm and
approachable, not sharp/industrial.

**Kiosk theme** (`src/kiosk/kioskTheme.js`) uses the same palette but
much larger touch targets (28px/20px button padding, 20px radius, 22px
bold text) — the kiosk is a fixed touchscreen device operated by
gloved/dirty hands, not a phone.

---

## 10. Screen-by-screen specification

### 10.1 Login (`/`, unauthenticated)

Passwordless only — **no password field anywhere in the app.**
1. User enters their email → `supabase.auth.signInWithOtp({email, options:{emailRedirectTo: window.location.origin}})`.
2. Screen shows both: a magic-link (click the emailed link) and an **8-digit numeric code** entry form (`inputMode="numeric"`, monospace, letter-spaced) that calls `verifyOtp({email, token, type:"email"})`.
3. The code path exists specifically because home-screen-installed PWAs on iOS can't hand a link tapped in Mail back to the installed app — it always opens in Safari instead, leaving the installed PWA session-less. The code lets the user stay inside the installed app.
4. "Use a different email" resets the flow. States: idle → sending → sent/verifying → error.

### 10.2 Dashboard (`/dashboard`)

Loads **all** jobs for the active site (no filters) plus a count of
`equipment.status = 'faulty'` for the org. Tiles, each clickable only
when its value is > 0:

| Tile | Value | Navigates to |
|---|---|---|
| Open jobs | jobs where status `is_completed=false` | `/?open=1` |
| Overdue | open jobs with `due_date < today` (immediate colour if >0, else moss) | `/?overdue=1` |
| Immediate / High / Medium / Low | count per priority (coloured per `priorityColor`) | `/?priority=<p>` |
| Faulty equipment | count (immediate colour if >0, else moss) | `/equipment?status=faulty` |

"Export CSV" (shown only with `can_export_jobs`) exports **all** jobs
site-wide, not whatever's currently filtered on screen.

### 10.3 Jobs list (`/`)

- **Quick filter from URL** (`?priority=`, else `?overdue=1`, else
  `?open=1`) drives an initial filter state shared with Dashboard's tile
  links, shown as a "Showing: <label>" banner with a Clear button.
- **Status chips** ("All" + one per `job_statuses` row, single-select)
  and **priority chips** ("All priorities" + the four levels,
  single-select) — an explicit chip choice overrides the quick filter's
  implied status/priority; if no chip is picked, the quick filter's
  derived filter still applies.
- **"Assign to" select** — shown only if there's more than one distinct
  assignee visible in the currently-loaded (already RLS-narrowed) set.
  Optgroups: By role / By person / By contractor. Filtering here is
  entirely client-side.
- **Free-text search** — client-side substring match against
  description, assignee display name, group name, contractor name.
- **Multi-select + bulk print**: per-row checkboxes; selection persisted
  to `sessionStorage` (not plain component state) specifically so it
  survives the unmount/remount that happens when navigating to a job
  detail and back. "Select all" only affects currently-visible
  (filtered) rows. A selection bar shows count + Clear + "Print
  selected" (opens the print window synchronously, then loads each job's
  full print bundle and pre-resolves all photo URLs before writing the
  print document).
- "+ New job" always visible, top right.

### 10.4 New job (`/jobs/new`)

Fields, in this order:
1. **Job template** (optional select of `job_types`) — picking one fills description (only if the field is still empty/whitespace, never clobbers user input), replaces the checklist with `template_schema`, and replaces selected activity types with the template's defaults from `job_type_task_types`.
2. **Description** — required textarea.
3. **Activity types** (optional checkbox list of org `task_types`).
4. **Checklist** — `ChecklistBuilder`, read-only unless `can_edit_job_checklist`. If the caller also holds `can_manage_reference_data`: "Save as new template" (modal, names a new `job_types` row) and, if a template is selected, "Update `<name>` template" (confirm-guarded overwrite of that template's `template_schema`).
5. **Priority** — Low/Medium/High/Immediate, default Medium.
6. **Due date** (optional).
7. **Assign to** — radio Person/Group/Contractor, then a matching select; default Unassigned.
8. **Location** — radio Pitch/Area/None (labels from terminology). Pitch → select from the site's `pitches`. Area → free-text input with a `<datalist>` of existing area names; on submit, matches an existing area case-insensitively or creates a new one. **Blocked while offline if the typed area name doesn't match an existing one** (a genuinely new area can't be created without a round trip) — explicit error message rather than silent failure.
9. **"Require a photo before this job can be completed"** checkbox — shown only with `can_require_job_photo`. Governs the *completion-time* hard block (§6.3), not anything about job creation itself.
10. **Photo** (optional, at creation time) — via `capturePhoto()`, with preview + remove/add toggle.

Submission specifics to replicate exactly:
- Client generates the row's `id` up front (`crypto.randomUUID()`) and inserts **without** requesting the row back (no `.select()`/RETURNING) — RETURNING re-checks the SELECT RLS policy in the same statement and that self-lookup was found to unreliably miss the just-inserted row, throwing a spurious RLS error even though the write actually succeeded. Client-generating the id avoids ever needing to read it back.
- **Offline**: if `!navigator.onLine`, the job is queued via `queueJob()` instead of inserted, the user sees "You're offline — this job will save once you're back online." (plus, if a photo was attached, an explicit note that the photo itself was *not* queued and must be added later from the job detail screen), and the user is navigated to `/` immediately.
- A thrown `TypeError` from the insert attempt (the signature of a genuinely failed fetch, as opposed to a real server-side rejection) is treated identically to offline — queued, not surfaced as a hard error — since any other thrown error represents a real rejection that would fail identically on retry.
- Once the job row exists, photo upload, activity-type links, and checklist rows are written as best-effort follow-ups (errors logged, not surfaced, don't block navigation).

### 10.5 Job detail (`/jobs/:id`)

The most complex screen. Loads the full print bundle
(`loadJobForPrint`) plus org statuses/profiles/groups/contractors for
the reassignment/status controls.

- **Description** — inline-editable (styled as a heading), blur-saves only if changed, logs an `edit` activity row with before/after values.
- **Due date, priority** — plain selects/inputs, each individually blur/change-saves and logs its own `edit` activity row.
- **Status** — three distinct behaviors on change:
  1. Selecting a completed status while not already completed → **redirects to the Complete modal** (captures completed date + optional comment + photo together); the dropdown never marks a job complete on its own.
  2. Moving away from a completed/cancelled status ("reopening") → requires `can_reopen_completed_jobs` (else a client error message, no-op); if held, opens a **Reopen modal requiring a mandatory comment** before applying.
  3. Any other plain transition — applies the checks from §6.3 (hard `requires_photo` block, then the soft template-level confirm only when the closer is the assignee themself) before applying directly and logging `status_change`.
- **Reassign to** — shown as an editable select only with `can_reallocate_jobs`; otherwise read-only text. Logs `reallocation` with a full before/after snapshot of all three assignee columns.
- **"Send email to contractor"** — shown only when the job has a contractor assignee and the caller holds `can_manage_contractors`. On success, the activity feed shows "Job details sent to `<contractor>` (`<email>`)".
- **Safety section** — shown only if the job has ≥1 linked activity type: each type's name plus its `SafetyDocumentLink` list ("No RA/MS documents linked yet." if empty).
- **Checklist section** — shown if there are subtasks or the caller holds `can_edit_job_checklist`. Completed items get a strikethrough. Editable version adds inline rename, ↑/↓ reorder, remove, and an "Add an item…" field. Same save/update-template buttons as New Job (gated on `can_edit_job_checklist && can_manage_reference_data`).
- **Photos section** — red warning banner if `requires_photo && photos.length===0`; grid of thumbnails; "Add photo" button.
- **Activity section** — comment box + reverse-chronological feed. `contractor_email` events render as "emailed contractor"; every other event type is shown as its raw event-type string (not humanized) — replicate this literally unless asked to improve it.
- **Complete button** — full-width primary, opens the Complete modal (date defaults to today, optional comment, photo grid with an explicit "(required)"/"(optional)" label depending on `requires_photo`). Re-checks both photo rules from §6.3 before writing.
- **Print job card** — same single-job print path as the list's bulk print, scoped to this job.
- **Delete job** — shown only with `can_delete_jobs`. Confirms via `window.confirm`, calls the `delete_job` RPC, then explicitly deletes the job's photo objects from storage (not cascade-deleted by the DB), navigates to `/`.

### 10.6 Equipment list (`/equipment`)

Simple list. Optional `?status=` filter (in_service/faulty/in_repair/scrapped)
with the same "Showing: <label>" clear-banner pattern used elsewhere.
Each row: name + type, make/model, "Held by `<name>`" if
`held_by_profile_id` is set, and a status pill (in_service=moss,
faulty=immediate, in_repair=gold, scrapped=ink-soft).

### 10.7 Equipment detail (`/equipment/:id`)

- **Header** — name, type/make/model, status (editable select if `can_manage_equipment_status`, else read-only text).
- **Checks** — "Log passed check"/"Log failed check" buttons, open to **any signed-in user** (not permission-gated); history list of who/when/pass-fail.
- **Fault reports** — open to any user: description textarea + "Report fault (with photo)" — photo capture failure/cancellation is silently tolerated (photo is optional here). History shows description + reporter + timestamp.
- **Repair history** — visible to anyone who can see the equipment, but the log-a-repair form (note required, vendor optional, cost optional in £) only renders for `can_manage_equipment_status` holders.
- Note: `check_frequency_days` is loaded but never displayed anywhere on this page in the current build — either surface it or drop the column if replicating cleanly.

### 10.8 Health & Safety (`/safety`)

Read-only reference page. One card per org `task_type`, each showing its
linked RA/MS documents (via `SafetyDocumentLink`) and any linked
training videos (plain YouTube links, `target="_blank"`). Supports
deep-linking via URL hash (`/safety#task-<id>`) to scroll straight to a
specific activity type — used from job detail's Safety section links.
A trailing card lists any training videos that are equipment-category-only
(no linked activity type).

---

## 11. Admin screens

`/admin` shows only the tabs the caller's permissions unlock, as pill
buttons; the first permitted tab auto-selects. Full tab list:

| Tab | Permission | CRUD scope |
|---|---|---|
| Job Templates | `can_manage_reference_data` | `job_types`: name, `requires_completion_photo` checkbox, checklist builder, default activity types (diffed against `job_type_task_types`) |
| Activity Types | `can_manage_reference_data` | `task_types`: name, equipment category (free text), linked RA/MS documents (diffed) |
| Safety Library | `can_manage_reference_data` | `ra_ms_documents`: type radio, title, description, PDF upload (client-generated id so the storage path is known before upload, upsert-with-`{upsert:true}`) |
| Recurring Jobs (Schedules) | `can_manage_reference_data` | `schedules`: template, site (if >1), frequency (daily/weekly/monthly + interval), weekly weekday checkboxes, monthly day-of-month or Nth-weekday-of-month, start date, lead-in days. Built on the `rrule` package (`buildRule`/`parseRule`/`describeRule` via `RRule.toText()`). |
| Equipment | `can_manage_equipment_status` | `equipment`: Kit ID, type, make, model, serial number, other ID number, date added; new items default to `in_service`. Inline "Force check-in" per open checkout. Delete cleans up fault-photo storage objects explicitly (DB rows cascade; storage does not). |
| Equipment Types | `can_manage_equipment_status` | `equipment_types`: name, pre-use checklist, manual reorder (↑/↓), a "Copy checklist from…" merge-in-without-duplicating action, allow-multi-checkout checkbox, linked RA/MS documents (diffed, same pattern as Activity Types) |
| Common Faults | `can_manage_equipment_status` | `common_fault_descriptions`, scoped per equipment type via a type-selector pill row; reorderable picklist |
| Checkout Log (now "Equipment history") | `can_manage_equipment_status` | Read-mostly, merging three tables into one chronological log: `equipment_checkouts`, `fault_reports`, and `repair_records` (each fault/repair is its own row, not folded into its checkout — they land adjacent once sorted by date instead of being described twice). Status filter (open/closed) only narrows checkout rows, since it has no meaning for a fault/repair; "Faults & repairs only" hides checkouts entirely instead. Equipment/type/person filters, date range, free-text search, sortable columns, per-row force-check-in (checkout rows only), CSV export. |
| RFID Fobs | `can_manage_users` | `rfid_tags`: scan-to-register flow (hidden `RfidScanListener`, assign scanned UID to a profile via select), list + revoke. Friendly duplicate-UID error identifying the existing owner. |
| Contractors | `can_manage_contractors` | `contractors`: name, address, main email, main phone, notes. Delete warns that assigned jobs become unassigned. A "Documents" button per contractor opens `ContractorDocumentsModal`: `contractor_documents` list (signed-URL link, expiry countdown colour-coded within 7 days/expired) + an add-document form (description, optional expiry date, file) uploading to the private `contractor-documents` bucket at `<contractor_id>/<filename>`. |
| Groups | `can_manage_users` | `groups` + `group_members`: name, member checkbox list (diffed). Delete warns that assigned jobs become unassigned. |
| Roles & Permissions | `can_manage_roles_and_permissions` | Permission×role matrix (checkbox toggles `role_permissions`), add role, inline-rename role (click header), delete role (surfaces the "still in use" trigger error verbatim if applicable) |
| Users | `can_manage_users` | List via `list_org_users()` RPC. Invite form (email, display name, role, contractor checkbox, site-access checkboxes) → `manage-users` Edge Function. Inline edit (name/role/contractor/site-scope) writes directly to `profiles`/`site_scope`, bypassing the Edge Function. Deactivate/Reactivate → `manage-users` Edge Function. |

Delete-confirmation is inconsistent by design across tabs — some are
immediate no-confirm deletes (Activity Types, Job Templates, Safety
Library, RFID Fobs, Equipment Types, permission-matrix toggles), others
`window.confirm` (Contractors, Groups, Equipment, force-check-in, Role
delete). Replicate as-is unless asked to standardize it.

---

## 12. Kiosk mode

A self-contained, full-screen sub-app for a fixed workshop touchscreen,
reached under `/kiosk/*`. Never renders the normal `<Layout>` chrome;
uses its own larger-touch-target theme (`kioskTheme.js`).

### 12.1 Sign-in (`KioskSignIn.jsx`)

No session yet. Full-screen "Tree Tops Workshop" scan prompt; any click
refocuses the hidden `RfidScanListener` input. On scan, calls the
`rfid-login` Edge Function with `{tagUid, redirectTo: "<origin>/kiosk"}`
and, on success, does a **full page navigation**
(`window.location.href = actionLink`) through Supabase's real magic-link
verification flow — not a client-side `verifyOtp`. Errors show the
function's message or a generic "Sign-in failed. Try scanning again."

### 12.2 Session behavior (`KioskApp.jsx`)

Own internal `<Routes>` for `/kiosk`, `/kiosk/jobs`, `/kiosk/checkout`,
`/kiosk/checkin`. **3-minute idle auto-sign-out**: any `pointerdown`/
`keydown` anywhere in the kiosk resets the timer, so staff aren't forced
to re-tap between quick consecutive actions, but a forgotten sign-out on
a shared device doesn't stay open indefinitely under the wrong identity.

### 12.3 Menu (`/kiosk`)

"Hi `<name>`" + 2×2 grid: View Jobs, Check-out Kit, Check-in Kit, Health &
Safety — with a red Sign out button (immediate, no confirm) below the
grid, not part of it.

### 12.4 View Jobs (`/kiosk/jobs`)

Reuses `queryJobs`, defaulting to the same open/in-progress-only filter
the main Jobs list applies (`job_statuses` where `is_completed = false`)
rather than every visible job — a **Filters** toggle button reveals a
status chip row (`Open` + one chip per status, including Completed) to
see anything else, matching the main list's status-chip behaviour. Row
status is normally a coloured pill with the status name; a row whose
description wraps onto 2+ lines (measured via `getClientRects().length`
on the description span) swaps the pill for a plain colour-coded dot
instead, so a long description doesn't force the row taller than it
needs to be — status name still available via the dot's `title` tooltip.

List → tap a job → checklist (same as before) + a **⚠ Safety** section
(via `loadJobForPrint`) listing RA/MS documents for the job's linked
activity type(s), same shape as the main `JobDetail.jsx` screen + optional
comment + "Mark job complete" (shared `writeJobCompletion`). Progress
slider starts at **0%** (previously defaulted to a hardcoded 50% both on
first render and every time a new job was opened). **No photo capability
at all in the kiosk job flow** — the design assumption is that
photo-required job templates are simply never assigned to kiosk-only
staff, so the kiosk never needs to satisfy or bypass a photo requirement.

### 12.5 Check-out (`/kiosk/checkout`) — 3-view flow

1. **Categories** — grid of equipment types with live available-count, disabled (dimmed, not clickable) at zero.
2. **Units** — list of specific available units for the chosen type ("Nothing available right now." if empty). A **⚠ Health & Safety** button appears here (immediately after picking a type) whenever that type has any linked `equipment_type_documents`, opening a modal listing them via the shared `SafetyDocumentLink` component. If the type has `allow_multi_checkout` set, units render as tickable checkboxes with a sticky "Continue (N)" bar instead of tap-to-select-one.
3. **Confirm** — shows the unit's pre-use checklist read-only (if the type has one) under "Before you take it," then: primary **Check Out** (insert into `equipment_checkouts` for every selected unit; a unique-violation from the concurrency guard on any one of them reports per-unit success/failure on a **Results** view rather than failing the whole batch), danger **Report an Issue** (opens `ReportIssueForm`, calls `report_equipment_fault` with no checkout id to close since nothing's checked out yet), secondary **Cancel**.

### 12.6 Check-in (`/kiosk/checkin`)

Lists the signed-in profile's own open checkouts. Tap one → "Is the Kit
clean and free from issues?" with primary **Yes** (direct update:
`checked_in_at`/`checked_in_by`) or danger **Report an Issue** (opens
`ReportIssueForm`, calls `report_equipment_fault` **with** this
checkout's id, closing it and logging the fault in one RPC call).
"Nothing currently checked out to you." empty state.

### 12.7 `ReportIssueForm.jsx` (shared by both flows)

Loads `common_fault_descriptions` for the relevant equipment type as
single-select tappable cards, plus an optional free-text note (submit
requires at least one of the two). Joins them as
`"<picked> — <note>"` when both are present. Footer copy: **"Please
remember to pink ticket the defective machine."** — a literal
instruction referring to the business's existing paper fault-tag
process; keep this exact copy, it's operationally meaningful, not
decorative.

### 12.8 Health & Safety (`/kiosk/safety`)

Stand-alone RA/MS browser, reachable from the kiosk menu without going
via a job or a checkout at all — for staff asked to do something that
isn't logged as a job in the system, who still need the right paperwork.
Lists every `ra_ms_documents` row for the org (via `SafetyDocumentLink`),
narrowable by two independent `<select>` filters — activity type
(`activity_type_documents`) and equipment type (`equipment_type_documents`)
— that combine as **OR, not AND**: picking both shows anything matching
either, since the point is finding the right document quickly rather than
precise narrowing. No filter selected shows every document in the library.

---

## 13. Notifications

Web Push only (no third-party push service, no SMS). `notification_priority`
is always one of `safety_critical` / `operational`.

- **`safety_critical`** notifications are sent immediately, ignoring the recipient's DND setting.
- **`operational`** notifications check `profiles.dnd_enabled` first: if on, the row is written with `delivered_at: null` (queued, not pushed) instead of sent.
- Turning DND **off** (`Layout.jsx`'s checkbox) immediately triggers `flush-dnd-notifications`, delivering everything that queued while it was on.
- Dead push subscriptions (410/404 responses from the push service) are pruned automatically on next send attempt.
- `sw.js` handles `push` (shows a notification from the JSON payload) and `notificationclick` (opens `data.url` or `/`) — plus `self.skipWaiting()` + `clientsClaim()` so a freshly deployed service worker takes over immediately rather than waiting for every open tab to close, since this PWA is typically left open all day.

No triggers in the current codebase actually *call* `sendNotification()` from a job-lifecycle event (e.g. "notify the assignee when a job is created/reassigned") — the plumbing exists end-to-end but nothing wires it up yet. Confirm with the business whether automatic triggers are in scope for a rebuild, or whether notifications remain a manually-invoked capability only.

---

## 14. Offline support & PWA

- Installable PWA (`vite-plugin-pwa`, `injectManifest` strategy against a hand-written `sw.js`, not the plugin's generated logic). Manifest: standalone display, portrait orientation lock, `#E7E2CC` background / `#3F5837` theme colour.
- **Offline job creation only** — no other offline write path exists (no offline job edits, photo uploads, equipment actions, etc.). `syncQueue.js` stores queued jobs in IndexedDB (`treetops-maintenance` DB, `job_queue` store, keyed by `client_generated_id`), flushed on app load and on the browser's `online` event — never via the Background Sync API (unsupported on iOS Safari, so deliberately not relied on).
- Flush uses a **plain insert**, never upsert — an upsert would additionally need to satisfy the `jobs_update` RLS policy's USING clause, which can never be true for a row that doesn't exist yet server-side. A unique-violation on `client_generated_id` during flush means a prior attempt already synced successfully (its response was just lost) — the local queued copy is deleted without retrying. Any other error leaves it queued for the next attempt.
- `getQueueStatus()` exists but has **no caller anywhere in the UI** — there is no "N jobs pending sync" indicator; a user's only feedback is the one-time "queued" message shown at creation time. Add a status indicator if replicating with better offline UX in mind.
- GitHub Pages has no server-side routing, so a two-part SPA-fallback trick is required to support deep links (bookmarks, the RFID magic-link redirect straight to `/kiosk`, etc.): `public/404.html` (served by GitHub Pages for any unmatched path) immediately `location.replace`s to `/?redirect=<encoded original path>`; an inline bootstrap script in `index.html` reads that `?redirect=` param and calls `history.replaceState` to restore the real path **before** React Router mounts.

---

## 15. Build & deployment

- **Hosting**: static build deployed to **GitHub Pages** via GitHub Actions (`.github/workflows/deploy.yml`), triggered on push to `main` or manual dispatch. Build env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`) come from GitHub Secrets. Custom domain: `jobs.treetops.co.uk` (`public/CNAME`).
- **Backend**: a **dedicated Supabase project**, deliberately separate from any other Supabase project the business runs — the anon key, service role key, and VAPID key pair are project-specific secrets, never shared.
- **Env vars** (`.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY` — client-safe only. The service role key and both VAPID keys live only as Supabase Edge Function secrets, never in any `VITE_`-prefixed variable or client bundle.
- **Build-time metadata**: `vite.config.js` injects `__APP_VERSION__` (from `package.json`), `__GIT_SHA__` (`git rev-parse --short HEAD`), `__BUILD_TIME__` — surfaced in the footer for support/debugging.
- **Migration order matters**: the 22 `supabase/*.sql` files must be run in numeric order against a fresh project; each is idempotent (safe to re-run). Edge Functions are deployed via the Supabase CLI (`supabase functions deploy <name>`) and require their own secrets set separately (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `RESEND_API_KEY` — `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are injected automatically). The daily job generator's cron schedule is configured via the Supabase Dashboard (or `pg_cron`/`pg_net`, not currently used).

---

## 16. Seed data & bootstrap

`supabase/03-seed-treetops.sql` creates the organisation ("Tree Tops
Caravan Park Ltd"), site ("Tree Tops", `caravan_park`), the five roles,
three groups, four job statuses, terminology defaults, and a
`role_visibility` matrix (Admin → every role; Head Gardener → itself +
Gardener + Maintenance, not Office; every other role → itself only —
this "own role only" reading was flagged as a placeholder assumption
pending explicit confirmation from the business owner). `supabase/05-seed-pitches.sql`
loads 206 real pitch codes from an actual CSV export.

`scripts/seed-users.mjs` is a one-shot manual bootstrap (run once,
locally, with the service role key) that invites the initial team via
`auth.admin.inviteUserByEmail` and creates their `profiles`/
`group_members`/`site_scope` rows. Only Andy's own address is real in
the checked-in script; the other four (Hazel/Dave/Peter/Sam) are
`@placeholder.example.com` and are explicitly skipped with a console
warning rather than invited — replace them with real addresses before
running against a new deployment.

---

## 17. Known gaps & open decisions

Carry these forward explicitly rather than silently "fixing" them during
a rebuild — several are genuine open questions for the business owner,
not bugs:

1. **No site picker.** The data model supports a user scoped to multiple sites, but the UI only ever auto-selects when exactly one site is in scope; with 0 or 2+, pages needing `activeSite` simply hang. Fine while Tree Tops is single-site; must be built before a second site is onboarded anywhere.
2. **`role_visibility` beyond Head Gardener is a placeholder.** Confirm the intended visibility matrix for Gardener/Maintenance/Office with the business owner rather than assuming "own role only."
3. **`admin_access_log` is unused.** The table and RLS carve-out for `platform_admins` exist, but nothing writes an audit row on cross-org access yet. Wire this up before onboarding a second organisation.
4. **No `schedules` pause/active flag.** Every recurring schedule is always live; there's no way to pause one without deleting it.
5. **No admin CRUD for `training_videos`.** Content must be inserted directly against the database — no UI exists to manage it, unlike every other reference table.
6. **`equipment.check_frequency_days` and `fault_reports.appointed_person_id`** are modeled and loaded in places but never surfaced or acted on anywhere in the UI — dead columns as currently built. Either implement their intended behaviour (scheduled recheck reminders; a named responsible person for a fault) or drop them.
7. **`equipment.held_by_profile_id`** (long-term personal issue) has no write path anywhere in the UI — only the short-term kiosk `equipment_checkouts` concept is actually used day to day.
8. **No automatic notification triggers.** The full Web Push + DND pipeline works end-to-end, but nothing in the job/equipment lifecycle currently calls `sendNotification()` — it's a manually-invokable capability, not yet wired to events like "job assigned to you" or "equipment you hold went faulty."
9. **`getQueueStatus()` has no UI caller.** Users get no persistent indicator of pending offline-queued jobs.
10. **Unused dependencies**: `workbox-routing` and `workbox-strategies` are declared but not used by the hand-written `sw.js` (which only uses `workbox-core`/`workbox-precaching`).
11. **No automated tests, no lint script.** `package.json` defines only `dev`/`build`/`preview`. Decide whether a rebuild should add test coverage given how much business logic lives in trigger/RLS interactions that are easy to regress silently.
12. **Activity-feed event labels aren't humanized** in the UI (`status_change`, `edit`, `reallocation` show as raw snake_case-ish strings; only `contractor_email` gets a friendly label). Cosmetic, but worth a deliberate decision either way rather than an accidental carry-over.

---

## 18. Suggested build order for a rebuild

1. Schema migrations (§4) as one consolidated set (or the same 22-file incremental history, if replicating the audit trail is valuable) — plain SQL, idempotent.
2. RLS policies + helper functions + triggers (§5, §6) — write and test these **before** building any UI against them; almost every meaningful business rule in this system lives here, not in the frontend.
3. Auth (passwordless email OTP/magic-link) + the `manage-users` invite flow + seed script.
4. Core job CRUD + Jobs list, filtered server-side by RLS (site scope × role visibility), with client-side chip/search filters on top.
5. Job detail: checklist, photos, comments/activity log, status/priority/reassignment, completion flow (both photo-requirement mechanisms), reopening, deletion.
6. Equipment: list/detail, checks, fault reporting, repair records.
7. Activity types + RA/MS safety library + the H&S reference page.
8. Recurring job scheduling (RRULE) + the daily-cron Edge Function.
9. Equipment types, common faults, the RFID kiosk (sign-in → menu → checkout/check-in), and the checkout concurrency guard.
10. Contractors + contractor email notification.
11. Admin: roles/permissions matrix, groups, users, all reference-data tabs.
12. Web Push notifications + DND.
13. Dashboard + CSV export (jobs and equipment-checkout-log).
14. PWA manifest, service worker, offline job-creation queue — test genuinely offline (aeroplane mode) before considering this done, not just with devtools network throttling.
15. Print job cards (single and bulk) — test specifically on iOS Safari given the documented popup-blocker and `@media print` gotchas baked into the implementation.

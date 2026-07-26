-- Tree Tops Maintenance Platform — initial schema migration
-- Covers Section 3 (Data Model) of BUILD-BRIEF.md.
-- Idempotent: safe to re-run against a database that already has some or
-- all of these objects (uses `if not exists` / `create or replace`).
--
-- Two tables reference each other (task_types <-> risk_assessments), so
-- both are created with the cross-referencing column left unconstrained,
-- then the two FKs are added at the end once both tables exist.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------

do $$ begin
  create type public.job_priority as enum ('low', 'medium', 'high', 'immediate');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.equipment_status as enum ('in_service', 'faulty', 'in_repair', 'scrapped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_priority as enum ('safety_critical', 'operational');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.job_activity_event_type as enum ('status_change', 'reallocation', 'comment', 'edit');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Tenancy & structure
-- ---------------------------------------------------------------------

create table if not exists public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  unique (org_id, name)
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  site_type text not null default 'caravan_park',
  terminology_overrides jsonb,
  branding_overrides jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.terminology_templates (
  id uuid primary key default gen_random_uuid(),
  site_type text not null,
  key text not null,
  default_label text not null,
  unique (site_type, key)
);

-- ---------------------------------------------------------------------
-- People & access
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organisations(id) on delete cascade,
  role_id uuid references public.roles(id) on delete set null,
  display_name text not null,
  is_contractor boolean not null default false,
  dnd_enabled boolean not null default false
);

create table if not exists public.permissions (
  key text primary key,
  description text
);

insert into public.permissions (key, description) values
  ('can_reallocate_jobs', 'Can reassign a job to a different person or group'),
  ('can_export_jobs', 'Can run CSV exports of the jobs list'),
  ('can_manage_equipment_status', 'Can change equipment status and record repairs'),
  ('can_see_all_jobs', 'Org-wide visibility of every job regardless of role_visibility')
on conflict (key) do nothing;

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  enabled boolean not null default true,
  primary key (role_id, permission_key)
);

-- Which other roles' jobs a role can see. Fixed per org, configured once.
create table if not exists public.role_visibility (
  role_id uuid not null references public.roles(id) on delete cascade,
  visible_role_id uuid not null references public.roles(id) on delete cascade,
  primary key (role_id, visible_role_id)
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  unique (org_id, name)
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (group_id, profile_id)
);

-- Which sites a user can access. A user with exactly one row here skips
-- the site picker in the UI.
create table if not exists public.site_scope (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  primary key (profile_id, site_id)
);

-- Structurally separate from any org's Admin role — cross-org support
-- access, not a tenant-level permission.
create table if not exists public.platform_admins (
  profile_id uuid primary key references public.profiles(id) on delete cascade
);

-- Every platform_admins read of another org's operational data gets
-- logged here (Section 4.6).
create table if not exists public.admin_access_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  org_id uuid not null references public.organisations(id) on delete cascade,
  table_accessed text not null,
  accessed_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Pitches & areas
-- ---------------------------------------------------------------------

-- Minimal core columns for now — extend once Andy's pitch CSV is
-- available (Section 11 open question). Do not assume its column shape.
create table if not exists public.pitches (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  pitch_number_or_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Task types & risk assessments (cross-referencing — see header note)
-- ---------------------------------------------------------------------

create table if not exists public.task_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  risk_assessment_id uuid,
  equipment_category text
);

create table if not exists public.risk_assessments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  task_type_id uuid,
  content jsonb,
  updated_at timestamptz not null default now()
);

do $$ begin
  alter table public.task_types
    add constraint task_types_risk_assessment_id_fkey
    foreign key (risk_assessment_id) references public.risk_assessments(id) on delete set null;
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.risk_assessments
    add constraint risk_assessments_task_type_id_fkey
    foreign key (task_type_id) references public.task_types(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists public.training_videos (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  task_type_id uuid references public.task_types(id) on delete set null,
  equipment_category text,
  youtube_url text not null,
  title text not null
);

-- ---------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------

create table if not exists public.job_statuses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  is_completed boolean not null default false,
  sort_order int not null default 0,
  unique (org_id, name)
);

create table if not exists public.job_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  template_schema jsonb,
  task_type_id uuid references public.task_types(id) on delete set null,
  requires_completion_photo boolean not null default false
);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  job_type_id uuid not null references public.job_types(id) on delete cascade,
  rrule text not null,
  lead_in_days int not null default 0,
  last_generated_date date
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  job_type_id uuid references public.job_types(id) on delete set null,
  description text not null,
  assignee_profile_id uuid references public.profiles(id) on delete set null,
  assignee_group_id uuid references public.groups(id) on delete set null,
  priority public.job_priority not null default 'medium',
  status_id uuid not null references public.job_statuses(id),
  due_date date,
  lead_in_date date,
  pitch_id uuid references public.pitches(id) on delete set null,
  area_id uuid references public.areas(id) on delete set null,
  -- Set by the scheduling Edge Function (Section 5) when it generates a
  -- job from a recurring schedule; null for manually created jobs.
  schedule_id uuid references public.schedules(id) on delete set null,
  closed_by uuid references public.profiles(id) on delete set null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  -- For offline creation dedup (Section 5) — the client generates this
  -- the moment the user saves, before the row exists server-side.
  client_generated_id uuid unique,
  -- A job is unassigned (both null), assigned to a person, or assigned
  -- to a group — never both at once.
  constraint jobs_single_assignee check (
    not (assignee_profile_id is not null and assignee_group_id is not null)
  )
);

create index if not exists jobs_org_site_idx on public.jobs (org_id, site_id);
create index if not exists jobs_assignee_profile_idx on public.jobs (assignee_profile_id);
create index if not exists jobs_assignee_group_idx on public.jobs (assignee_group_id);
create index if not exists jobs_status_idx on public.jobs (status_id);

create table if not exists public.job_photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid not null references public.profiles(id),
  uploaded_at timestamptz not null default now()
);

create table if not exists public.job_subtasks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  label text not null,
  is_checked boolean not null default false,
  sort_order int not null default 0
);

-- Append-only activity log. Edits are tracked, not immutable rows can be
-- inserted freely, but rows must never be deleted (enforced below and in
-- RLS — see 02-rls-policies.sql).
create table if not exists public.job_activity (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  event_type public.job_activity_event_type not null,
  actor_profile_id uuid not null references public.profiles(id),
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists job_activity_job_idx on public.job_activity (job_id);

create or replace function public.forbid_job_activity_delete()
returns trigger as $$
begin
  raise exception 'job_activity rows cannot be deleted';
end;
$$ language plpgsql;

drop trigger if exists job_activity_forbid_delete on public.job_activity;
create trigger job_activity_forbid_delete
  before delete on public.job_activity
  for each row execute function public.forbid_job_activity_delete();

-- ---------------------------------------------------------------------
-- Equipment & H&S
-- ---------------------------------------------------------------------

create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  held_by_profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  status public.equipment_status not null default 'in_service',
  check_frequency_days int
);

create table if not exists public.equipment_checks (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  checked_by uuid not null references public.profiles(id),
  checked_at timestamptz not null default now(),
  passed boolean not null
);

create table if not exists public.fault_reports (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  reported_by uuid not null references public.profiles(id),
  description text not null,
  appointed_person_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.fault_photos (
  id uuid primary key default gen_random_uuid(),
  fault_report_id uuid not null references public.fault_reports(id) on delete cascade,
  storage_path text not null
);

create table if not exists public.repair_records (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  fault_report_id uuid references public.fault_reports(id) on delete set null,
  note text not null,
  cost numeric,
  vendor text,
  repaired_at timestamptz,
  repaired_by uuid references public.profiles(id)
);

-- ---------------------------------------------------------------------
-- Notifications & exports
-- ---------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  trigger_type text not null,
  priority public.notification_priority not null,
  payload jsonb,
  -- null = queued behind DND, delivered once dnd_enabled flips off.
  delivered_at timestamptz
);

create index if not exists notifications_recipient_idx on public.notifications (recipient_profile_id);

create table if not exists public.export_logs (
  id uuid primary key default gen_random_uuid(),
  exported_by uuid not null references public.profiles(id),
  org_id uuid not null references public.organisations(id) on delete cascade,
  filters_used jsonb,
  exported_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- push_subscriptions — needed by src/platform/notifications.js, not
-- explicitly listed in Section 3 but required to actually deliver Web
-- Push (Section 7). One row per browser subscription per profile.
-- ---------------------------------------------------------------------

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_profile_idx on public.push_subscriptions (profile_id);

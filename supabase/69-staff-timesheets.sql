-- Tree Tops Maintenance Platform -- Staff Timesheets (Phase 1)
-- Run after 68-license-agreement-standard-instructions.sql.
--
-- Replaces the team's paper weekly timesheet (Monday-Sunday, Morning
-- Hours / Lunch (unpaid, unrecorded) / Afternoon Hours / Daily Total)
-- with a shared record usable from desktop, the PWA, and the Kiosk
-- (reusing its existing RFID-fob identity -- no kiosk-specific logic
-- needed here). Andy freezes a week globally just before running Sage
-- payroll; after that, only can_manage_timesheets holders can still
-- change it, and every such change is logged.
--
-- Two permissions, same use/manage split as License Agreement and
-- Office Hub. can_submit_timesheet is deliberately seeded to NO role --
-- Andy turns it on per-role himself in Roles & Permissions (confirmed
-- this can include Office, not just field/wage roles).
insert into public.permissions (key, description) values
  ('can_submit_timesheet', 'Can fill in and submit a weekly timesheet -- assign to whichever roles need one, including Office if required'),
  ('can_manage_timesheets', 'Can enter or edit anyone''s timesheet, freeze/unfreeze a week for payroll, reorder the payroll grid, and see the post-freeze override log')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, 'can_manage_timesheets', true
from public.roles r
where r.name = 'Admin'
  and r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- One row per org per week -- the global freeze switch. week_start is
-- always the Monday. Never written to directly by clients; only via
-- freeze_timesheet_week/unfreeze_timesheet_week below.
create table if not exists public.timesheet_weeks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  week_start date not null,
  frozen_at timestamptz,
  frozen_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (org_id, week_start)
);

-- Every normal day AND every correction, in one table with a
-- discriminator -- "this week's total including any adjustments entered
-- this week" is then a single sum(daily_total) where
-- entered_week_start = :week, no union needed.
--
-- entry_kind = 'daily': work_date is the day worked; entered_week_start
-- is force-set by trigger to the Monday of that same week, regardless of
-- what's sent.
-- entry_kind = 'adjustment': work_date is the ORIGINAL date being
-- corrected; entered_week_start is whichever week the correction is
-- actually being keyed into (normally next week, not hard-coded to
-- "next" -- someone could catch up later than that).
--
-- Lunch is deliberately not a column -- it's a static label the UI
-- prints between Morning and Afternoon, matching the paper form, with
-- nothing stored for it.
create table if not exists public.timesheet_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  entry_kind text not null default 'daily' check (entry_kind in ('daily', 'adjustment')),
  work_date date not null,
  entered_week_start date not null,
  morning_hours numeric(4,2),
  afternoon_hours numeric(4,2),
  adjustment_hours numeric(5,2),
  daily_total numeric(5,2) generated always as (
    case
      when entry_kind = 'adjustment' then adjustment_hours
      else coalesce(morning_hours, 0) + coalesce(afternoon_hours, 0)
    end
  ) stored,
  corrects_entry_id uuid references public.timesheet_entries(id) on delete set null,
  adjustment_reason text,
  -- Free-text note against a day (e.g. "covered OP for the storm clean-up") --
  -- unconstrained by entry_kind, unlike adjustment_reason which is required
  -- specifically for adjustment rows.
  notes text,
  -- No stored is_forecast column: `created_at::date < work_date` isn't a
  -- valid generated-column expression (the timestamptz->date cast is
  -- STABLE, not IMMUTABLE, since it depends on the session's TimeZone
  -- setting). It's purely informational anyway, so it's computed
  -- client-side from created_at vs work_date when displaying instead.
  -- Force-set by trigger from auth.uid(), never trusted from the client --
  -- this is what quietly satisfies "who actually typed this cell"
  -- pre-freeze, without any UI surfacing it.
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Defensive: if this file was already run before the notes column was
-- added, this brings an existing table up to date without needing a
-- separate follow-up migration -- create table if not exists above is a
-- no-op once the table already exists, so this is the line that actually
-- adds the column in that case.
alter table public.timesheet_entries add column if not exists notes text;

-- One normal day-row per person per date. No such constraint on
-- adjustment rows -- someone could have more than one correction
-- against the same original day.
create unique index if not exists timesheet_entries_one_daily_per_day
  on public.timesheet_entries (profile_id, work_date)
  where entry_kind = 'daily';

create index if not exists timesheet_entries_org_week_idx
  on public.timesheet_entries (org_id, entered_week_start);
create index if not exists timesheet_entries_profile_date_idx
  on public.timesheet_entries (profile_id, work_date);

-- Lets Andy set the admin grid's row order (e.g. to match Sage's own,
-- unrelated order) instead of alphabetical. Deliberately has no week
-- dimension -- one standing order per org, applied to every week, not
-- reset or re-chosen each time. A submittable person with no row here
-- just sorts to the end by name.
create table if not exists public.timesheet_person_order (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  sort_order int not null default 0,
  unique (org_id, profile_id)
);

-- Written only when a change touches an already-frozen week (which, by
-- construction, only can_manage_timesheets holders can do at all -- RLS
-- blocks everyone else outright). freeze/unfreeze rows have entry_id and
-- profile_id null since they affect the whole week, not one person/entry.
create table if not exists public.timesheet_audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  entry_id uuid references public.timesheet_entries(id) on delete set null,
  profile_id uuid references public.profiles(id),
  week_start date not null,
  action text not null check (action in ('insert', 'update', 'delete', 'freeze', 'unfreeze')),
  field_changes jsonb,
  actor_profile_id uuid not null references public.profiles(id),
  occurred_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Helper function -- mirrors current_org_id()/has_permission() in
-- 02-rls-policies.sql, but checks the SUBJECT profile's role, not the
-- caller's, since office may be entering hours for someone whose role
-- differs from their own.
-- ---------------------------------------------------------------------

create or replace function public.profile_can_submit_timesheet(p_profile_id uuid)
returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    join public.role_permissions rp on rp.role_id = p.role_id
    where p.id = p_profile_id
      and rp.permission_key = 'can_submit_timesheet'
      and rp.enabled
  );
$$;

-- ---------------------------------------------------------------------
-- Triggers -- RLS can't see per-column old-vs-new state cleanly, so the
-- frozen-week block (and the audit log write for a permitted override)
-- lives here, same idiom as enforce_job_details_edit_permission in
-- 27-job-details-edit-permission.sql.
-- ---------------------------------------------------------------------

create or replace function public.timesheet_entries_before_insert()
returns trigger as $$
declare
  v_frozen timestamptz;
begin
  new.org_id := public.current_org_id();
  new.created_by := auth.uid();
  new.updated_by := auth.uid();
  new.created_at := now();
  new.updated_at := now();

  if new.entry_kind = 'daily' then
    new.entered_week_start := date_trunc('week', new.work_date)::date;
    new.adjustment_hours := null;
    new.corrects_entry_id := null;
    new.adjustment_reason := null;
  elsif new.entry_kind = 'adjustment' then
    if new.entered_week_start is null then
      raise exception 'entered_week_start is required for an adjustment entry';
    end if;
    if new.adjustment_hours is null or new.adjustment_hours = 0 then
      raise exception 'adjustment_hours must be a non-zero signed value for an adjustment entry';
    end if;
    if new.corrects_entry_id is null then
      raise exception 'corrects_entry_id is required for an adjustment entry';
    end if;
    if new.adjustment_reason is null or btrim(new.adjustment_reason) = '' then
      raise exception 'adjustment_reason is required for an adjustment entry';
    end if;
    new.morning_hours := null;
    new.afternoon_hours := null;
  end if;

  select frozen_at into v_frozen
  from public.timesheet_weeks
  where org_id = new.org_id and week_start = new.entered_week_start;

  if v_frozen is not null then
    if not public.has_permission('can_manage_timesheets') then
      raise exception 'This week is frozen -- ask the office to make this change';
    end if;
    insert into public.timesheet_audit_log (org_id, entry_id, profile_id, week_start, action, field_changes, actor_profile_id)
    values (new.org_id, new.id, new.profile_id, new.entered_week_start, 'insert', to_jsonb(new), auth.uid());
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.timesheet_entries_before_update()
returns trigger as $$
declare
  v_old_frozen timestamptz;
  v_new_frozen timestamptz;
  v_diff jsonb := '{}'::jsonb;
begin
  new.updated_by := auth.uid();
  new.updated_at := now();

  if new.entry_kind = 'daily' then
    new.entered_week_start := date_trunc('week', new.work_date)::date;
  end if;

  select frozen_at into v_old_frozen
  from public.timesheet_weeks
  where org_id = old.org_id and week_start = old.entered_week_start;

  if new.entered_week_start is distinct from old.entered_week_start then
    select frozen_at into v_new_frozen
    from public.timesheet_weeks
    where org_id = new.org_id and week_start = new.entered_week_start;
  else
    v_new_frozen := v_old_frozen;
  end if;

  if (v_old_frozen is not null or v_new_frozen is not null)
     and not public.has_permission('can_manage_timesheets') then
    raise exception 'This week is frozen -- ask the office to make this change';
  end if;

  if v_old_frozen is not null then
    if new.morning_hours is distinct from old.morning_hours then
      v_diff := v_diff || jsonb_build_object('morning_hours', jsonb_build_object('old', old.morning_hours, 'new', new.morning_hours));
    end if;
    if new.afternoon_hours is distinct from old.afternoon_hours then
      v_diff := v_diff || jsonb_build_object('afternoon_hours', jsonb_build_object('old', old.afternoon_hours, 'new', new.afternoon_hours));
    end if;
    if new.adjustment_hours is distinct from old.adjustment_hours then
      v_diff := v_diff || jsonb_build_object('adjustment_hours', jsonb_build_object('old', old.adjustment_hours, 'new', new.adjustment_hours));
    end if;
    if new.work_date is distinct from old.work_date then
      v_diff := v_diff || jsonb_build_object('work_date', jsonb_build_object('old', old.work_date, 'new', new.work_date));
    end if;
    if new.adjustment_reason is distinct from old.adjustment_reason then
      v_diff := v_diff || jsonb_build_object('adjustment_reason', jsonb_build_object('old', old.adjustment_reason, 'new', new.adjustment_reason));
    end if;
    if new.notes is distinct from old.notes then
      v_diff := v_diff || jsonb_build_object('notes', jsonb_build_object('old', old.notes, 'new', new.notes));
    end if;

    insert into public.timesheet_audit_log (org_id, entry_id, profile_id, week_start, action, field_changes, actor_profile_id)
    values (old.org_id, old.id, old.profile_id, old.entered_week_start, 'update', v_diff, auth.uid());
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.timesheet_entries_before_delete()
returns trigger as $$
declare
  v_frozen timestamptz;
begin
  select frozen_at into v_frozen
  from public.timesheet_weeks
  where org_id = old.org_id and week_start = old.entered_week_start;

  if v_frozen is not null then
    if not public.has_permission('can_manage_timesheets') then
      raise exception 'This week is frozen -- ask the office to make this change';
    end if;
    insert into public.timesheet_audit_log (org_id, entry_id, profile_id, week_start, action, field_changes, actor_profile_id)
    values (old.org_id, old.id, old.profile_id, old.entered_week_start, 'delete', to_jsonb(old), auth.uid());
  end if;

  return old;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists timesheet_entries_before_insert_trg on public.timesheet_entries;
create trigger timesheet_entries_before_insert_trg
  before insert on public.timesheet_entries
  for each row execute function public.timesheet_entries_before_insert();

drop trigger if exists timesheet_entries_before_update_trg on public.timesheet_entries;
create trigger timesheet_entries_before_update_trg
  before update on public.timesheet_entries
  for each row execute function public.timesheet_entries_before_update();

drop trigger if exists timesheet_entries_before_delete_trg on public.timesheet_entries;
create trigger timesheet_entries_before_delete_trg
  before delete on public.timesheet_entries
  for each row execute function public.timesheet_entries_before_delete();

-- ---------------------------------------------------------------------
-- RPCs -- freezing/unfreezing isn't a row-level event on
-- timesheet_entries, so these are separate security definer functions
-- rather than another trigger. timesheet_weeks carries no client write
-- policy at all; these are the only way to change it.
-- ---------------------------------------------------------------------

create or replace function public.freeze_timesheet_week(p_week_start date)
returns void as $$
declare
  v_org_id uuid := public.current_org_id();
begin
  if not public.has_permission('can_manage_timesheets') then
    raise exception 'You do not have permission to freeze timesheets';
  end if;

  insert into public.timesheet_weeks (org_id, week_start, frozen_at, frozen_by)
  values (v_org_id, p_week_start, now(), auth.uid())
  on conflict (org_id, week_start)
  do update set frozen_at = now(), frozen_by = auth.uid();

  insert into public.timesheet_audit_log (org_id, week_start, action, actor_profile_id)
  values (v_org_id, p_week_start, 'freeze', auth.uid());
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

create or replace function public.unfreeze_timesheet_week(p_week_start date)
returns void as $$
declare
  v_org_id uuid := public.current_org_id();
begin
  if not public.has_permission('can_manage_timesheets') then
    raise exception 'You do not have permission to unfreeze timesheets';
  end if;

  update public.timesheet_weeks
  set frozen_at = null, frozen_by = null
  where org_id = v_org_id and week_start = p_week_start;

  insert into public.timesheet_audit_log (org_id, week_start, action, actor_profile_id)
  values (v_org_id, p_week_start, 'unfreeze', auth.uid());
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table public.timesheet_weeks enable row level security;
alter table public.timesheet_entries enable row level security;
alter table public.timesheet_person_order enable row level security;
alter table public.timesheet_audit_log enable row level security;

-- timesheet_weeks: read-only to clients (own eligibility either way);
-- all writes go through the RPCs above.
drop policy if exists timesheet_weeks_select on public.timesheet_weeks;
create policy timesheet_weeks_select on public.timesheet_weeks
  for select using (
    org_id = public.current_org_id()
    and (public.has_permission('can_submit_timesheet') or public.has_permission('can_manage_timesheets'))
  );

-- timesheet_entries: own rows, or every row with can_manage_timesheets.
-- The eligibility check (profile_can_submit_timesheet) only needs to
-- happen at insert time -- update/delete already require an existing row
-- that passed it. The frozen-week block itself lives in the triggers
-- above, not here (RLS can't see old-vs-new state cleanly).
drop policy if exists timesheet_entries_select on public.timesheet_entries;
create policy timesheet_entries_select on public.timesheet_entries
  for select using (
    org_id = public.current_org_id()
    and (profile_id = auth.uid() or public.has_permission('can_manage_timesheets'))
  );

drop policy if exists timesheet_entries_insert on public.timesheet_entries;
create policy timesheet_entries_insert on public.timesheet_entries
  for insert with check (
    org_id = public.current_org_id()
    and public.profile_can_submit_timesheet(profile_id)
    and (profile_id = auth.uid() or public.has_permission('can_manage_timesheets'))
  );

drop policy if exists timesheet_entries_update on public.timesheet_entries;
create policy timesheet_entries_update on public.timesheet_entries
  for update
  using (
    org_id = public.current_org_id()
    and (profile_id = auth.uid() or public.has_permission('can_manage_timesheets'))
  )
  with check (
    org_id = public.current_org_id()
    and (profile_id = auth.uid() or public.has_permission('can_manage_timesheets'))
  );

drop policy if exists timesheet_entries_delete on public.timesheet_entries;
create policy timesheet_entries_delete on public.timesheet_entries
  for delete using (
    org_id = public.current_org_id()
    and (profile_id = auth.uid() or public.has_permission('can_manage_timesheets'))
  );

-- timesheet_person_order: anyone who can see the grid can read the
-- order; only can_manage_timesheets can change it.
drop policy if exists timesheet_person_order_select on public.timesheet_person_order;
create policy timesheet_person_order_select on public.timesheet_person_order
  for select using (
    org_id = public.current_org_id()
    and (public.has_permission('can_submit_timesheet') or public.has_permission('can_manage_timesheets'))
  );

drop policy if exists timesheet_person_order_write on public.timesheet_person_order;
create policy timesheet_person_order_write on public.timesheet_person_order
  for all
  using (org_id = public.current_org_id() and public.has_permission('can_manage_timesheets'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_timesheets'));

-- timesheet_audit_log: read-only to can_manage_timesheets; no client
-- write policy -- only the triggers and RPCs above (security definer)
-- write to it.
drop policy if exists timesheet_audit_log_select on public.timesheet_audit_log;
create policy timesheet_audit_log_select on public.timesheet_audit_log
  for select using (
    org_id = public.current_org_id()
    and public.has_permission('can_manage_timesheets')
  );

-- Tree Tops Maintenance Platform -- Holiday Accrual and Booking (Phase 2)
-- Run after 69-staff-timesheets.sql.
--
-- Adds: per-person work patterns, org-wide holiday settings/baseline,
-- bank holidays (+ rare per-person override), group/person-level holiday
-- approvers, a pending/approved/declined request workflow, and a third
-- timesheet_entries kind ('holiday') so an approved day lands on the
-- exact same payroll grid/freeze/audit machinery Phase 1 already built --
-- no parallel system.
--
-- Key validated design decision (worked through numerically before
-- committing): because every person's entitlement is pro-rated linearly
-- from one baseline (entitlement_hours = baseline_days * baseline_daily_hours
-- / baseline_weekly_hours * their_weekly_hours), dividing back through by
-- their own weekly hours always yields the same entitlement-in-weeks
-- regardless of whose hours you plug in. So there is only ONE global
-- accrual ratio (5.6 / 46.4, approx 12.07%) applied uniformly to
-- everyone's actual hours worked -- not a personal ratio per person.
-- Accrual runs only on entry_kind = 'daily' hours -- NOT on 'holiday'
-- (this is what makes it self-correct to the true entitlement regardless
-- of when leave is taken -- the alternative systematically over-accrues)
-- and NOT on 'adjustment' (a correction to hours already counted
-- elsewhere, not new hours worked).

insert into public.permissions (key, description) values
  ('can_approve_holiday', 'Can approve or decline holiday requests from people who resolve to them as approver via group or an individual override -- combined with actually being that person''s resolved approver, not a blanket right on its own')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, 'can_approve_holiday', true
from public.roles r
where r.name = 'Admin'
  and r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- One row per person. Doubles as "how is this person paid" and "what's
-- their holiday pattern" -- for someone like Jayne these are facts about
-- the same underlying reality, not two separate concerns.
--
-- The 7 works_* booleans (not just a day COUNT) are what the booking
-- calendar greys out as non-working, same treatment as a bank holiday --
-- a count alone can't tell the calendar which specific weekdays to grey.
-- is_standard_5_day is GENERATED from them so it can never drift out of
-- sync with the actual pattern; it's the single fact gating bank-holiday
-- auto-booking.
create table if not exists public.staff_time_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  org_id uuid not null references public.organisations(id) on delete cascade,
  pay_basis text not null default 'hourly_daily' check (pay_basis in ('hourly_daily', 'fixed_weekly')),
  weekly_hours numeric(5,2) not null,
  -- false = "varies week to week" (Nic, Sam): the works_* columns are
  -- ignored entirely -- no day is greyed on their booking calendar, and
  -- they're excluded from bank-holiday auto-booking regardless of what
  -- the boolean defaults below would otherwise evaluate to.
  has_fixed_pattern boolean not null default true,
  works_monday boolean not null default true,
  works_tuesday boolean not null default true,
  works_wednesday boolean not null default true,
  works_thursday boolean not null default true,
  works_friday boolean not null default true,
  works_saturday boolean not null default false,
  works_sunday boolean not null default false,
  is_standard_5_day boolean generated always as (
    works_monday and works_tuesday and works_wednesday and works_thursday and works_friday
    and not works_saturday and not works_sunday
  ) stored,
  -- Drives whether MyHolidayStatus.jsx also shows a days-equivalent
  -- figure alongside hours (Jayne's own "25.6 days" is exactly the kind
  -- of thing this should show her) -- kept independent of
  -- has_fixed_pattern for flexibility, but normally set the same way.
  has_fixed_entitlement boolean not null default true,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

-- One row per org -- the baseline everyone's entitlement is pro-rated
-- from, and the holiday-year window. holiday_year_start_month must never
-- be hardcoded anywhere else in the app -- Andy is actively weighing a
-- switch from April to January and hasn't decided.
create table if not exists public.holiday_settings (
  org_id uuid primary key references public.organisations(id) on delete cascade,
  holiday_year_start_month int not null default 4 check (holiday_year_start_month between 1 and 12),
  baseline_annual_days numeric(4,2) not null default 28,
  baseline_weekly_hours numeric(5,2) not null default 35,
  baseline_daily_hours numeric(4,2) not null default 7,
  updated_at timestamptz not null default now()
);

-- Specific dates per year, admin-maintained -- not computed. Easter-based
-- UK bank holidays move and government occasionally adds one-offs, and
-- there's no existing recurrence infrastructure in this codebase suited
-- to it (rrule is tightly coupled to the unrelated maintenance-job
-- scheduling feature).
create table if not exists public.holiday_bank_holidays (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  holiday_date date not null,
  label text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (org_id, holiday_date)
);

-- Presence of a row here means "this bank holiday does not auto-book for
-- this person this instance" -- the rare "asked to work a specific bank
-- holiday" case. A one-off per date+person, not a profile setting.
create table if not exists public.holiday_bank_holiday_overrides (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  bank_holiday_id uuid not null references public.holiday_bank_holidays(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (bank_holiday_id, profile_id)
);

-- Created before timesheet_entries is altered below, since that table
-- gains FK columns pointing at these two.
create table if not exists public.holiday_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  submitted_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  decline_reason text,
  created_by uuid not null references public.profiles(id)
);

create table if not exists public.holiday_request_days (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.holiday_requests(id) on delete cascade,
  work_date date not null,
  requested_hours numeric(4,2) not null,
  note text,
  unique (request_id, work_date)
);

-- ---------------------------------------------------------------------
-- Approver resolution -- people are only ever in one group in practice
-- (confirmed with Andy), so no "primary group" tie-break mechanism is
-- needed; the per-person override column is the real safety valve for
-- any genuine exception.
-- ---------------------------------------------------------------------

alter table public.groups add column if not exists approver_profile_id uuid references public.profiles(id) on delete set null;
alter table public.profiles add column if not exists holiday_approver_override_profile_id uuid references public.profiles(id) on delete set null;

create or replace function public.resolve_holiday_approver(p_profile_id uuid)
returns uuid
language sql security definer stable
set search_path = public, pg_temp
as $$
  select coalesce(
    (select holiday_approver_override_profile_id from public.profiles where id = p_profile_id),
    (select g.approver_profile_id
     from public.group_members gm
     join public.groups g on g.id = gm.group_id
     where gm.profile_id = p_profile_id and g.approver_profile_id is not null
     limit 1)
  );
$$;

-- ---------------------------------------------------------------------
-- Holiday-year and accrual-ratio helpers
-- ---------------------------------------------------------------------

create or replace function public.holiday_year_bounds(p_org_id uuid, p_as_of date default current_date)
returns table(starts_on date, ends_on date)
language sql security definer stable
set search_path = public, pg_temp
as $$
  with settings as (
    select coalesce(
      (select holiday_year_start_month from public.holiday_settings where org_id = p_org_id),
      4
    ) as start_month
  ),
  candidate as (
    select make_date(extract(year from p_as_of)::int, start_month, 1) as this_year_start
    from settings
  )
  select
    (case when p_as_of >= this_year_start then this_year_start else this_year_start - interval '1 year' end)::date as starts_on,
    (case when p_as_of >= this_year_start then this_year_start else this_year_start - interval '1 year' end
      + interval '1 year' - interval '1 day')::date as ends_on
  from candidate;
$$;

-- The single global ratio -- see the file header note. Every person's
-- entitlement-in-weeks collapses to the same value once pro-rated
-- linearly from one baseline, so this takes no per-person input.
create or replace function public.holiday_accrual_ratio(p_org_id uuid)
returns numeric
language sql security definer stable
set search_path = public, pg_temp
as $$
  select entitlement_weeks / (52 - entitlement_weeks)
  from (
    select coalesce(
      (select baseline_annual_days * baseline_daily_hours / baseline_weekly_hours
       from public.holiday_settings where org_id = p_org_id),
      5.6
    ) as entitlement_weeks
  ) s;
$$;

-- ---------------------------------------------------------------------
-- Entitlement/accrual/taken -- computed on demand, not trigger-maintained.
-- A stored running balance would duplicate state already fully derivable
-- from timesheet_entries, and risks drift if the baseline or someone's
-- weekly_hours ever changes. Each of the three low-level functions
-- shares the same view-your-own-or-your-approvee's-status authorization
-- check via can_view_holiday_status, rather than repeating the boolean
-- logic three times or relying on a REVOKE-based access pattern this
-- codebase doesn't otherwise use.
-- ---------------------------------------------------------------------

create or replace function public.can_view_holiday_status(p_profile_id uuid)
returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select p_profile_id = auth.uid()
    or public.has_permission('can_manage_timesheets')
    or auth.uid() = public.resolve_holiday_approver(p_profile_id);
$$;

create or replace function public.holiday_entitlement_hours(p_profile_id uuid)
returns numeric
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
declare
  v_result numeric;
begin
  if not public.can_view_holiday_status(p_profile_id) then
    raise exception 'You are not authorised to view this person''s holiday entitlement';
  end if;

  select stp.weekly_hours * (
    select hs.baseline_annual_days * hs.baseline_daily_hours / hs.baseline_weekly_hours
    from public.holiday_settings hs where hs.org_id = stp.org_id
  )
  into v_result
  from public.staff_time_profiles stp
  where stp.profile_id = p_profile_id;

  return coalesce(v_result, 0);
end;
$$;

create or replace function public.holiday_accrued_hours(p_profile_id uuid, p_as_of date default current_date)
returns numeric
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
declare
  v_result numeric;
begin
  if not public.can_view_holiday_status(p_profile_id) then
    raise exception 'You are not authorised to view this person''s holiday accrual';
  end if;

  select coalesce(sum(te.daily_total), 0) * public.holiday_accrual_ratio(p.org_id)
  into v_result
  from public.timesheet_entries te
  join public.profiles p on p.id = te.profile_id
  cross join lateral public.holiday_year_bounds(p.org_id, p_as_of) yb
  where te.profile_id = p_profile_id
    and te.entry_kind = 'daily'
    and te.work_date between yb.starts_on and least(p_as_of, yb.ends_on);

  return coalesce(v_result, 0);
end;
$$;

create or replace function public.holiday_taken_hours(p_profile_id uuid, p_as_of date default current_date)
returns numeric
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
declare
  v_result numeric;
begin
  if not public.can_view_holiday_status(p_profile_id) then
    raise exception 'You are not authorised to view this person''s holiday taken';
  end if;

  select coalesce(sum(te.daily_total), 0)
  into v_result
  from public.timesheet_entries te
  join public.profiles p on p.id = te.profile_id
  cross join lateral public.holiday_year_bounds(p.org_id, p_as_of) yb
  where te.profile_id = p_profile_id
    and te.entry_kind = 'holiday'
    and te.work_date between yb.starts_on and least(p_as_of, yb.ends_on);

  return coalesce(v_result, 0);
end;
$$;

-- Convenience bundle for the self-service/approver-review UI.
create or replace function public.holiday_status(p_profile_id uuid)
returns table(entitlement_hours numeric, accrued_hours numeric, taken_hours numeric, remaining_hours numeric)
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
declare
  v_entitlement numeric;
  v_accrued numeric;
  v_taken numeric;
begin
  v_entitlement := public.holiday_entitlement_hours(p_profile_id);
  v_accrued := public.holiday_accrued_hours(p_profile_id);
  v_taken := public.holiday_taken_hours(p_profile_id);
  return query select v_entitlement, v_accrued, v_taken, v_entitlement - v_taken;
end;
$$;

-- ---------------------------------------------------------------------
-- Extend timesheet_entries with a third entry_kind, 'holiday' -- this is
-- the reuse decision that avoids a parallel payroll-total system. An
-- approved holiday day, or an auto-booked bank holiday, is just another
-- row here, inheriting the frozen-week block and audit logging Phase 1
-- already built, for free.
-- ---------------------------------------------------------------------

alter table public.timesheet_entries add column if not exists holiday_hours numeric(5,2);
alter table public.timesheet_entries add column if not exists holiday_source text check (holiday_source in ('request', 'bank_holiday'));
alter table public.timesheet_entries add column if not exists holiday_request_id uuid references public.holiday_requests(id) on delete set null;
alter table public.timesheet_entries add column if not exists bank_holiday_id uuid references public.holiday_bank_holidays(id) on delete set null;

alter table public.timesheet_entries drop constraint if exists timesheet_entries_entry_kind_check;
alter table public.timesheet_entries add constraint timesheet_entries_entry_kind_check
  check (entry_kind in ('daily', 'adjustment', 'holiday'));

-- A generated column's expression can't be ALTERed in place -- drop and
-- re-add. Idempotent as a pair: dropping a column that may not exist
-- (if this is the first run) is a no-op via IF EXISTS, and the ADD always
-- follows a DROP in the same script, so re-running never hits "column
-- already exists."
alter table public.timesheet_entries drop column if exists daily_total;
alter table public.timesheet_entries add column daily_total numeric(5,2) generated always as (
  case
    when entry_kind = 'adjustment' then adjustment_hours
    when entry_kind = 'holiday' then holiday_hours
    else coalesce(morning_hours, 0) + coalesce(afternoon_hours, 0)
  end
) stored;

-- Widened to include 'holiday' -- the database itself now guarantees a
-- person can never have both a worked day and a holiday day on the same
-- date.
drop index if exists timesheet_entries_one_daily_per_day;
create unique index timesheet_entries_one_daily_per_day
  on public.timesheet_entries (profile_id, work_date)
  where entry_kind in ('daily', 'holiday');

-- Trigger functions re-created with their 'daily'/'adjustment' branches
-- preserved verbatim, plus a new 'holiday' branch.

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
    new.holiday_hours := null;
    new.holiday_source := null;
    new.holiday_request_id := null;
    new.bank_holiday_id := null;
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
    new.holiday_hours := null;
    new.holiday_source := null;
    new.holiday_request_id := null;
    new.bank_holiday_id := null;
  elsif new.entry_kind = 'holiday' then
    new.entered_week_start := date_trunc('week', new.work_date)::date;
    if new.holiday_hours is null or new.holiday_hours <= 0 then
      raise exception 'holiday_hours must be a positive value for a holiday entry';
    end if;
    if new.holiday_source is null then
      raise exception 'holiday_source is required for a holiday entry';
    end if;
    if new.holiday_source = 'request' and new.holiday_request_id is null then
      raise exception 'holiday_request_id is required when holiday_source is request';
    end if;
    if new.holiday_source = 'bank_holiday' and new.bank_holiday_id is null then
      raise exception 'bank_holiday_id is required when holiday_source is bank_holiday';
    end if;
    new.morning_hours := null;
    new.afternoon_hours := null;
    new.adjustment_hours := null;
    new.corrects_entry_id := null;
    new.adjustment_reason := null;
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

  if new.entry_kind in ('daily', 'holiday') then
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
    if new.holiday_hours is distinct from old.holiday_hours then
      v_diff := v_diff || jsonb_build_object('holiday_hours', jsonb_build_object('old', old.holiday_hours, 'new', new.holiday_hours));
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

-- timesheet_entries_before_delete is unchanged (to_jsonb(old) already
-- captures every column generically regardless of entry_kind) -- no
-- create or replace needed here, it already handles 'holiday' rows.

-- ---------------------------------------------------------------------
-- Request/approval RPCs -- mirror freeze_timesheet_week/
-- unfreeze_timesheet_week's idiom exactly. No client insert/update
-- policy on holiday_requests/holiday_request_days at all -- these RPCs
-- (security definer, bypass RLS as table owner) are the only way in.
-- ---------------------------------------------------------------------

create or replace function public.submit_holiday_request(p_profile_id uuid, p_days jsonb)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_request_id uuid;
  v_total numeric;
  v_entitlement numeric;
  v_taken numeric;
begin
  if not (p_profile_id = auth.uid() or public.has_permission('can_manage_timesheets')) then
    raise exception 'You cannot submit a holiday request for someone else';
  end if;

  select org_id into v_org_id from public.profiles where id = p_profile_id;

  select coalesce(sum((d->>'hours')::numeric), 0) into v_total
  from jsonb_array_elements(p_days) d;

  if v_total <= 0 then
    raise exception 'Select at least one day';
  end if;

  v_entitlement := public.holiday_entitlement_hours(p_profile_id);
  v_taken := public.holiday_taken_hours(p_profile_id);

  if v_taken + v_total > v_entitlement then
    raise exception 'This would exceed the annual holiday allowance';
  end if;

  insert into public.holiday_requests (org_id, profile_id, created_by)
  values (v_org_id, p_profile_id, auth.uid())
  returning id into v_request_id;

  insert into public.holiday_request_days (request_id, work_date, requested_hours, note)
  select v_request_id, (d->>'work_date')::date, (d->>'hours')::numeric, d->>'note'
  from jsonb_array_elements(p_days) d;

  return v_request_id;
end;
$$;

create or replace function public.approve_holiday_request(p_request_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_request record;
  v_day record;
  v_entitlement numeric;
  v_taken numeric;
  v_total numeric;
begin
  select * into v_request from public.holiday_requests where id = p_request_id;
  if v_request is null then
    raise exception 'Holiday request not found';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This request has already been decided';
  end if;

  if not (
    public.has_permission('can_manage_timesheets')
    or (public.has_permission('can_approve_holiday') and auth.uid() = public.resolve_holiday_approver(v_request.profile_id))
  ) then
    raise exception 'You are not authorised to approve this request';
  end if;

  select coalesce(sum(requested_hours), 0) into v_total
  from public.holiday_request_days where request_id = p_request_id;

  v_entitlement := public.holiday_entitlement_hours(v_request.profile_id);
  v_taken := public.holiday_taken_hours(v_request.profile_id);

  if v_taken + v_total > v_entitlement then
    raise exception 'Approving this would exceed the annual holiday allowance';
  end if;

  for v_day in select * from public.holiday_request_days where request_id = p_request_id loop
    insert into public.timesheet_entries (profile_id, entry_kind, work_date, holiday_hours, holiday_source, holiday_request_id)
    values (v_request.profile_id, 'holiday', v_day.work_date, v_day.requested_hours, 'request', p_request_id);
  end loop;

  update public.holiday_requests
  set status = 'approved', decided_by = auth.uid(), decided_at = now()
  where id = p_request_id;
end;
$$;

create or replace function public.decline_holiday_request(p_request_id uuid, p_reason text default null)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_request record;
begin
  select * into v_request from public.holiday_requests where id = p_request_id;
  if v_request is null then
    raise exception 'Holiday request not found';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This request has already been decided';
  end if;

  if not (
    public.has_permission('can_manage_timesheets')
    or (public.has_permission('can_approve_holiday') and auth.uid() = public.resolve_holiday_approver(v_request.profile_id))
  ) then
    raise exception 'You are not authorised to decline this request';
  end if;

  update public.holiday_requests
  set status = 'declined', decided_by = auth.uid(), decided_at = now(), decline_reason = p_reason
  where id = p_request_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Bank holiday auto-booking sync -- only for people whose CURRENT
-- pattern is has_fixed_pattern and is_standard_5_day. apply/remove are
-- normal insert/delete against timesheet_entries so they inherit the
-- standard triggers above.
-- ---------------------------------------------------------------------

create or replace function public.apply_bank_holiday_for_profile(p_bank_holiday_id uuid, p_profile_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_bh record;
  v_stp record;
  v_daily_hours numeric;
begin
  select * into v_bh from public.holiday_bank_holidays where id = p_bank_holiday_id;
  select * into v_stp from public.staff_time_profiles where profile_id = p_profile_id;
  if v_bh is null or v_stp is null then return; end if;
  if not (v_stp.has_fixed_pattern and v_stp.is_standard_5_day) then return; end if;
  if exists (
    select 1 from public.holiday_bank_holiday_overrides
    where bank_holiday_id = p_bank_holiday_id and profile_id = p_profile_id
  ) then
    return;
  end if;
  if exists (
    select 1 from public.timesheet_entries
    where profile_id = p_profile_id and work_date = v_bh.holiday_date
  ) then
    return; -- already has a row for that date -- don't duplicate on re-run
  end if;

  v_daily_hours := v_stp.weekly_hours / 5;
  insert into public.timesheet_entries (profile_id, entry_kind, work_date, holiday_hours, holiday_source, bank_holiday_id)
  values (p_profile_id, 'holiday', v_bh.holiday_date, v_daily_hours, 'bank_holiday', p_bank_holiday_id);
end;
$$;

create or replace function public.remove_bank_holiday_for_profile(p_bank_holiday_id uuid, p_profile_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.timesheet_entries
  where profile_id = p_profile_id
    and bank_holiday_id = p_bank_holiday_id
    and entry_kind = 'holiday'
    and holiday_source = 'bank_holiday';
end;
$$;

create or replace function public.sync_bank_holiday_on_insert()
returns trigger as $$
declare
  v_profile record;
begin
  for v_profile in
    select profile_id from public.staff_time_profiles
    where org_id = new.org_id and has_fixed_pattern and is_standard_5_day
  loop
    perform public.apply_bank_holiday_for_profile(new.id, v_profile.profile_id);
  end loop;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists holiday_bank_holidays_after_insert on public.holiday_bank_holidays;
create trigger holiday_bank_holidays_after_insert
  after insert on public.holiday_bank_holidays
  for each row execute function public.sync_bank_holiday_on_insert();

-- Only future dates when a pattern changes -- never rewrite past payroll.
create or replace function public.sync_bank_holiday_on_pattern_change()
returns trigger as $$
declare
  v_bh record;
  v_was_standard boolean;
  v_is_standard boolean;
begin
  v_was_standard := old.has_fixed_pattern and old.is_standard_5_day;
  v_is_standard := new.has_fixed_pattern and new.is_standard_5_day;

  if v_is_standard and not v_was_standard then
    for v_bh in
      select id from public.holiday_bank_holidays
      where org_id = new.org_id and holiday_date >= current_date
    loop
      perform public.apply_bank_holiday_for_profile(v_bh.id, new.profile_id);
    end loop;
  elsif v_was_standard and not v_is_standard then
    for v_bh in
      select id from public.holiday_bank_holidays
      where org_id = new.org_id and holiday_date >= current_date
    loop
      perform public.remove_bank_holiday_for_profile(v_bh.id, new.profile_id);
    end loop;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists staff_time_profiles_after_update on public.staff_time_profiles;
create trigger staff_time_profiles_after_update
  after update on public.staff_time_profiles
  for each row execute function public.sync_bank_holiday_on_pattern_change();

create or replace function public.sync_bank_holiday_override()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    perform public.remove_bank_holiday_for_profile(new.bank_holiday_id, new.profile_id);
    return new;
  elsif tg_op = 'DELETE' then
    perform public.apply_bank_holiday_for_profile(old.bank_holiday_id, old.profile_id);
    return old;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists holiday_bank_holiday_overrides_sync on public.holiday_bank_holiday_overrides;
create trigger holiday_bank_holiday_overrides_sync
  after insert or delete on public.holiday_bank_holiday_overrides
  for each row execute function public.sync_bank_holiday_override();

-- ---------------------------------------------------------------------
-- Global "who's off" calendar -- a dedicated function rather than
-- widening timesheet_entries' own SELECT policy, so this doesn't expose
-- daily hours/adjustment data org-wide just to show who's on holiday.
-- ---------------------------------------------------------------------

create or replace function public.team_holiday_calendar(p_month_start date, p_month_end date)
returns table(profile_id uuid, display_name text, work_date date, hours numeric)
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
begin
  if not public.has_permission('can_submit_timesheet') then
    raise exception 'You do not have access to the team holiday calendar';
  end if;

  return query
  select te.profile_id, p.display_name, te.work_date, te.daily_total
  from public.timesheet_entries te
  join public.profiles p on p.id = te.profile_id
  where te.org_id = public.current_org_id()
    and te.entry_kind = 'holiday'
    and te.work_date between p_month_start and p_month_end
  order by te.work_date;
end;
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table public.staff_time_profiles enable row level security;
alter table public.holiday_settings enable row level security;
alter table public.holiday_bank_holidays enable row level security;
alter table public.holiday_bank_holiday_overrides enable row level security;
alter table public.holiday_requests enable row level security;
alter table public.holiday_request_days enable row level security;

drop policy if exists staff_time_profiles_select on public.staff_time_profiles;
create policy staff_time_profiles_select on public.staff_time_profiles
  for select using (
    org_id = public.current_org_id()
    and (profile_id = auth.uid() or public.has_permission('can_manage_timesheets'))
  );

drop policy if exists staff_time_profiles_write on public.staff_time_profiles;
create policy staff_time_profiles_write on public.staff_time_profiles
  for all
  using (org_id = public.current_org_id() and public.has_permission('can_manage_timesheets'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_timesheets'));

drop policy if exists holiday_settings_select on public.holiday_settings;
create policy holiday_settings_select on public.holiday_settings
  for select using (org_id = public.current_org_id());

drop policy if exists holiday_settings_write on public.holiday_settings;
create policy holiday_settings_write on public.holiday_settings
  for all
  using (org_id = public.current_org_id() and public.has_permission('can_manage_timesheets'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_timesheets'));

drop policy if exists holiday_bank_holidays_select on public.holiday_bank_holidays;
create policy holiday_bank_holidays_select on public.holiday_bank_holidays
  for select using (org_id = public.current_org_id());

drop policy if exists holiday_bank_holidays_write on public.holiday_bank_holidays;
create policy holiday_bank_holidays_write on public.holiday_bank_holidays
  for all
  using (org_id = public.current_org_id() and public.has_permission('can_manage_timesheets'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_timesheets'));

drop policy if exists holiday_bank_holiday_overrides_all on public.holiday_bank_holiday_overrides;
create policy holiday_bank_holiday_overrides_all on public.holiday_bank_holiday_overrides
  for all
  using (org_id = public.current_org_id() and public.has_permission('can_manage_timesheets'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_timesheets'));

drop policy if exists holiday_requests_select on public.holiday_requests;
create policy holiday_requests_select on public.holiday_requests
  for select using (
    org_id = public.current_org_id()
    and (
      profile_id = auth.uid()
      or public.has_permission('can_manage_timesheets')
      or auth.uid() = public.resolve_holiday_approver(profile_id)
    )
  );

-- No insert/update policy at all -- submit/approve/decline only via the
-- RPCs above.
drop policy if exists holiday_requests_delete on public.holiday_requests;
create policy holiday_requests_delete on public.holiday_requests
  for delete using (
    org_id = public.current_org_id()
    and (
      (profile_id = auth.uid() and status = 'pending')
      or public.has_permission('can_manage_timesheets')
    )
  );

drop policy if exists holiday_request_days_select on public.holiday_request_days;
create policy holiday_request_days_select on public.holiday_request_days
  for select using (
    exists (
      select 1 from public.holiday_requests hr
      where hr.id = holiday_request_days.request_id
        and hr.org_id = public.current_org_id()
        and (
          hr.profile_id = auth.uid()
          or public.has_permission('can_manage_timesheets')
          or auth.uid() = public.resolve_holiday_approver(hr.profile_id)
        )
    )
  );
-- No write policy -- only ever written by submit_holiday_request; rows
-- cascade-delete with their parent request (covers withdrawal).

-- timesheet_entries: tighten the existing insert policy so a client can
-- never insert an entry_kind = 'holiday' row directly -- it must only
-- ever come from approve_holiday_request or the bank-holiday sync
-- functions (both security definer, bypass this policy as table owner).
-- Also tighten update/delete so a 'holiday' row can only be touched by
-- can_manage_timesheets, never by the person it belongs to directly --
-- otherwise someone could silently change their own already-approved
-- paid holiday hours after the fact, bypassing approval entirely.
drop policy if exists timesheet_entries_insert on public.timesheet_entries;
create policy timesheet_entries_insert on public.timesheet_entries
  for insert with check (
    org_id = public.current_org_id()
    and entry_kind in ('daily', 'adjustment')
    and public.profile_can_submit_timesheet(profile_id)
    and (profile_id = auth.uid() or public.has_permission('can_manage_timesheets'))
  );

drop policy if exists timesheet_entries_update on public.timesheet_entries;
create policy timesheet_entries_update on public.timesheet_entries
  for update
  using (
    org_id = public.current_org_id()
    and (
      (entry_kind in ('daily', 'adjustment') and (profile_id = auth.uid() or public.has_permission('can_manage_timesheets')))
      or (entry_kind = 'holiday' and public.has_permission('can_manage_timesheets'))
    )
  )
  with check (
    org_id = public.current_org_id()
    and (
      (entry_kind in ('daily', 'adjustment') and (profile_id = auth.uid() or public.has_permission('can_manage_timesheets')))
      or (entry_kind = 'holiday' and public.has_permission('can_manage_timesheets'))
    )
  );

drop policy if exists timesheet_entries_delete on public.timesheet_entries;
create policy timesheet_entries_delete on public.timesheet_entries
  for delete using (
    org_id = public.current_org_id()
    and (
      (entry_kind in ('daily', 'adjustment') and (profile_id = auth.uid() or public.has_permission('can_manage_timesheets')))
      or (entry_kind = 'holiday' and public.has_permission('can_manage_timesheets'))
    )
  );

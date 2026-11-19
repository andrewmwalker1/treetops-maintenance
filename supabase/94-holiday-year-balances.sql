-- Tree Tops Maintenance Platform -- agreed starting point for each
-- person's holiday year (Andy, 19 Nov 2026). Run after
-- 93-approve-holiday-over-forecast-hours.sql. Idempotent (IF NOT EXISTS,
-- drop-then-create, CREATE OR REPLACE), safe to re-run.
--
-- One row per person per holiday year (year_start = the year's first day,
-- per holiday_settings.holiday_year_start_month -- 1 April), all in hours
-- (the Admin screen lets the office enter days or hours):
--   carried_hours        agreed at the start of the year: + carried over
--                        from last year, - owed (taken early / borrowed).
--                        Adds to (or takes off) that year's allowance.
--   taken_before_hours   holiday already taken that year that isn't in the
--                        app -- for go-live part-way through 2026-27.
--                        Counts as taken.
--   worked_before_hours  hours worked that year before the app -- also for
--                        go-live. Counts towards "earned so far" only.
-- Edited from Admin -> Holiday -> Year start balances.

create table if not exists public.holiday_year_balances (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  org_id uuid not null references public.organisations(id) on delete cascade,
  year_start date not null,
  carried_hours numeric(6,2) not null default 0,
  taken_before_hours numeric(6,2) not null default 0 check (taken_before_hours >= 0),
  worked_before_hours numeric(7,2) not null default 0 check (worked_before_hours >= 0),
  note text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (profile_id, year_start)
);
grant select, insert, update, delete on public.holiday_year_balances to anon, authenticated, service_role;

alter table public.holiday_year_balances enable row level security;

drop policy if exists holiday_year_balances_select on public.holiday_year_balances;
create policy holiday_year_balances_select on public.holiday_year_balances
  for select using (
    org_id = public.current_org_id()
    and (profile_id = auth.uid() or public.has_permission('can_manage_timesheets'))
  );

drop policy if exists holiday_year_balances_write on public.holiday_year_balances;
create policy holiday_year_balances_write on public.holiday_year_balances
  for all
  using (org_id = public.current_org_id() and public.has_permission('can_manage_timesheets'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_timesheets'));

-- Who changed it, set server-side (same pattern as 72).
create or replace function public.holiday_year_balances_before_upsert()
returns trigger
language plpgsql
as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists holiday_year_balances_before_upsert on public.holiday_year_balances;
create trigger holiday_year_balances_before_upsert
  before insert or update on public.holiday_year_balances
  for each row execute function public.holiday_year_balances_before_upsert();

-- ---------------------------------------------------------------------
-- The three balance functions, each adding its part of the current
-- holiday year's row. Bodies otherwise as their latest versions
-- (entitlement: 70; accrued: 90; taken: 71).
-- ---------------------------------------------------------------------

create or replace function public.holiday_entitlement_hours(p_profile_id uuid)
returns numeric
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
declare
  v_result numeric;
  v_carried numeric;
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

  select b.carried_hours into v_carried
  from public.holiday_year_balances b
  join public.profiles p on p.id = b.profile_id
  cross join lateral public.holiday_year_bounds(p.org_id, current_date) yb
  where b.profile_id = p_profile_id and b.year_start = yb.starts_on;

  return coalesce(v_result, 0) + coalesce(v_carried, 0);
end;
$$;

create or replace function public.holiday_accrued_hours(p_profile_id uuid, p_as_of date default current_date)
returns numeric
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_starts_on date;
  v_ends_on date;
  v_worked numeric;
  v_before numeric;
begin
  if not public.can_view_holiday_status(p_profile_id) then
    raise exception 'You are not authorised to view this person''s holiday accrual';
  end if;

  select org_id into v_org_id from public.profiles where id = p_profile_id;
  select starts_on, ends_on into v_starts_on, v_ends_on from public.holiday_year_bounds(v_org_id, p_as_of);

  select coalesce(sum(te.daily_total), 0) into v_worked
  from public.timesheet_entries te
  where te.profile_id = p_profile_id
    and te.entry_kind = 'daily'
    and te.work_date between v_starts_on and least(p_as_of, v_ends_on);

  select worked_before_hours into v_before
  from public.holiday_year_balances
  where profile_id = p_profile_id and year_start = v_starts_on;

  return (v_worked + coalesce(v_before, 0)) * public.holiday_accrual_ratio(v_org_id);
end;
$$;

create or replace function public.holiday_taken_hours(p_profile_id uuid, p_as_of date default current_date)
returns numeric
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_starts_on date;
  v_ends_on date;
  v_taken numeric;
  v_before numeric;
begin
  if not public.can_view_holiday_status(p_profile_id) then
    raise exception 'You are not authorised to view this person''s holiday taken';
  end if;

  select org_id into v_org_id from public.profiles where id = p_profile_id;
  select starts_on, ends_on into v_starts_on, v_ends_on from public.holiday_year_bounds(v_org_id, p_as_of);

  select coalesce(sum(te.daily_total), 0) into v_taken
  from public.timesheet_entries te
  where te.profile_id = p_profile_id
    and te.entry_kind = 'holiday'
    and te.work_date between v_starts_on and v_ends_on;

  select taken_before_hours into v_before
  from public.holiday_year_balances
  where profile_id = p_profile_id and year_start = v_starts_on;

  return v_taken + coalesce(v_before, 0);
end;
$$;

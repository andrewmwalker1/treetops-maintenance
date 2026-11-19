-- Tree Tops Maintenance Platform -- unpaid leave through the holiday
-- system, and a per-person working-day length (Andy, 19 Nov 2026).
-- Run after 91-exclude-from-timesheets.sql. Idempotent (IF NOT EXISTS,
-- drop-then-add, CREATE OR REPLACE), safe to re-run.
--
-- Unpaid leave: a per-day "Unpaid" tick on a holiday request. It goes
-- through the same submit/approve flow, but:
--   - doesn't count against the annual allowance (submit/approve only
--     check the paid days), and
--   - on approval becomes a new entry_kind = 'unpaid' timesheet row, not
--     'holiday'. daily_total is generated as morning + afternoon for any
--     kind other than adjustment/holiday, so an unpaid row is 0 paid hours
--     with no change to that generated column; holiday_hours keeps the
--     hours off, for display. holiday_taken_hours() (entry_kind =
--     'holiday') and holiday_accrued_hours() (entry_kind = 'daily') skip
--     it as they should -- an unpaid day neither uses allowance nor earns
--     it.
--
-- Day length: staff_time_profiles.typical_day_hours, an optional override.
-- Left empty, the app works it out as weekly_hours / days in the pattern
-- (Peter 35/5 = 7, Jayne 32/4 = 8); set it for anyone whose hours vary
-- (Sam) or where the average is wrong. Display only -- everything is still
-- counted in hours.
--
-- Also restores what 74-fix-timesheet-audit-log-gap.sql accidentally
-- dropped from timesheet_entries_before_update(): 74 was written from the
-- pre-holiday (69) version, so since then a holiday row's
-- entered_week_start no longer followed its work_date and holiday_hours
-- changes in a frozen week weren't in the audit diff. The version below
-- is 74's (logs moves into a frozen week too) plus both of those back,
-- extended to 'unpaid'.

-- 1. Columns ------------------------------------------------------------

alter table public.holiday_request_days
  add column if not exists is_unpaid boolean not null default false;

alter table public.staff_time_profiles
  add column if not exists typical_day_hours numeric(4,2);
alter table public.staff_time_profiles drop constraint if exists staff_time_profiles_typical_day_hours_positive;
alter table public.staff_time_profiles add constraint staff_time_profiles_typical_day_hours_positive
  check (typical_day_hours is null or typical_day_hours > 0);

-- 2. 'unpaid' entry kind -------------------------------------------------

alter table public.timesheet_entries drop constraint if exists timesheet_entries_entry_kind_check;
alter table public.timesheet_entries add constraint timesheet_entries_entry_kind_check
  check (entry_kind in ('daily', 'adjustment', 'holiday', 'unpaid'));

-- One worked, holiday or unpaid row per person per day.
drop index if exists timesheet_entries_one_daily_per_day;
create unique index timesheet_entries_one_daily_per_day
  on public.timesheet_entries (profile_id, work_date)
  where entry_kind in ('daily', 'holiday', 'unpaid');

-- 70's version with 'unpaid' handled alongside 'holiday'.
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
  elsif new.entry_kind in ('holiday', 'unpaid') then
    new.entered_week_start := date_trunc('week', new.work_date)::date;
    if new.holiday_hours is null or new.holiday_hours <= 0 then
      raise exception 'holiday_hours must be a positive value for a holiday or unpaid entry';
    end if;
    if new.holiday_source is null then
      raise exception 'holiday_source is required for a holiday or unpaid entry';
    end if;
    if new.entry_kind = 'unpaid' and new.holiday_source <> 'request' then
      raise exception 'Unpaid leave can only come from a holiday request';
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

-- 74's version + holiday/unpaid week sync + holiday_hours in the diff.
create or replace function public.timesheet_entries_before_update()
returns trigger as $$
declare
  v_old_frozen timestamptz;
  v_new_frozen timestamptz;
  v_diff jsonb := '{}'::jsonb;
begin
  new.updated_by := auth.uid();
  new.updated_at := now();

  if new.entry_kind in ('daily', 'holiday', 'unpaid') then
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

  if v_old_frozen is not null or v_new_frozen is not null then
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
    if new.entered_week_start is distinct from old.entered_week_start then
      v_diff := v_diff || jsonb_build_object('entered_week_start', jsonb_build_object('old', old.entered_week_start, 'new', new.entered_week_start));
    end if;

    insert into public.timesheet_audit_log (org_id, entry_id, profile_id, week_start, action, field_changes, actor_profile_id)
    values (new.org_id, new.id, new.profile_id, new.entered_week_start, 'update', v_diff, auth.uid());
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Unpaid rows get the same protection as holiday rows: only the office
-- can change or remove them; nobody inserts them directly (the insert
-- policy already only allows 'daily'/'adjustment').
drop policy if exists timesheet_entries_update on public.timesheet_entries;
create policy timesheet_entries_update on public.timesheet_entries
  for update
  using (
    org_id = public.current_org_id()
    and (
      (entry_kind in ('daily', 'adjustment') and (profile_id = auth.uid() or public.has_permission('can_manage_timesheets')))
      or (entry_kind in ('holiday', 'unpaid') and public.has_permission('can_manage_timesheets'))
    )
  )
  with check (
    org_id = public.current_org_id()
    and (
      (entry_kind in ('daily', 'adjustment') and (profile_id = auth.uid() or public.has_permission('can_manage_timesheets')))
      or (entry_kind in ('holiday', 'unpaid') and public.has_permission('can_manage_timesheets'))
    )
  );

drop policy if exists timesheet_entries_delete on public.timesheet_entries;
create policy timesheet_entries_delete on public.timesheet_entries
  for delete using (
    org_id = public.current_org_id()
    and (
      (entry_kind in ('daily', 'adjustment') and (profile_id = auth.uid() or public.has_permission('can_manage_timesheets')))
      or (entry_kind in ('holiday', 'unpaid') and public.has_permission('can_manage_timesheets'))
    )
  );

-- 3. Request RPCs: allowance check on paid days only ---------------------

create or replace function public.submit_holiday_request(p_profile_id uuid, p_days jsonb)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_request_id uuid;
  v_total numeric;
  v_paid numeric;
  v_entitlement numeric;
  v_taken numeric;
begin
  if not (p_profile_id = auth.uid() or public.has_permission('can_manage_timesheets')) then
    raise exception 'You cannot submit a holiday request for someone else';
  end if;

  select org_id into v_org_id from public.profiles where id = p_profile_id;

  select coalesce(sum((d->>'hours')::numeric), 0),
         coalesce(sum((d->>'hours')::numeric) filter (where not coalesce((d->>'is_unpaid')::boolean, false)), 0)
  into v_total, v_paid
  from jsonb_array_elements(p_days) d;

  if v_total <= 0 then
    raise exception 'Select at least one day';
  end if;

  if v_paid > 0 then
    v_entitlement := public.holiday_entitlement_hours(p_profile_id);
    v_taken := public.holiday_taken_hours(p_profile_id);
    if v_taken + v_paid > v_entitlement then
      raise exception 'This would exceed the annual holiday allowance';
    end if;
  end if;

  insert into public.holiday_requests (org_id, profile_id, created_by)
  values (v_org_id, p_profile_id, auth.uid())
  returning id into v_request_id;

  insert into public.holiday_request_days (request_id, work_date, requested_hours, note, is_unpaid)
  select v_request_id, (d->>'work_date')::date, (d->>'hours')::numeric, d->>'note',
         coalesce((d->>'is_unpaid')::boolean, false)
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
  v_paid numeric;
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

  select coalesce(sum(requested_hours) filter (where not is_unpaid), 0) into v_paid
  from public.holiday_request_days where request_id = p_request_id;

  if v_paid > 0 then
    v_entitlement := public.holiday_entitlement_hours(v_request.profile_id);
    v_taken := public.holiday_taken_hours(v_request.profile_id);
    if v_taken + v_paid > v_entitlement then
      raise exception 'Approving this would exceed the annual holiday allowance';
    end if;
  end if;

  for v_day in select * from public.holiday_request_days where request_id = p_request_id loop
    insert into public.timesheet_entries (profile_id, entry_kind, work_date, holiday_hours, holiday_source, holiday_request_id)
    values (v_request.profile_id, case when v_day.is_unpaid then 'unpaid' else 'holiday' end,
            v_day.work_date, v_day.requested_hours, 'request', p_request_id);
  end loop;

  update public.holiday_requests
  set status = 'approved', decided_by = auth.uid(), decided_at = now()
  where id = p_request_id;
end;
$$;

-- 4. Team calendar shows unpaid days off too (same signature; hours is
-- the hours off, which for an unpaid row is holiday_hours, not the 0
-- paid daily_total).
create or replace function public.team_holiday_calendar(p_month_start date, p_month_end date)
returns table(profile_id uuid, display_name text, work_date date, hours numeric)
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
begin
  if not (public.has_permission('can_submit_timesheet')
          or public.has_permission('can_approve_holiday')
          or public.has_permission('can_manage_timesheets')) then
    raise exception 'You do not have access to the team holiday calendar';
  end if;

  return query
  select te.profile_id, p.display_name, te.work_date, te.holiday_hours
  from public.timesheet_entries te
  join public.profiles p on p.id = te.profile_id
  where te.org_id = public.current_org_id()
    and te.entry_kind in ('holiday', 'unpaid')
    and te.work_date between p_month_start and p_month_end
  order by te.work_date;
end;
$$;

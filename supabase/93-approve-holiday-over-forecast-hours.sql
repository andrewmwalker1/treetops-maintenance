-- Tree Tops Maintenance Platform -- approving holiday on a day that
-- already has hours on the timesheet (found 19 Nov 2026 testing unpaid
-- leave). Run after 92-unpaid-leave-and-day-length.sql. Idempotent
-- (CREATE OR REPLACE), safe to re-run.
--
-- timesheet_entries_one_daily_per_day allows one worked/holiday/unpaid
-- row per person per day, so approve_holiday_request() failed with a raw
-- "duplicate key" error whenever a booked day already had a 'daily' row --
-- most often forecast hours copy-forward put on the rest of the current
-- week (book Friday off on a Tuesday -> approval breaks).
--
-- Now, per booked day with an existing worked row:
--   - today or later: those hours are a forecast, not worked yet -- the
--     row is removed and replaced by the holiday/unpaid row (the delete
--     trigger audit-logs it if the week is frozen);
--   - before today: real worked hours -- approval stops with a plain
--     message rather than silently deleting them.
-- Otherwise identical to 92's version.
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
  v_name text;
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

  -- Past days with worked hours block the whole approval, before anything
  -- is changed.
  select d.work_date into v_day
  from public.holiday_request_days d
  join public.timesheet_entries te
    on te.profile_id = v_request.profile_id and te.work_date = d.work_date and te.entry_kind = 'daily'
  where d.request_id = p_request_id and d.work_date < current_date
  order by d.work_date
  limit 1;
  if found then
    select display_name into v_name from public.profiles where id = v_request.profile_id;
    raise exception '% already has worked hours on % -- clear them on the timesheet first, then approve',
      coalesce(v_name, 'This person'), to_char(v_day.work_date, 'Dy DD Mon');
  end if;

  -- Forecast hours on today-or-later days give way to the booking.
  delete from public.timesheet_entries te
  using public.holiday_request_days d
  where d.request_id = p_request_id
    and te.profile_id = v_request.profile_id
    and te.work_date = d.work_date
    and te.entry_kind = 'daily'
    and d.work_date >= current_date;

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

-- Tree Tops Maintenance Platform -- Fix holiday_taken_hours excluding
-- future-dated approved holiday (found via code review 2026-09-14).
-- Run after 70-holiday-accrual-and-booking.sql. Idempotent (CREATE OR
-- REPLACE), safe to re-run.
--
-- holiday_taken_hours() capped its date range at
-- least(p_as_of, yb.ends_on) -- the same cap holiday_accrued_hours()
-- correctly uses, since you can't accrue for days not yet worked. But
-- applied to *taken* hours, that cap wrongly excluded already-approved
-- holiday whose work_date is later than today, letting
-- submit_holiday_request/approve_holiday_request's
-- "v_taken + v_total > v_entitlement" check under-count real commitments
-- and approve requests that push someone over their entitlement.
-- Taken hours should count everything already booked within the holiday
-- year, past or future -- only the range's start/end matters, not today.
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
    and te.work_date between yb.starts_on and yb.ends_on;

  return coalesce(v_result, 0);
end;
$$;

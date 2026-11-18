-- Tree Tops Maintenance Platform -- fix holiday_accrued_hours() always
-- erroring (found 18 Nov 2026 walking through the holiday flow as a user).
-- Run after 89-revoke-bank-holiday-helpers.sql. Idempotent (CREATE OR
-- REPLACE), safe to re-run.
--
-- 70-holiday-accrual-and-booking.sql multiplied sum(te.daily_total) by
-- holiday_accrual_ratio(p.org_id) -- p.org_id outside the aggregate with no
-- GROUP BY, which Postgres rejects ("column p.org_id must appear in the
-- GROUP BY clause"). holiday_status() calls it, so the "My Holiday"
-- allowance panel errored for everyone. Same maths; the org id now comes
-- from a scalar lookup instead of the aggregated join.
create or replace function public.holiday_accrued_hours(p_profile_id uuid, p_as_of date default current_date)
returns numeric
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
  v_result numeric;
begin
  if not public.can_view_holiday_status(p_profile_id) then
    raise exception 'You are not authorised to view this person''s holiday accrual';
  end if;

  select org_id into v_org_id from public.profiles where id = p_profile_id;

  select coalesce(sum(te.daily_total), 0) * public.holiday_accrual_ratio(v_org_id)
  into v_result
  from public.timesheet_entries te
  cross join lateral public.holiday_year_bounds(v_org_id, p_as_of) yb
  where te.profile_id = p_profile_id
    and te.entry_kind = 'daily'
    and te.work_date between yb.starts_on and least(p_as_of, yb.ends_on);

  return coalesce(v_result, 0);
end;
$$;

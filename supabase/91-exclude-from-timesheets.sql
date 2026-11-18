-- Tree Tops Maintenance Platform -- "Exclude from timesheets" per person,
-- and the team holiday calendar opened up to approvers/the office
-- (18 Nov 2026). Run after 90-fix-holiday-accrued-hours-group-by.sql.
-- Idempotent (ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE), safe to re-run.
--
-- 1. staff_time_profiles.exclude_from_timesheets: someone whose role has
--    can_submit_timesheet but who shouldn't be on the payroll grid (Andy
--    asked for it after walking through the flow). Set from Admin -> Work
--    patterns. The app hides them from the Office Hub grid and fixed-hours
--    list, and hides their own Timesheet page; holiday is unaffected.
--    Existing rows default to false, so nothing changes until it's ticked.
--    No new grant needed -- it's a column on an already-granted table, and
--    the existing staff_time_profiles RLS policies cover it.
alter table public.staff_time_profiles
  add column if not exists exclude_from_timesheets boolean not null default false;

-- 2. team_holiday_calendar() only allowed can_submit_timesheet, so the
--    people who approve holiday (and the office, via can_manage_timesheets)
--    couldn't see who else is off. Same body otherwise.
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
  select te.profile_id, p.display_name, te.work_date, te.daily_total
  from public.timesheet_entries te
  join public.profiles p on p.id = te.profile_id
  where te.org_id = public.current_org_id()
    and te.entry_kind = 'holiday'
    and te.work_date between p_month_start and p_month_end
  order by te.work_date;
end;
$$;

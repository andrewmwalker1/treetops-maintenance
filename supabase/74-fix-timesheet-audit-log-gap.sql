-- Tree Tops Maintenance Platform -- Fix timesheet_entries_before_update
-- skipping the audit log when an edit moves an entry INTO a frozen week
-- (found via code review 2026-09-14). Run after 69-staff-timesheets.sql.
-- Idempotent (CREATE OR REPLACE), safe to re-run.
--
-- The permission check already correctly blocks the edit unless the
-- actor has can_manage_timesheets, testing both v_old_frozen and
-- v_new_frozen. But the audit-log insert below it was gated only on
-- v_old_frozen is not null -- so a can_manage_timesheets holder editing
-- entered_week_start to move an entry into a currently-frozen week (from
-- a week that wasn't frozen) was permitted but never logged.
-- TimesheetOverrides.jsx, which exists specifically to show changes made
-- after a week was frozen, missed that class of edit entirely.
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

-- Tree Tops Maintenance Platform -- gate due date/priority/status/location
-- editing on a job behind a permission.
-- Run after 26-equipment-type-documents.sql.
--
-- Due date, priority, status, and location were previously editable by
-- anyone who could see the job at all (jobs_update only checks
-- can_see_job) -- no permission gated them the way can_reallocate_jobs
-- gates reassignment. This adds can_edit_job_details as the single
-- permission covering all four, same shape as
-- enforce_job_reallocation_permission in 02-rls-policies.sql.
--
-- Completing (or cancelling) a job is deliberately exempted: it's a
-- status_id change too, but Andy confirmed the assignee marking their own
-- job done/cancelled shouldn't need this permission -- only jumping status
-- around otherwise (e.g. Open <-> In Progress) requires it. Reopening a
-- completed/cancelled job already has its own dedicated permission
-- (can_reopen_completed_jobs, 15-job-completion-and-role-management.sql)
-- and stays exempted here too, so that transition isn't double-gated.

insert into public.permissions (key, description) values
  ('can_edit_job_details', 'Can change a job''s due date, priority, location, or status (other than completing/cancelling it, or reopening, which have their own permissions)')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, 'can_edit_job_details', true
from public.roles r
where r.name = 'Admin'
  and r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
on conflict do nothing;

create or replace function public.enforce_job_details_edit_permission()
returns trigger as $$
declare
  v_old_completed boolean;
  v_new_completed boolean;
  v_status_needs_permission boolean := false;
begin
  if new.status_id is distinct from old.status_id then
    select is_completed into v_old_completed from public.job_statuses where id = old.status_id;
    select is_completed into v_new_completed from public.job_statuses where id = new.status_id;
    -- Closing (not completed -> completed) and reopening (completed -> not
    -- completed) are each their own exemption; anything else (e.g. Open ->
    -- In Progress) needs the permission.
    if not ((not v_old_completed and v_new_completed) or (v_old_completed and not v_new_completed)) then
      v_status_needs_permission := true;
    end if;
  end if;

  if (
       new.due_date is distinct from old.due_date
       or new.priority is distinct from old.priority
       or new.pitch_id is distinct from old.pitch_id
       or new.area_id is distinct from old.area_id
       or v_status_needs_permission
     )
     and not public.has_permission('can_edit_job_details') then
    raise exception 'Editing a job''s due date, priority, location, or status requires the can_edit_job_details permission';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists jobs_enforce_details_edit on public.jobs;
create trigger jobs_enforce_details_edit
  before update on public.jobs
  for each row execute function public.enforce_job_details_edit_permission();

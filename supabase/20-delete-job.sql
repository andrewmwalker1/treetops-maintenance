-- Tree Tops Maintenance Platform -- admin "delete job" capability
-- Run after 19-job-completion-photo-requirement.sql.
--
-- No delete policy exists on public.jobs at all today (RLS defaults to
-- deny with no matching policy). A plain jobs_delete RLS policy isn't
-- enough on its own though: job_activity (01-schema.sql) has a hard
-- "never deleted" trigger, forbid_job_activity_delete, that unconditionally
-- raises -- and that trigger still fires for the ON DELETE CASCADE this
-- needs against job_subtasks/job_photos/job_activity/job_activity_types
-- when a job is removed (cascade-triggered deletes are internal FK
-- actions that bypass RLS, but they do NOT bypass a table's own row
-- triggers). So this adds a single security definer RPC instead (same
-- pattern as has_permission/current_org_id): it does its own visibility +
-- permission check, sets a transaction-local flag the trigger honours
-- just for this one cascade, then deletes the job. No jobs_delete RLS
-- policy is added on purpose -- a raw client-side .from('jobs').delete()
-- stays blocked by RLS's default-deny, so only this RPC can ever delete a
-- job (defense in depth: the permission check lives in exactly one place).

insert into public.permissions (key, description) values
  ('can_delete_jobs', 'Can permanently delete a job')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, 'can_delete_jobs', true
from public.roles r
where r.name = 'Admin'
  and r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
on conflict do nothing;

create or replace function public.forbid_job_activity_delete()
returns trigger as $$
begin
  if coalesce(current_setting('app.allow_job_activity_delete', true), '') <> 'true' then
    raise exception 'job_activity rows cannot be deleted';
  end if;
  return old;
end;
$$ language plpgsql;

create or replace function public.delete_job(p_job_id uuid)
returns void as $$
begin
  if not public.can_see_job(p_job_id) then
    raise exception 'Job not found';
  end if;
  if not public.has_permission('can_delete_jobs') then
    raise exception 'Deleting a job requires the can_delete_jobs permission';
  end if;
  perform set_config('app.allow_job_activity_delete', 'true', true);
  delete from public.jobs where id = p_job_id;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

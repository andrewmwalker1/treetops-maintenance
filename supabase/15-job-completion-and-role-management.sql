-- Tree Tops Maintenance Platform — job completion flow + role management
-- Run after 14-equipment-extra-fields.sql.
--
-- Three things:
-- 1. jobs.completed_date — separate from created_at/closed_by, so
--    completing a job can log the date the work actually happened
--    (may be backdated), not just "now".
-- 2. can_reopen_completed_jobs permission + a server-side trigger:
--    changing a job's status from a completed/cancelled status back to
--    an open one requires this permission, enforced here (not just
--    hidden client-side), same pattern as
--    enforce_job_reallocation_permission in 02-rls-policies.sql.
-- 3. Role management: roles were previously seed-only (select policy
--    only, no insert/update/delete policy existed at all). Adds CRUD
--    policies gated by can_manage_roles_and_permissions (already exists
--    from 08-*.sql), plus a delete-guard trigger — profiles.role_id is
--    ON DELETE SET NULL, which would silently orphan users rather than
--    blocking the delete, so this is enforced explicitly instead.

alter table public.jobs add column if not exists completed_date date;

insert into public.permissions (key, description) values
  ('can_reopen_completed_jobs', 'Can change a job''s status away from Completed/Cancelled back to an open status')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, 'can_reopen_completed_jobs', true
from public.roles r
where r.name = 'Admin'
  and r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
on conflict do nothing;

create or replace function public.enforce_job_reopen_permission()
returns trigger as $$
declare
  v_old_completed boolean;
  v_new_completed boolean;
begin
  select is_completed into v_old_completed from public.job_statuses where id = old.status_id;
  select is_completed into v_new_completed from public.job_statuses where id = new.status_id;

  if v_old_completed and not v_new_completed and not public.has_permission('can_reopen_completed_jobs') then
    raise exception 'Reopening a completed or cancelled job requires the can_reopen_completed_jobs permission';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists jobs_enforce_reopen on public.jobs;
create trigger jobs_enforce_reopen
  before update on public.jobs
  for each row
  when (old.status_id is distinct from new.status_id)
  execute function public.enforce_job_reopen_permission();

-- Roles: CRUD policies (select-only previously).

drop policy if exists roles_insert on public.roles;
create policy roles_insert on public.roles
  for insert with check (
    org_id = public.current_org_id() and public.has_permission('can_manage_roles_and_permissions')
  );

drop policy if exists roles_update on public.roles;
create policy roles_update on public.roles
  for update using (
    org_id = public.current_org_id() and public.has_permission('can_manage_roles_and_permissions')
  )
  with check (
    org_id = public.current_org_id() and public.has_permission('can_manage_roles_and_permissions')
  );

drop policy if exists roles_delete on public.roles;
create policy roles_delete on public.roles
  for delete using (
    org_id = public.current_org_id() and public.has_permission('can_manage_roles_and_permissions')
  );

create or replace function public.forbid_role_delete_if_in_use()
returns trigger as $$
begin
  if exists (select 1 from public.profiles where role_id = old.id) then
    raise exception 'Cannot delete a role that is still assigned to one or more users';
  end if;
  return old;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists roles_forbid_delete_if_in_use on public.roles;
create trigger roles_forbid_delete_if_in_use
  before delete on public.roles
  for each row execute function public.forbid_role_delete_if_in_use();

-- Re-affirm the hard-coded roles exist (idempotent — 03-seed-treetops.sql
-- already does this; repeated here so this file alone is a safe restore
-- point now that roles can be deleted through the app).
do $$
declare
  v_org_id uuid;
begin
  select id into v_org_id from public.organisations where name = 'Tree Tops Caravan Park Ltd';

  insert into public.roles (org_id, name)
  select v_org_id, r.name
  from (values ('Admin'), ('Head Gardener'), ('Gardener'), ('Maintenance'), ('Office')) as r(name)
  on conflict (org_id, name) do nothing;
end $$;

-- Safety net: whatever else this migration changes, Andy's own profile
-- must end up as Admin so access to the system is never lost.
update public.profiles
set role_id = (
  select r.id from public.roles r
  where r.org_id = public.profiles.org_id and r.name = 'Admin'
)
where id = (select id from auth.users where email = 'andy@treetopscaravanpark.co.uk');

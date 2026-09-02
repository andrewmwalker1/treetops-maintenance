-- Tree Tops Maintenance Platform -- a dedicated "Contractor" role
-- Run after 56-contractor-employee-job-visibility.sql.
--
-- App.jsx has anticipated this since 35-desktop-access-permission.sql
-- ("a future Contractor role"), but nothing ever created one -- an
-- is_contractor profile today has to be given some existing staff role
-- (Gardener, Maintenance, etc.), which grants it that role's group
-- membership and permissions too. This is the role Andy assigns a
-- contractor's own staff (e.g. Kev/Ben Parry): access to the desktop app
-- and the key system, nothing else. It deliberately holds neither
-- can_see_contractor_jobs (that's for Tree Tops staff who need to see
-- every contractor's work, e.g. Park Manager/Head Gardener -- granted
-- via the Roles & Permissions screen, not seeded here) nor any
-- can_manage_* permission -- a contractor's own job visibility comes
-- from profiles.contractor_id matching a job's assignee_contractor_id
-- (see can_see_job, 56-contractor-employee-job-visibility.sql), not from
-- this role's permissions.
do $$
declare
  v_org_id uuid;
  v_role_id uuid;
begin
  select id into v_org_id from public.organisations where name = 'Tree Tops Caravan Park Ltd';

  insert into public.roles (org_id, name)
  values (v_org_id, 'Contractor')
  on conflict (org_id, name) do nothing;

  select id into v_role_id from public.roles where org_id = v_org_id and name = 'Contractor';

  insert into public.role_permissions (role_id, permission_key, enabled)
  select v_role_id, p.key, true
  from (values ('can_access_desktop'), ('can_use_key_system')) as p(key)
  on conflict do nothing;

  -- A role with no role_visibility row can't see anything via the
  -- role-based can_see_job branch -- fine here, since a contractor's job
  -- visibility comes entirely from contractor_id matching, not role
  -- visibility. Explicitly not inserting a role_visibility row so this
  -- stays true rather than accidentally inheriting a default elsewhere.
end $$;

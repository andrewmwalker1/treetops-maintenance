-- Tree Tops Maintenance Platform — Roles & Permissions admin screen
-- Run after 07-storage-safety-docs.sql.
--
-- Adds a dedicated permission for managing role_permissions itself,
-- kept separate from can_manage_reference_data so granting someone
-- "manage job templates/RA library" doesn't also let them hand out
-- permissions (including admin-level ones) to other roles.
--
-- Also grants can_edit_job_checklist and can_manage_reference_data to
-- Head Gardener and Office (Andy: supervisory/coordination roles),
-- alongside Admin which already has both from 06-*.sql.

insert into public.permissions (key, description) values
  ('can_manage_roles_and_permissions', 'Can grant or revoke permissions for roles')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, 'can_manage_roles_and_permissions', true
from public.roles r
where r.name = 'Admin'
  and r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, p.key, true
from public.roles r
cross join public.permissions p
where r.name in ('Head Gardener', 'Office')
  and r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
  and p.key in ('can_edit_job_checklist', 'can_manage_reference_data')
on conflict do nothing;

drop policy if exists role_permissions_insert on public.role_permissions;
create policy role_permissions_insert on public.role_permissions
  for insert with check (
    exists (select 1 from public.roles r where r.id = role_permissions.role_id and r.org_id = public.current_org_id())
    and public.has_permission('can_manage_roles_and_permissions')
  );

drop policy if exists role_permissions_update on public.role_permissions;
create policy role_permissions_update on public.role_permissions
  for update using (
    exists (select 1 from public.roles r where r.id = role_permissions.role_id and r.org_id = public.current_org_id())
    and public.has_permission('can_manage_roles_and_permissions')
  )
  with check (
    exists (select 1 from public.roles r where r.id = role_permissions.role_id and r.org_id = public.current_org_id())
    and public.has_permission('can_manage_roles_and_permissions')
  );

drop policy if exists role_permissions_delete on public.role_permissions;
create policy role_permissions_delete on public.role_permissions
  for delete using (
    exists (select 1 from public.roles r where r.id = role_permissions.role_id and r.org_id = public.current_org_id())
    and public.has_permission('can_manage_roles_and_permissions')
  );

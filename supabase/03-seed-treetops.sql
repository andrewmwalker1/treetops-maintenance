-- Tree Tops Maintenance Platform — Tree Tops seed data (Section 9)
-- Run after 01-schema.sql and 02-rls-policies.sql.
-- Covers organisation/site/roles/groups/statuses/terminology/role_visibility
-- only — user accounts are NOT created here because inviteUserByEmail is
-- an Auth Admin API call, not plain SQL. See scripts/seed-users.mjs for
-- that step, and its header comment for the placeholder emails that still
-- need replacing (Section 9 / Section 11 open item).
--
-- Idempotent: every insert is keyed so re-running this is safe.

do $$
declare
  v_org_id uuid;
  v_site_id uuid;
  v_admin_role_id uuid;
  v_head_gardener_role_id uuid;
  v_gardener_role_id uuid;
  v_maintenance_role_id uuid;
  v_office_role_id uuid;
begin
  -- Organisation
  insert into public.organisations (name)
  values ('Tree Tops Caravan Park Ltd')
  on conflict do nothing;

  select id into v_org_id from public.organisations where name = 'Tree Tops Caravan Park Ltd';

  -- Site
  insert into public.sites (org_id, name, site_type)
  select v_org_id, 'Tree Tops', 'caravan_park'
  where not exists (select 1 from public.sites where org_id = v_org_id and name = 'Tree Tops');

  select id into v_site_id from public.sites where org_id = v_org_id and name = 'Tree Tops';

  -- Roles
  insert into public.roles (org_id, name)
  select v_org_id, r.name
  from (values ('Admin'), ('Head Gardener'), ('Gardener'), ('Maintenance'), ('Office')) as r(name)
  on conflict (org_id, name) do nothing;

  select id into v_admin_role_id from public.roles where org_id = v_org_id and name = 'Admin';
  select id into v_head_gardener_role_id from public.roles where org_id = v_org_id and name = 'Head Gardener';
  select id into v_gardener_role_id from public.roles where org_id = v_org_id and name = 'Gardener';
  select id into v_maintenance_role_id from public.roles where org_id = v_org_id and name = 'Maintenance';
  select id into v_office_role_id from public.roles where org_id = v_org_id and name = 'Office';

  -- Groups
  insert into public.groups (org_id, name)
  select v_org_id, g.name
  from (values ('Gardeners'), ('Maintenance'), ('Office')) as g(name)
  on conflict (org_id, name) do nothing;

  -- Job statuses
  insert into public.job_statuses (org_id, name, is_completed, sort_order)
  select v_org_id, s.name, s.is_completed, s.sort_order
  from (values
    ('Open', false, 1),
    ('In Progress', false, 2),
    ('Completed', true, 3),
    ('Cancelled', true, 4)
  ) as s(name, is_completed, sort_order)
  where not exists (
    select 1 from public.job_statuses where org_id = v_org_id and name = s.name
  );

  -- role_visibility: Admin sees every role (including its own); Head
  -- Gardener sees Gardener + Maintenance (not Office); every role sees
  -- its own role's jobs by default. This "own role" reading of Section 9
  -- is an assumption pending Andy's confirmation (Section 11 open item)
  -- — adjust here once confirmed.
  insert into public.role_visibility (role_id, visible_role_id)
  select v_admin_role_id, r.id from public.roles r where r.org_id = v_org_id
  on conflict do nothing;

  insert into public.role_visibility (role_id, visible_role_id) values
    (v_head_gardener_role_id, v_head_gardener_role_id),
    (v_head_gardener_role_id, v_gardener_role_id),
    (v_head_gardener_role_id, v_maintenance_role_id),
    (v_gardener_role_id, v_gardener_role_id),
    (v_maintenance_role_id, v_maintenance_role_id),
    (v_office_role_id, v_office_role_id)
  on conflict do nothing;

  -- role_permissions: Admin gets every fixed permission key. Nothing else
  -- is seeded here — grant can_reallocate_jobs / can_export_jobs /
  -- can_manage_equipment_status to other roles once Andy confirms which
  -- roles need them.
  insert into public.role_permissions (role_id, permission_key, enabled)
  select v_admin_role_id, p.key, true from public.permissions p
  on conflict do nothing;
end $$;

-- Terminology defaults (Section 6). site.terminology_overrides can add
-- per-site overrides on top of these later without a schema change.
insert into public.terminology_templates (site_type, key, default_label) values
  ('caravan_park', 'park', 'Park'),
  ('caravan_park', 'pitch', 'Pitch'),
  ('caravan_park', 'area', 'Area')
on conflict (site_type, key) do nothing;

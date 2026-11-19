-- Tree Tops Maintenance Platform -- grant Nic and Jayne access to the
-- Caravan Sale Tracker (Office Hub -> Sales).
--
-- Permissions here are role-based only (public.has_permission() checks
-- role_permissions by role_id -- see 02-rls-policies.sql) -- there's no
-- per-profile override table in this schema. So this grants
-- can_use_caravan_sales to whichever role(s) Nic's and Jayne's profiles
-- currently have, rather than to the two of them individually. If they
-- already share one role (e.g. "Office"), this has the same effect as
-- ticking the box for that role in Roles & Permissions; if they're on
-- different roles, both get it.
--
-- Before trusting the grant below, run this first and check it lists
-- exactly the two intended people and no one else -- broaden/narrow
-- the ilike patterns if it doesn't:
--   select id, display_name, role_id from public.profiles
--   where display_name ilike '%Nic%' or display_name ilike '%Jayne%';
--
-- Run after 96-caravan-sale-tracker-simplify-tests.sql.
-- Idempotent, safe to re-run.

insert into public.role_permissions (role_id, permission_key, enabled)
select distinct p.role_id, 'can_use_caravan_sales', true
from public.profiles p
where (p.display_name ilike '%Nic%' or p.display_name ilike '%Jayne%')
  and p.role_id is not null
on conflict do nothing;

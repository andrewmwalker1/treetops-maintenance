-- Tree Tops Maintenance Platform -- user admin (invite / edit / deactivate)
-- Run after 09-job-type-activities.sql.
--
-- Andy: only people he invites can join, and he needs to edit an
-- existing user's role/name/contractor flag/site scope and deactivate
-- them when they leave. Inviting and deactivating both need the Auth
-- Admin API (service role only) -- see supabase/functions/manage-users
-- -- but editing role/site scope is a normal authenticated write, so
-- it gets its own RLS policies here rather than going through the
-- Edge Function.

alter table public.profiles add column if not exists is_active boolean not null default true;

insert into public.permissions (key, description) values
  ('can_manage_users', 'Can invite, edit, and deactivate user accounts')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, 'can_manage_users', true
from public.roles r
where r.name = 'Admin'
  and r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
on conflict do nothing;

-- Additional to profiles_update_self (02-rls-policies.sql) -- that
-- policy only lets a user edit their own row; this lets a
-- can_manage_users holder edit anyone in their org. Both are
-- permissive policies for the same command, so Postgres ORs them.
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (org_id = public.current_org_id() and public.has_permission('can_manage_users'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_users'));

drop policy if exists site_scope_insert on public.site_scope;
create policy site_scope_insert on public.site_scope
  for insert with check (
    exists (select 1 from public.profiles p where p.id = site_scope.profile_id and p.org_id = public.current_org_id())
    and public.has_permission('can_manage_users')
  );

drop policy if exists site_scope_update on public.site_scope;
create policy site_scope_update on public.site_scope
  for update using (
    exists (select 1 from public.profiles p where p.id = site_scope.profile_id and p.org_id = public.current_org_id())
    and public.has_permission('can_manage_users')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = site_scope.profile_id and p.org_id = public.current_org_id())
    and public.has_permission('can_manage_users')
  );

drop policy if exists site_scope_delete on public.site_scope;
create policy site_scope_delete on public.site_scope
  for delete using (
    exists (select 1 from public.profiles p where p.id = site_scope.profile_id and p.org_id = public.current_org_id())
    and public.has_permission('can_manage_users')
  );

-- profiles has no email column (Section 3 of BUILD-BRIEF.md never
-- gave it one -- email lives on auth.users, which RLS can't reach
-- directly). security definer so it can read auth.users, but it only
-- ever returns rows for the caller's own org, and only to a caller who
-- actually holds can_manage_users -- both checked inside the function
-- body, not left to the caller.
create or replace function public.list_org_users()
returns table (
  id uuid,
  display_name text,
  is_contractor boolean,
  is_active boolean,
  role_id uuid,
  role_name text,
  email text,
  site_ids uuid[]
)
language sql security definer stable
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.display_name,
    p.is_contractor,
    p.is_active,
    p.role_id,
    r.name as role_name,
    u.email,
    coalesce(array_agg(ss.site_id) filter (where ss.site_id is not null), '{}') as site_ids
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.roles r on r.id = p.role_id
  left join public.site_scope ss on ss.profile_id = p.id
  where p.org_id = public.current_org_id()
    and public.has_permission('can_manage_users')
  group by p.id, p.display_name, p.is_contractor, p.is_active, p.role_id, r.name, u.email;
$$;

grant execute on function public.list_org_users() to authenticated;

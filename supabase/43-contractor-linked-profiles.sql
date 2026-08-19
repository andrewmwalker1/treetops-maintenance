-- Tree Tops Maintenance Platform -- link a contractor's own staff to their company
-- Run after 42-key-tags-lost-status-and-reasons.sql.
--
-- Andy: Kevin Parry has himself and his son Ben, both trusted (each with
-- their own profile + RFID fob per 37-key-checkouts-and-contractor-
-- reasons.sql's "Part 3"). Until now a trusted contractor's own key-
-- station login had no link back to their contractors row at all -- when
-- Kevin checked a key out for himself the checkout landed as
-- issued_to_kind 'self', not 'contractor', so it was invisible to
-- anything counting "keys out to Kevin Parry" and had no way to also
-- count Ben's. profiles.contractor_id is that link: set on any trusted
-- contractor's own profile, pointing at the contractors row their company
-- lives under. Two people can share one contractor_id -- that's the
-- whole point.
alter table public.profiles add column if not exists contractor_id uuid references public.contractors(id) on delete set null;
create index if not exists profiles_contractor_idx on public.profiles (contractor_id);

do $$ begin
  alter table public.profiles
    add constraint profiles_contractor_id_requires_flag check (contractor_id is null or is_contractor);
exception when duplicate_object then null; end $$;

-- list_org_users (10-user-admin.sql) is what UsersTab.jsx reads/writes
-- through -- extended to carry contractor_id so the admin edit form can
-- show and change which contractor a trusted profile belongs to. Adding
-- an OUT column changes the function's return type, which Postgres
-- won't let create-or-replace do in place -- has to be dropped first.
drop function if exists public.list_org_users();

create function public.list_org_users()
returns table (
  id uuid,
  display_name text,
  is_contractor boolean,
  contractor_id uuid,
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
    p.contractor_id,
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
  group by p.id, p.display_name, p.is_contractor, p.contractor_id, p.is_active, p.role_id, r.name, u.email;
$$;

grant execute on function public.list_org_users() to authenticated;

-- No RLS changes needed: profiles_update_admin (10-user-admin.sql,
-- tightened in 34-key-station-login-context.sql) already covers writing
-- any column on a profile row for a can_manage_users holder outside a
-- kiosk/key-station session -- contractor_id is just one more column
-- under that same gate.

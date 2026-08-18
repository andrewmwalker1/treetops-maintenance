-- Tree Tops Maintenance Platform -- kiosk session scoping
-- Run after 33-checklist-photo-blocks-completion.sql.
--
-- Andy found that scanning an RFID fob at the workshop kiosk produces a
-- session that's byte-identical to a normal email-magic-link login --
-- src/App.jsx's ONLY signal for "render the kiosk, not the full desktop
-- app" was location.pathname.startsWith("/kiosk"), a client-side check
-- trivially defeated by editing the URL once signed in. We're about to add
-- a second unattended shared terminal (a key-cupboard PC) using the same
-- rfid-login mechanism, so this closes the hole now rather than building a
-- second copy of it.
--
-- supabase/functions/rfid-login now stamps app_metadata.login_context on
-- the profile BEFORE minting the magic link, so it's present in the JWT of
-- every session that login produces (and every refresh after, since
-- GoTrue re-reads app_metadata from auth.users on each token refresh).
-- app_metadata can only be written server-side via the Admin API -- the
-- client can read it (session.user.app_metadata) but never set or edit it
-- -- so src/App.jsx now keys its kiosk/full-app branch off this claim
-- instead of the pathname (see App.jsx). This function exposes the same
-- claim inside RLS/trigger context as belt-and-braces: even a captured or
-- replayed kiosk JWT used directly against the Supabase REST API (bypassing
-- the React app's routing entirely) still can't write to the handful of
-- most sensitive admin tables below.

create or replace function public.session_login_context()
returns text
language sql security definer stable
set search_path = public, pg_temp
as $$
  select auth.jwt() -> 'app_metadata' ->> 'login_context';
$$;

-- role_permissions: granting/revoking permissions to roles (08-roles-and-permissions-admin.sql)
drop policy if exists role_permissions_insert on public.role_permissions;
create policy role_permissions_insert on public.role_permissions
  for insert with check (
    exists (select 1 from public.roles r where r.id = role_permissions.role_id and r.org_id = public.current_org_id())
    and public.has_permission('can_manage_roles_and_permissions')
    and public.session_login_context() is null
  );

drop policy if exists role_permissions_update on public.role_permissions;
create policy role_permissions_update on public.role_permissions
  for update using (
    exists (select 1 from public.roles r where r.id = role_permissions.role_id and r.org_id = public.current_org_id())
    and public.has_permission('can_manage_roles_and_permissions')
    and public.session_login_context() is null
  )
  with check (
    exists (select 1 from public.roles r where r.id = role_permissions.role_id and r.org_id = public.current_org_id())
    and public.has_permission('can_manage_roles_and_permissions')
    and public.session_login_context() is null
  );

drop policy if exists role_permissions_delete on public.role_permissions;
create policy role_permissions_delete on public.role_permissions
  for delete using (
    exists (select 1 from public.roles r where r.id = role_permissions.role_id and r.org_id = public.current_org_id())
    and public.has_permission('can_manage_roles_and_permissions')
    and public.session_login_context() is null
  );

-- rfid_tags: assigning how someone signs in (16-rfid-kiosk-and-equipment-checkout.sql)
drop policy if exists rfid_tags_insert on public.rfid_tags;
create policy rfid_tags_insert on public.rfid_tags
  for insert with check (
    exists (select 1 from public.profiles p where p.id = rfid_tags.profile_id and p.org_id = public.current_org_id())
    and public.has_permission('can_manage_users')
    and public.session_login_context() is null
  );

drop policy if exists rfid_tags_update on public.rfid_tags;
create policy rfid_tags_update on public.rfid_tags
  for update using (
    exists (select 1 from public.profiles p where p.id = rfid_tags.profile_id and p.org_id = public.current_org_id())
    and public.has_permission('can_manage_users')
    and public.session_login_context() is null
  )
  with check (
    exists (select 1 from public.profiles p where p.id = rfid_tags.profile_id and p.org_id = public.current_org_id())
    and public.has_permission('can_manage_users')
    and public.session_login_context() is null
  );

drop policy if exists rfid_tags_delete on public.rfid_tags;
create policy rfid_tags_delete on public.rfid_tags
  for delete using (
    exists (select 1 from public.profiles p where p.id = rfid_tags.profile_id and p.org_id = public.current_org_id())
    and public.has_permission('can_manage_users')
    and public.session_login_context() is null
  );

-- profiles: editing someone else's role/name/contractor flag/active state (10-user-admin.sql)
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (
    org_id = public.current_org_id()
    and public.has_permission('can_manage_users')
    and public.session_login_context() is null
  )
  with check (
    org_id = public.current_org_id()
    and public.has_permission('can_manage_users')
    and public.session_login_context() is null
  );

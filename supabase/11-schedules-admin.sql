-- Tree Tops Maintenance Platform -- recurring job scheduling admin
-- Run after 10-user-admin.sql.
--
-- schedules only had a select policy (02-rls-policies.sql) -- nobody
-- could ever write a schedule through the app. Gated by
-- can_manage_reference_data, the same permission that already covers
-- job templates/activity types/safety library, since schedules are
-- reference-ish config in the same vein.

drop policy if exists schedules_insert on public.schedules;
create policy schedules_insert on public.schedules
  for insert with check (
    org_id = public.current_org_id()
    and public.has_site_scope(site_id)
    and public.has_permission('can_manage_reference_data')
  );

drop policy if exists schedules_update on public.schedules;
create policy schedules_update on public.schedules
  for update using (
    org_id = public.current_org_id()
    and public.has_permission('can_manage_reference_data')
  )
  with check (
    org_id = public.current_org_id()
    and public.has_site_scope(site_id)
    and public.has_permission('can_manage_reference_data')
  );

drop policy if exists schedules_delete on public.schedules;
create policy schedules_delete on public.schedules
  for delete using (
    org_id = public.current_org_id()
    and public.has_permission('can_manage_reference_data')
  );

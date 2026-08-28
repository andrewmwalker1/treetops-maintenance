-- Tree Tops Maintenance Platform -- let admins edit role_visibility from
-- the app instead of the SQL editor
-- Run after 49-equipment-repair-jobs.sql.
--
-- role_visibility (01-schema.sql) has only ever had a select policy
-- (02-rls-policies.sql's role_visibility_select) -- every row since launch
-- was set by hand in the SQL editor (03-seed-treetops.sql), and only Head
-- Gardener's mapping was ever actually specified; everyone else defaults
-- to "own role only" (BUILD-BRIEF.md §11, still flagged open). This adds
-- insert/delete policies with the exact same shape as
-- role_assignable_roles_insert/_delete (44-role-assignable-job-targets.sql,
-- role_visibility's own sibling table) so a new "Role Visibility" admin
-- tab (RoleVisibilityTab.jsx) can write to it directly, gated the same way
-- Roles & Permissions and Job Assignment already are. No update policy --
-- same as role_assignable_roles and role_permissions, a change is a
-- delete-then-insert (or insert-if-absent) toggle, not an in-place edit.

drop policy if exists role_visibility_insert on public.role_visibility;
create policy role_visibility_insert on public.role_visibility
  for insert with check (
    exists (select 1 from public.roles r where r.id = role_visibility.role_id and r.org_id = public.current_org_id())
    and public.has_permission('can_manage_roles_and_permissions')
  );

drop policy if exists role_visibility_delete on public.role_visibility;
create policy role_visibility_delete on public.role_visibility
  for delete using (
    exists (select 1 from public.roles r where r.id = role_visibility.role_id and r.org_id = public.current_org_id())
    and public.has_permission('can_manage_roles_and_permissions')
  );

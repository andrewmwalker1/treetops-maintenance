-- Tree Tops Maintenance Platform -- Admin equipment checkout log
-- Run after 17-equipment-type-sort-order.sql.
--
-- Andy needs to interrogate the check-out/check-in history captured by
-- 16-rfid-kiosk-and-equipment-checkout.sql: sort/filter it and export to
-- CSV. The data itself (who, when, and any fault) is already fully
-- captured by equipment_checkouts + fault_reports -- nothing to add
-- there. equipment_checkouts_select already lets a
-- can_manage_equipment_status holder read every checkout in their org
-- (via can_see_equipment's org-wide branch), so the admin log's read side
-- needs no policy change either.
--
-- The one gap is export_logs_insert (01-schema.sql / 02-rls-policies.sql),
-- which hardcodes can_export_jobs -- correct for the jobs CSV export it
-- was built for, but this is a different export surface. Widened to also
-- accept can_manage_equipment_status, the same permission already gating
-- every other equipment admin screen (Equipment, Equipment Types, Common
-- Faults), rather than introducing a new permission key for one export
-- button.

drop policy if exists export_logs_insert on public.export_logs;
create policy export_logs_insert on public.export_logs
  for insert with check (
    org_id = public.current_org_id()
    and exported_by = auth.uid()
    and (public.has_permission('can_export_jobs') or public.has_permission('can_manage_equipment_status'))
  );

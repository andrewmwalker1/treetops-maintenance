-- Tree Tops Maintenance Platform -- equipment admin (full edit + delete)
-- Run after 12-equipment-types.sql.
--
-- Andy: equipment needs a Make and Model alongside its existing code
-- (equipment.name, now labelled "Kit ID" in the UI -- unchanged column,
-- no data migration needed), full edit, and delete "if I have
-- authority" -- there was no delete policy on equipment at all before
-- this. Adding/editing/deleting equipment records moves to Admin;
-- checks/fault reports/repair history stay on the day-to-day equipment
-- detail page (Section 5 of BUILD-BRIEF.md never separated these, but
-- Andy wants the split now -- exactly how checks become independently
-- accessible is still open, per his message).

alter table public.equipment add column if not exists make text;
alter table public.equipment add column if not exists model text;

drop policy if exists equipment_delete on public.equipment;
create policy equipment_delete on public.equipment
  for delete using (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'));

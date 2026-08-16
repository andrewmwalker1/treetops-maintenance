-- Tree Tops Maintenance Platform -- multi-unit checkout per equipment type
-- Run after 24-equipment-decommission.sql.
--
-- Andy: some equipment types (batteries, mainly -- the team takes several
-- out together and swaps them multiple times a day) need checking out in
-- one go rather than one screen per unit. Rather than a new table, this
-- is a single flag on equipment_types -- the kiosk already groups units
-- by type and already keys the shared pre-use checklist off it, so "can
-- this type be multi-selected" belongs on the same row. Defaults false:
-- every existing type keeps today's one-tap-per-unit flow unless an
-- admin opts a type in.
--
-- No RLS changes needed -- equipment_types_select/update (12-equipment-
-- types.sql) are already row-level, not column-level, so they cover this
-- new column for free. No changes needed to equipment_checkouts either:
-- multi-checkout just means the kiosk submits several ordinary inserts
-- (one per selected unit) instead of one, and the existing
-- equipment_checkouts_insert policy and the open-checkout unique index
-- already validate each of those independently.

alter table public.equipment_types
  add column if not exists allow_multi_checkout boolean not null default false;

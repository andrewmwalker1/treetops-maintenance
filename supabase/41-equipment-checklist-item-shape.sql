-- Tree Tops Maintenance Platform -- equipment checklist item shape fix
-- Run after 40-key-checkin-delegates.sql.
--
-- 32-checklist-item-photo-requirement.sql upgraded job_types.template_schema
-- from a plain array of label strings to {label, requiresPhoto} objects, and
-- ChecklistBuilder.jsx was updated to read item.label everywhere. But
-- equipment_types.pre_use_checklist uses that same shape (see comment in
-- 16-rfid-kiosk-and-equipment-checkout.sql) and was never migrated, so
-- existing equipment types still store plain strings -- item.label on a
-- string is undefined, rendering as blank rows in the admin editor and on
-- the kiosk's pre-use checklist reminder. Same upgrade, same guard so it's
-- safe to run more than once and never double-wraps.
update public.equipment_types
set pre_use_checklist = (
  select jsonb_agg(jsonb_build_object('label', elem, 'requiresPhoto', false))
  from jsonb_array_elements_text(pre_use_checklist) as elem
)
where pre_use_checklist is not null
  and jsonb_typeof(pre_use_checklist) = 'array'
  and jsonb_typeof(pre_use_checklist -> 0) = 'string';

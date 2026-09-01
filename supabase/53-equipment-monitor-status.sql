-- Tree Tops Maintenance Platform -- equipment "Monitor" status
-- Run after 52-meter-readings-schema.sql.
--
-- Andy's tractor case: a fault (worn tyres) was reported, reviewed, and
-- isn't actually fixed -- but the equipment should go back into service
-- with a visible flag for whoever checks it out next, not silently as if
-- nothing were wrong. Job completion previously only offered two outcomes
-- for equipment (`in_service` or `decommissioned`) -- this adds a third.
--
-- `alter type ... add value` cannot run in the same transaction as a
-- statement that *uses* the new value (mirrors 24-equipment-decommission.sql's
-- own note on this) -- kept as the first statement in the file for safety,
-- even though nothing below actually queries by 'monitor'.
alter type public.equipment_status add value if not exists 'monitor';

alter table public.equipment
  add column if not exists monitor_note text;

-- Separate from repair_records on purpose -- a monitor flag isn't a
-- repair (nothing was fixed), and EquipmentDetail.jsx's combined history
-- table labels each source table with its own status/colour, so folding
-- this into repair_records would mislabel it as "Repair" in the log.
create table if not exists public.equipment_monitor_events (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  note text not null,
  event_type text not null check (event_type in ('flagged', 'updated', 'cleared')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.equipment_monitor_events enable row level security;

-- Same visibility/write gating as repair_records (02-rls-policies.sql):
-- can_see_equipment() for read, can_manage_equipment_status for write.
drop policy if exists equipment_monitor_events_select on public.equipment_monitor_events;
create policy equipment_monitor_events_select on public.equipment_monitor_events
  for select using (public.can_see_equipment(equipment_id));

drop policy if exists equipment_monitor_events_insert on public.equipment_monitor_events;
create policy equipment_monitor_events_insert on public.equipment_monitor_events
  for insert with check (
    public.can_see_equipment(equipment_id)
    and created_by = auth.uid()
    and public.has_permission('can_manage_equipment_status')
  );

-- Tree Tops Maintenance Platform -- equipment types
-- Run after 11-schedules-admin.sql.
--
-- Andy: individual equipment items are identified by their own code
-- (e.g. ST1, ST2, ST3 -- stored in equipment.name, unchanged), but
-- there was no way to group them by what they actually are (e.g. all
-- three are "Strimmer"). Adds that grouping as its own table rather
-- than reusing task_types.equipment_category (a free-text field on
-- activity types/training videos, only loosely related) since this is
-- specifically about categorising physical equipment, not activities.

create table if not exists public.equipment_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  unique (org_id, name)
);

alter table public.equipment add column if not exists equipment_type_id uuid references public.equipment_types(id) on delete set null;

alter table public.equipment_types enable row level security;

drop policy if exists equipment_types_select on public.equipment_types;
create policy equipment_types_select on public.equipment_types
  for select using (org_id = public.current_org_id());

drop policy if exists equipment_types_insert on public.equipment_types;
create policy equipment_types_insert on public.equipment_types
  for insert with check (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'));

drop policy if exists equipment_types_update on public.equipment_types;
create policy equipment_types_update on public.equipment_types
  for update using (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'));

drop policy if exists equipment_types_delete on public.equipment_types;
create policy equipment_types_delete on public.equipment_types
  for delete using (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'));

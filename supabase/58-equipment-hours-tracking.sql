-- Tree Tops Maintenance Platform -- engine-hours reading at checkout
-- Run after 57-contractor-role.sql.
--
-- Andy: some equipment (the Iseki, other machines with an hours clock on
-- the dashboard) needs the operator's current hours reading captured at
-- checkout -- shown against the last reading, never allowed to go
-- backwards. Tracking is per individual machine (a clock can be broken
-- on one item even if its type generally has one), with a type-level
-- default so most items never need touching -- same "null means fall
-- through to the type" shape equipment_type_repair_assignees already
-- uses, just a boolean here instead of a three-way assignee.
--
-- last_hours_reading/_at are denormalized onto equipment deliberately
-- unlike meters.last_reading (52-meter-readings-schema.sql), which only
-- rolls forward at CSV-export time -- here it has to be current at the
-- very next checkout for "not less than last time" to mean anything.

alter table public.equipment_types add column if not exists tracks_hours_default boolean not null default false;
alter table public.equipment_types add column if not exists hours_required_default boolean not null default false;

-- null = inherit the type's default; true/false = explicit override for
-- this one machine.
alter table public.equipment add column if not exists tracks_hours boolean;
alter table public.equipment add column if not exists hours_required boolean;
alter table public.equipment add column if not exists last_hours_reading numeric;
alter table public.equipment add column if not exists last_hours_reading_at timestamptz;

create table if not exists public.equipment_hours_readings (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  -- Kept separate from equipment_checkouts (16-rfid-kiosk-and-equipment-
  -- checkout.sql) rather than a column on it -- that table's own trigger
  -- locks every column after insert, and a reading history belongs in
  -- its own table the same way meter_readings does.
  checkout_id uuid references public.equipment_checkouts(id) on delete set null,
  hours_value numeric not null,
  recorded_by uuid references public.profiles(id) on delete set null,
  recorded_at timestamptz not null default now()
);
create index if not exists equipment_hours_readings_equipment_idx on public.equipment_hours_readings (equipment_id);

alter table public.equipment_hours_readings enable row level security;

drop policy if exists equipment_hours_readings_select on public.equipment_hours_readings;
create policy equipment_hours_readings_select on public.equipment_hours_readings
  for select using (public.can_see_equipment(equipment_id));

-- Deliberately no insert policy -- every write goes through
-- record_equipment_hours below, which is the only place "not less than
-- the last reading" can actually be enforced (RLS can't check another
-- row's value). Matches this project's own rule: no direct table
-- grants to the anon/authenticated key on a write path like this, a
-- narrowly scoped security definer function instead.
create or replace function public.record_equipment_hours(
  p_equipment_id uuid,
  p_checkout_id uuid,
  p_hours_value numeric
) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_last numeric;
begin
  if not public.can_see_equipment(p_equipment_id) then
    raise exception 'Not authorized to record hours for this equipment';
  end if;

  if p_checkout_id is not null and not exists (
    select 1 from public.equipment_checkouts
    where id = p_checkout_id and equipment_id = p_equipment_id and profile_id = auth.uid()
  ) then
    raise exception 'No matching checkout for this equipment belonging to you';
  end if;

  select last_hours_reading into v_last from public.equipment where id = p_equipment_id;
  if v_last is not null and p_hours_value < v_last then
    raise exception 'New hours reading (%) is less than the last recorded reading (%)', p_hours_value, v_last;
  end if;

  insert into public.equipment_hours_readings (equipment_id, checkout_id, hours_value, recorded_by)
  values (p_equipment_id, p_checkout_id, p_hours_value, auth.uid());

  update public.equipment
  set last_hours_reading = p_hours_value, last_hours_reading_at = now()
  where id = p_equipment_id;
end;
$$;

grant execute on function public.record_equipment_hours(uuid, uuid, numeric) to authenticated;

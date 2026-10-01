-- Versioned pre-use checklists, so the checklist a machine was checked out
-- against can always be shown as it was on the day -- e.g. after an
-- accident -- however much the type's checklist has changed since.
-- Run after 80-equipment-type-no-checkout.sql. Idempotent.
--
-- Every save of equipment_types.pre_use_checklist that actually changes it
-- adds a new, numbered, never-edited row to
-- equipment_type_checklist_versions (a trigger does it, so no screen can
-- forget to). Each equipment_checkouts row records the version it was
-- checked out against in checklist_version_id, which can't change
-- afterwards.

-- ---------------------------------------------------------------------
-- 1. equipment_type_checklist_versions
-- ---------------------------------------------------------------------

create table if not exists public.equipment_type_checklist_versions (
  id uuid primary key default gen_random_uuid(),
  -- set null, not cascade: deleting an equipment type mustn't take the
  -- checklists its past checkouts were taken against with it.
  equipment_type_id uuid references public.equipment_types(id) on delete set null,
  -- The type's name when the version was saved, so a version still reads
  -- sensibly if its type is later renamed or deleted.
  equipment_type_name text,
  version_number int not null,
  -- Same {label, requiresPhoto} array shape as pre_use_checklist; an
  -- empty array is a real version ("no checklist at the time").
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  unique (equipment_type_id, version_number)
);

alter table public.equipment_type_checklist_versions enable row level security;

alter table public.equipment_type_checklist_versions
  add column if not exists org_id uuid references public.organisations(id) on delete cascade;

-- Readable within the org. No insert, update or delete policies: rows only
-- ever come from the security-definer triggers below, and are never
-- edited. Scoped by org_id rather than through equipment_types, so a
-- deleted type's versions stay readable.
drop policy if exists equipment_type_checklist_versions_select on public.equipment_type_checklist_versions;
create policy equipment_type_checklist_versions_select on public.equipment_type_checklist_versions
  for select using (org_id = public.current_org_id());

-- ---------------------------------------------------------------------
-- 2. A new version on every change
-- ---------------------------------------------------------------------

create or replace function public.record_equipment_checklist_version()
returns trigger as $$
declare
  latest public.equipment_type_checklist_versions;
  new_items jsonb := coalesce(new.pre_use_checklist, '[]'::jsonb);
begin
  select * into latest
    from public.equipment_type_checklist_versions
   where equipment_type_id = new.id
   order by version_number desc
   limit 1;

  if latest.id is null or latest.items is distinct from new_items then
    insert into public.equipment_type_checklist_versions
      (equipment_type_id, equipment_type_name, org_id, version_number, items, created_by)
    values (new.id, new.name, new.org_id, coalesce(latest.version_number, 0) + 1, new_items, auth.uid());
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists equipment_types_record_checklist_version on public.equipment_types;
create trigger equipment_types_record_checklist_version
  after insert or update of pre_use_checklist on public.equipment_types
  for each row execute function public.record_equipment_checklist_version();

-- Version 1 for every existing type: its checklist as it stands today
-- (there's no earlier history to recover). created_by is left empty --
-- nobody saved it as such.
insert into public.equipment_type_checklist_versions (equipment_type_id, equipment_type_name, org_id, version_number, items)
select t.id, t.name, t.org_id, 1, coalesce(t.pre_use_checklist, '[]'::jsonb)
  from public.equipment_types t
 where not exists (
   select 1 from public.equipment_type_checklist_versions v where v.equipment_type_id = t.id
 );

-- ---------------------------------------------------------------------
-- 3. The version each checkout was taken against
-- ---------------------------------------------------------------------

alter table public.equipment_checkouts
  add column if not exists checklist_version_id uuid references public.equipment_type_checklist_versions(id);

-- The app sends the version it actually showed on screen (a kiosk left
-- open across a checklist edit is still showing the older one). If it
-- sends none -- an older app version -- the latest version is used. A
-- version belonging to a different equipment type is refused.
create or replace function public.set_equipment_checkout_checklist_version()
returns trigger as $$
declare
  type_id uuid;
begin
  select equipment_type_id into type_id from public.equipment where id = new.equipment_id;

  if new.checklist_version_id is not null then
    if not exists (
      select 1 from public.equipment_type_checklist_versions
       where id = new.checklist_version_id and equipment_type_id = type_id
    ) then
      raise exception 'checklist version does not belong to this machine''s equipment type';
    end if;
  elsif type_id is not null then
    select id into new.checklist_version_id
      from public.equipment_type_checklist_versions
     where equipment_type_id = type_id
     order by version_number desc
     limit 1;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists equipment_checkouts_set_checklist_version on public.equipment_checkouts;
create trigger equipment_checkouts_set_checklist_version
  before insert on public.equipment_checkouts
  for each row execute function public.set_equipment_checkout_checklist_version();

-- Existing checkouts: version 1 of their type's checklist. Andy confirmed
-- (2026-10-01) no checklist has been changed since launch, so version 1 --
-- today's checklist -- is genuinely what every earlier checkout was taken
-- against. Uses each machine's current type; a machine with no type stays
-- empty. The lock-down trigger is paused just for this one-off fill, since
-- once its function (below) covers checklist_version_id it refuses
-- setting it on an existing row.
alter table public.equipment_checkouts disable trigger equipment_checkouts_enforce_immutable;

update public.equipment_checkouts c
   set checklist_version_id = v.id
  from public.equipment e
  join public.equipment_type_checklist_versions v
    on v.equipment_type_id = e.equipment_type_id and v.version_number = 1
 where e.id = c.equipment_id
   and c.checklist_version_id is null;

alter table public.equipment_checkouts enable trigger equipment_checkouts_enforce_immutable;

-- Same function as 16-rfid-kiosk-and-equipment-checkout.sql, now also
-- locking checklist_version_id once a checkout exists.
create or replace function public.enforce_equipment_checkout_immutable_fields()
returns trigger as $$
begin
  if new.equipment_id is distinct from old.equipment_id
     or new.profile_id is distinct from old.profile_id
     or new.checked_out_at is distinct from old.checked_out_at
     or new.checklist_version_id is distinct from old.checklist_version_id then
    raise exception 'equipment_id, profile_id, checked_out_at and checklist_version_id cannot change after a checkout is created';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

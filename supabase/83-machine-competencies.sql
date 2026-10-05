-- Machine competencies: which equipment types each person is competent to
-- operate. Checking out a type you're not ticked for isn't blocked -- the
-- check-out screen shows a warning, and the checkout records that it did.
-- Run after 82-activity-type-min-people.sql. Idempotent.

-- ---------------------------------------------------------------------
-- 1. Permission: Admin by default, any other role via Roles & Permissions
-- ---------------------------------------------------------------------

insert into public.permissions (key, description) values
  ('can_manage_machine_competencies', 'Can set which machine types each person is competent to operate')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, 'can_manage_machine_competencies', true
from public.roles r
where r.name = 'Admin'
  and r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2. profile_machine_competencies
-- ---------------------------------------------------------------------

-- One row per tick. Unticking never deletes: it sets revoked_at/by, so
-- "was this person signed off for this machine on this date?" can always
-- be answered. A person is competent on a type while they have a row for
-- it with revoked_at null.
create table if not exists public.profile_machine_competencies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  equipment_type_id uuid not null references public.equipment_types(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz
);

-- At most one current tick per person and type.
create unique index if not exists profile_machine_competencies_current_unique
  on public.profile_machine_competencies (profile_id, equipment_type_id)
  where revoked_at is null;
create index if not exists profile_machine_competencies_profile_idx
  on public.profile_machine_competencies (profile_id);

alter table public.profile_machine_competencies enable row level security;

-- Readable across the org: the check-out screens read the signed-in
-- person's own, the admin screen everyone's.
drop policy if exists profile_machine_competencies_select on public.profile_machine_competencies;
create policy profile_machine_competencies_select on public.profile_machine_competencies
  for select using (org_id = public.current_org_id());

drop policy if exists profile_machine_competencies_insert on public.profile_machine_competencies;
create policy profile_machine_competencies_insert on public.profile_machine_competencies
  for insert with check (
    org_id = public.current_org_id()
    and public.has_permission('can_manage_machine_competencies')
    and granted_by = auth.uid()
    and revoked_at is null
  );

drop policy if exists profile_machine_competencies_update on public.profile_machine_competencies;
create policy profile_machine_competencies_update on public.profile_machine_competencies
  for update using (org_id = public.current_org_id() and public.has_permission('can_manage_machine_competencies'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_machine_competencies'));

-- No delete policy: rows are history. The only update allowed is revoking
-- a current tick, once, as yourself.
create or replace function public.enforce_machine_competency_revoke_only()
returns trigger as $$
begin
  if old.revoked_at is not null then
    raise exception 'a removed competency cannot be changed';
  end if;
  if new.org_id is distinct from old.org_id
     or new.profile_id is distinct from old.profile_id
     or new.equipment_type_id is distinct from old.equipment_type_id
     or new.granted_by is distinct from old.granted_by
     or new.granted_at is distinct from old.granted_at then
    raise exception 'only revoked_at and revoked_by can change on a competency';
  end if;
  if new.revoked_at is null or new.revoked_by is distinct from auth.uid() then
    raise exception 'a competency can only be updated to revoke it, as yourself';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists profile_machine_competencies_revoke_only on public.profile_machine_competencies;
create trigger profile_machine_competencies_revoke_only
  before update on public.profile_machine_competencies
  for each row execute function public.enforce_machine_competency_revoke_only();

-- ---------------------------------------------------------------------
-- 3. Record on each checkout whether the warning applied
-- ---------------------------------------------------------------------

-- True when, at check-out, the person had no current competency for the
-- machine's type -- i.e. they were shown the warning. Set by the database,
-- not the app, so it can't be skipped, and locked once the checkout exists.
-- Existing checkouts predate competencies and stay false.
alter table public.equipment_checkouts
  add column if not exists competency_warning boolean not null default false;

create or replace function public.set_equipment_checkout_competency_warning()
returns trigger as $$
declare
  type_id uuid;
begin
  select equipment_type_id into type_id from public.equipment where id = new.equipment_id;
  new.competency_warning := type_id is not null and not exists (
    select 1 from public.profile_machine_competencies c
     where c.profile_id = new.profile_id
       and c.equipment_type_id = type_id
       and c.revoked_at is null
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists equipment_checkouts_set_competency_warning on public.equipment_checkouts;
create trigger equipment_checkouts_set_competency_warning
  before insert on public.equipment_checkouts
  for each row execute function public.set_equipment_checkout_competency_warning();

-- Same function as 81-equipment-checklist-versions.sql, now also locking
-- competency_warning once a checkout exists.
create or replace function public.enforce_equipment_checkout_immutable_fields()
returns trigger as $$
begin
  if new.equipment_id is distinct from old.equipment_id
     or new.profile_id is distinct from old.profile_id
     or new.checked_out_at is distinct from old.checked_out_at
     or new.checklist_version_id is distinct from old.checklist_version_id
     or new.competency_warning is distinct from old.competency_warning then
    raise exception 'equipment_id, profile_id, checked_out_at, checklist_version_id and competency_warning cannot change after a checkout is created';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

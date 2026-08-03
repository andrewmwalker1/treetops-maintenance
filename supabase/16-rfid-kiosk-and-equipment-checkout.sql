-- Tree Tops Maintenance Platform -- RFID kiosk sign-in + equipment check-out/in
-- Run after 15-job-completion-and-role-management.sql.
--
-- Workshop staff sign in to a fixed touchscreen kiosk by scanning an RFID
-- fob (see supabase/functions/rfid-login) instead of the email magic-link
-- flow -- gloved/dirty hands make email impractical there. Once signed in,
-- the kiosk lets staff view/complete their own jobs and check tools in and
-- out (category -> specific unit, no per-tool tagging needed since there
-- are only 3-4 units per equipment type). Reporting a fault ("pink
-- ticketing" a machine, Andy's existing paper-form term) marks the unit
-- unavailable.
--
-- Five things:
-- 1. rfid_tags -- maps a physical tag UID to an existing profile. No
--    parallel identity system; gated like site_scope (10-user-admin.sql)
--    on can_manage_users, since assigning how someone authenticates is
--    the same category as inviting them.
-- 2. equipment_checkouts -- the actual "who currently has this out" log.
--    Deliberately NOT reusing equipment.held_by_profile_id, which already
--    exists for a different, longer-term "permanently issued to an
--    employee" concept that nothing currently writes -- conflating the
--    two would give one column two meanings. A partial unique index on
--    (equipment_id) where checked_in_at is null is what actually prevents
--    two people checking the same unit out at once (DB-enforced, not
--    just filtered client-side), and a trigger locks down which columns
--    any update may touch regardless of who's doing the updating.
-- 3. common_fault_descriptions -- an admin-managed picklist of common
--    problems per equipment type, gated identically to equipment_types
--    (12-equipment-types.sql).
-- 4. equipment_types.pre_use_checklist -- same jsonb-array-of-strings
--    shape as job_types.template_schema, so the existing
--    ChecklistBuilder component (already supports readOnly) works with
--    zero changes: admin-edited, shown read-only on the kiosk as a
--    reminder (not an interactive tick-list -- Andy explicitly decided
--    against digitizing the old paper form into a full tick-form).
-- 5. rfid_login_attempts + two security-definer RPCs
--    (report_equipment_fault, admin_force_check_in) -- ordinary staff
--    must be able to flip equipment.status via the fault-report path
--    without weakening equipment_update's existing
--    can_manage_equipment_status gate for arbitrary status changes by
--    anyone; admin_force_check_in is the equivalent narrow escape hatch
--    for closing someone else's forgotten checkout. Everyday
--    checkout/self-check-in need no RPC at all -- the partial unique
--    index and the equipment_checkouts_insert policy's in_service check
--    do that work directly.
--
-- No new permission keys: can_manage_users and can_manage_equipment_status
-- already cover everything here.

-- ---------------------------------------------------------------------
-- 1. rfid_tags
-- ---------------------------------------------------------------------

create table if not exists public.rfid_tags (
  id uuid primary key default gen_random_uuid(),
  tag_uid text not null unique,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists rfid_tags_profile_idx on public.rfid_tags (profile_id);
alter table public.rfid_tags enable row level security;

drop policy if exists rfid_tags_select on public.rfid_tags;
create policy rfid_tags_select on public.rfid_tags
  for select using (
    exists (select 1 from public.profiles p where p.id = rfid_tags.profile_id and p.org_id = public.current_org_id())
    and public.has_permission('can_manage_users')
  );

drop policy if exists rfid_tags_insert on public.rfid_tags;
create policy rfid_tags_insert on public.rfid_tags
  for insert with check (
    exists (select 1 from public.profiles p where p.id = rfid_tags.profile_id and p.org_id = public.current_org_id())
    and public.has_permission('can_manage_users')
  );

drop policy if exists rfid_tags_update on public.rfid_tags;
create policy rfid_tags_update on public.rfid_tags
  for update using (
    exists (select 1 from public.profiles p where p.id = rfid_tags.profile_id and p.org_id = public.current_org_id())
    and public.has_permission('can_manage_users')
  )
  with check (
    exists (select 1 from public.profiles p where p.id = rfid_tags.profile_id and p.org_id = public.current_org_id())
    and public.has_permission('can_manage_users')
  );

drop policy if exists rfid_tags_delete on public.rfid_tags;
create policy rfid_tags_delete on public.rfid_tags
  for delete using (
    exists (select 1 from public.profiles p where p.id = rfid_tags.profile_id and p.org_id = public.current_org_id())
    and public.has_permission('can_manage_users')
  );

-- ---------------------------------------------------------------------
-- 2. equipment_checkouts
-- ---------------------------------------------------------------------

create table if not exists public.equipment_checkouts (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  checked_out_at timestamptz not null default now(),
  checked_in_at timestamptz,
  checked_in_by uuid references public.profiles(id) on delete set null,
  checkin_fault_report_id uuid references public.fault_reports(id) on delete set null
);
create index if not exists equipment_checkouts_equipment_idx on public.equipment_checkouts (equipment_id);
create index if not exists equipment_checkouts_profile_idx on public.equipment_checkouts (profile_id);

-- The concurrency guard: at most one open (checked_in_at is null) row per
-- equipment_id at a time.
create unique index if not exists equipment_checkouts_open_unique
  on public.equipment_checkouts (equipment_id)
  where checked_in_at is null;

alter table public.equipment_checkouts enable row level security;

drop policy if exists equipment_checkouts_select on public.equipment_checkouts;
create policy equipment_checkouts_select on public.equipment_checkouts
  for select using (public.can_see_equipment(equipment_id));

-- Self check-out. DB-enforces both "no double open checkout" (the
-- partial unique index above) and "must actually be in_service right
-- now" -- not just filtered client-side.
drop policy if exists equipment_checkouts_insert on public.equipment_checkouts;
create policy equipment_checkouts_insert on public.equipment_checkouts
  for insert with check (
    public.can_see_equipment(equipment_id)
    and profile_id = auth.uid()
    and exists (select 1 from public.equipment e where e.id = equipment_id and e.status = 'in_service')
  );

-- Self check-in only. Admin force-check-in goes through the
-- admin_force_check_in() RPC below, never a raw PATCH, so a
-- can_manage_equipment_status holder can't accidentally rewrite
-- equipment_id/profile_id/checked_out_at via this policy.
drop policy if exists equipment_checkouts_update on public.equipment_checkouts;
create policy equipment_checkouts_update on public.equipment_checkouts
  for update using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- RLS using/with check can't compare old vs new column values, so this
-- trigger (same pattern as enforce_job_reallocation_permission in
-- 02-rls-policies.sql) locks down which columns ANY update may touch --
-- self check-in, report_equipment_fault(), and admin_force_check_in()
-- all only ever need to touch the checked-in-family columns.
create or replace function public.enforce_equipment_checkout_immutable_fields()
returns trigger as $$
begin
  if new.equipment_id is distinct from old.equipment_id
     or new.profile_id is distinct from old.profile_id
     or new.checked_out_at is distinct from old.checked_out_at then
    raise exception 'equipment_id, profile_id and checked_out_at cannot change after a checkout is created';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists equipment_checkouts_enforce_immutable on public.equipment_checkouts;
create trigger equipment_checkouts_enforce_immutable
  before update on public.equipment_checkouts
  for each row execute function public.enforce_equipment_checkout_immutable_fields();

-- ---------------------------------------------------------------------
-- 3. common_fault_descriptions
-- ---------------------------------------------------------------------

create table if not exists public.common_fault_descriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  equipment_type_id uuid not null references public.equipment_types(id) on delete cascade,
  description text not null,
  sort_order int not null default 0
);
create index if not exists common_fault_descriptions_type_idx on public.common_fault_descriptions (equipment_type_id);
alter table public.common_fault_descriptions enable row level security;

drop policy if exists common_fault_descriptions_select on public.common_fault_descriptions;
create policy common_fault_descriptions_select on public.common_fault_descriptions
  for select using (org_id = public.current_org_id());

drop policy if exists common_fault_descriptions_insert on public.common_fault_descriptions;
create policy common_fault_descriptions_insert on public.common_fault_descriptions
  for insert with check (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'));

drop policy if exists common_fault_descriptions_update on public.common_fault_descriptions;
create policy common_fault_descriptions_update on public.common_fault_descriptions
  for update using (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'));

drop policy if exists common_fault_descriptions_delete on public.common_fault_descriptions;
create policy common_fault_descriptions_delete on public.common_fault_descriptions
  for delete using (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'));

-- ---------------------------------------------------------------------
-- 4. equipment_types.pre_use_checklist
-- ---------------------------------------------------------------------

alter table public.equipment_types add column if not exists pre_use_checklist jsonb;

-- ---------------------------------------------------------------------
-- 5. rfid_login_attempts (rate-limit log) + security-definer RPCs
-- ---------------------------------------------------------------------

-- No policies granted to anyone -- RLS enabled with zero policies means
-- every role except the service-role rfid-login Edge Function (which
-- bypasses RLS entirely) gets default-deny. Nothing user-facing should
-- ever read this table.
create table if not exists public.rfid_login_attempts (
  id uuid primary key default gen_random_uuid(),
  tag_uid text not null,
  ip text,
  succeeded boolean not null,
  attempted_at timestamptz not null default now()
);
create index if not exists rfid_login_attempts_recent_idx on public.rfid_login_attempts (tag_uid, attempted_at);
alter table public.rfid_login_attempts enable row level security;

-- Andy's "pink ticket" action. Inserts the fault report (existing table,
-- existing insert policy, unchanged) and flips the equipment to faulty,
-- and optionally closes the caller's own open checkout in the same
-- transaction (the check-in-with-issue case). security definer so an
-- ordinary staff member (without can_manage_equipment_status) can flip
-- status via this one narrow, audited path without the general
-- equipment_update policy being relaxed for everyone.
create or replace function public.report_equipment_fault(
  p_equipment_id uuid,
  p_description text,
  p_close_checkout_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_fault_id uuid;
begin
  if not public.can_see_equipment(p_equipment_id) then
    raise exception 'Not authorized to report a fault for this equipment';
  end if;

  if p_close_checkout_id is not null and not exists (
    select 1 from public.equipment_checkouts
    where id = p_close_checkout_id
      and equipment_id = p_equipment_id
      and profile_id = auth.uid()
      and checked_in_at is null
  ) then
    raise exception 'No matching open checkout for this equipment belonging to you';
  end if;

  insert into public.fault_reports (equipment_id, reported_by, description)
  values (p_equipment_id, auth.uid(), p_description)
  returning id into v_fault_id;

  update public.equipment set status = 'faulty' where id = p_equipment_id;

  if p_close_checkout_id is not null then
    update public.equipment_checkouts
    set checked_in_at = now(), checked_in_by = auth.uid(), checkin_fault_report_id = v_fault_id
    where id = p_close_checkout_id;
  end if;

  return v_fault_id;
end;
$$;

grant execute on function public.report_equipment_fault(uuid, text, uuid) to authenticated;

-- Admin override for a forgotten check-in.
create or replace function public.admin_force_check_in(p_checkout_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.has_permission('can_manage_equipment_status') then
    raise exception 'Forcing a check-in requires the can_manage_equipment_status permission';
  end if;

  update public.equipment_checkouts
  set checked_in_at = now(), checked_in_by = auth.uid()
  where id = p_checkout_id and checked_in_at is null;

  if not found then
    raise exception 'No open checkout found for that id';
  end if;
end;
$$;

grant execute on function public.admin_force_check_in(uuid) to authenticated;

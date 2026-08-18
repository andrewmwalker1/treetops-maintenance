-- Tree Tops Maintenance Platform -- key management, part 2: check-out/check-in
-- Run after 36-key-tags-schema.sql.
--
-- key_checkouts mirrors equipment_checkouts (16-rfid-kiosk-and-equipment-
-- checkout.sql) closely: a partial unique index is what actually prevents
-- a key being checked out twice, and a trigger locks down which columns an
-- update may touch. Two real differences from equipment:
-- 1. issued_to_kind/issued_to_contractor_id/issued_to_name/reason -- a key
--    is usually checked OUT by a staff member but TO someone else
--    (contractor/customer/guest), which equipment_checkouts has no
--    equivalent of (equipment is always checked out to the person taking
--    it themselves).
-- 2. Check-in is NOT restricted to the person who checked it out (Andy:
--    "keys are not always booked back in by the person who booked them
--    out") -- equipment_checkouts' update policy requires
--    profile_id = auth.uid() for exactly this reason; key_checkouts'
--    update policy instead allows anyone holding can_use_key_system to
--    close ANY open row, only requiring checked_in_by = auth.uid() (i.e.
--    you can't check a key in "as" someone else).
--
-- contractors already exists (21-contractors-and-groups-admin.sql, for job
-- assignment) -- reused here rather than duplicated. is_trusted marks the
-- handful (Kevin Parry, CMT Cleaning) who get their own profile + RFID fob
-- and use the key station unaccompanied; everyone else is just a
-- name/reason-preset record staff pick when checking a key out on their
-- behalf. Trusted-contractor logins need no new code at all -- see
-- SYSTEMSPEC.md's Key Tags entry -- an admin creates them a normal profile
-- (is_contractor=true) with a "Contractor" role holding only
-- can_use_key_system, then registers their fob the same way as any
-- member of staff.

alter table public.contractors add column if not exists is_trusted boolean not null default false;

create table if not exists public.contractor_reasons (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists contractor_reasons_contractor_idx on public.contractor_reasons (contractor_id);

alter table public.contractor_reasons enable row level security;

-- Matches contractors_select's own openness (org membership only, no
-- extra permission) -- anyone who can see a contractor in a picker should
-- see its reason presets too.
drop policy if exists contractor_reasons_select on public.contractor_reasons;
create policy contractor_reasons_select on public.contractor_reasons
  for select using (
    exists (select 1 from public.contractors c where c.id = contractor_reasons.contractor_id and c.org_id = public.current_org_id())
  );

drop policy if exists contractor_reasons_insert on public.contractor_reasons;
create policy contractor_reasons_insert on public.contractor_reasons
  for insert with check (
    exists (select 1 from public.contractors c where c.id = contractor_reasons.contractor_id and c.org_id = public.current_org_id())
    and public.has_permission('can_manage_contractors')
  );

drop policy if exists contractor_reasons_update on public.contractor_reasons;
create policy contractor_reasons_update on public.contractor_reasons
  for update using (
    exists (select 1 from public.contractors c where c.id = contractor_reasons.contractor_id and c.org_id = public.current_org_id())
    and public.has_permission('can_manage_contractors')
  )
  with check (
    exists (select 1 from public.contractors c where c.id = contractor_reasons.contractor_id and c.org_id = public.current_org_id())
    and public.has_permission('can_manage_contractors')
  );

drop policy if exists contractor_reasons_delete on public.contractor_reasons;
create policy contractor_reasons_delete on public.contractor_reasons
  for delete using (
    exists (select 1 from public.contractors c where c.id = contractor_reasons.contractor_id and c.org_id = public.current_org_id())
    and public.has_permission('can_manage_contractors')
  );

create table if not exists public.key_checkouts (
  id uuid primary key default gen_random_uuid(),
  key_tag_id uuid not null references public.key_tags(id) on delete cascade,
  checked_out_at timestamptz not null default now(),
  checked_out_by uuid not null references public.profiles(id) on delete cascade,
  issued_to_kind text not null check (issued_to_kind in ('self', 'contractor', 'customer', 'guest')),
  issued_to_contractor_id uuid references public.contractors(id) on delete set null,
  issued_to_name text,
  reason text not null,
  checked_in_at timestamptz,
  checked_in_by uuid references public.profiles(id) on delete set null,
  notes text,
  constraint key_checkouts_issued_to_check check (
    issued_to_kind = 'self'
    or (issued_to_kind = 'contractor' and (issued_to_contractor_id is not null or issued_to_name is not null))
    or (issued_to_kind in ('customer', 'guest') and issued_to_name is not null)
  )
);
create index if not exists key_checkouts_key_tag_idx on public.key_checkouts (key_tag_id);
create index if not exists key_checkouts_checked_out_by_idx on public.key_checkouts (checked_out_by);
create unique index if not exists key_checkouts_one_open_per_tag on public.key_checkouts (key_tag_id) where checked_in_at is null;

create or replace function public.enforce_key_checkout_immutable_fields()
returns trigger as $$
begin
  if new.key_tag_id is distinct from old.key_tag_id
     or new.checked_out_by is distinct from old.checked_out_by
     or new.checked_out_at is distinct from old.checked_out_at
     or new.issued_to_kind is distinct from old.issued_to_kind
     or new.issued_to_contractor_id is distinct from old.issued_to_contractor_id
     or new.issued_to_name is distinct from old.issued_to_name
     or new.reason is distinct from old.reason then
    raise exception 'Only checked_in_at, checked_in_by, and notes may be changed on a key checkout';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists key_checkouts_immutable on public.key_checkouts;
create trigger key_checkouts_immutable
  before update on public.key_checkouts
  for each row execute function public.enforce_key_checkout_immutable_fields();

alter table public.key_checkouts enable row level security;

drop policy if exists key_checkouts_select on public.key_checkouts;
create policy key_checkouts_select on public.key_checkouts
  for select using (
    exists (
      select 1 from public.key_tags kt
      where kt.id = key_checkouts.key_tag_id
        and public.has_site_scope(kt.site_id)
        and (public.has_permission('can_use_key_system') or public.has_permission('can_manage_keys'))
    )
  );

drop policy if exists key_checkouts_insert on public.key_checkouts;
create policy key_checkouts_insert on public.key_checkouts
  for insert with check (
    checked_out_by = auth.uid()
    and exists (
      select 1 from public.key_tags kt
      where kt.id = key_checkouts.key_tag_id
        and public.has_site_scope(kt.site_id)
        and public.has_permission('can_use_key_system')
    )
  );

-- No profile_id = auth.uid() restriction in `using` (unlike
-- equipment_checkouts) -- see header comment. `with check` still requires
-- checked_in_by to be the caller: you can close someone else's checkout,
-- but only as yourself.
drop policy if exists key_checkouts_update on public.key_checkouts;
create policy key_checkouts_update on public.key_checkouts
  for update using (
    checked_in_at is null
    and exists (
      select 1 from public.key_tags kt
      where kt.id = key_checkouts.key_tag_id
        and public.has_site_scope(kt.site_id)
        and public.has_permission('can_use_key_system')
    )
  )
  with check (checked_in_by = auth.uid());

-- Admin override for a forgotten check-in, mirroring admin_force_check_in.
create or replace function public.admin_force_check_in_key(p_checkout_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not public.has_permission('can_manage_keys') then
    raise exception 'Forcing a check-in requires the can_manage_keys permission';
  end if;

  update public.key_checkouts
  set checked_in_at = now(), checked_in_by = auth.uid()
  where id = p_checkout_id and checked_in_at is null;

  if not found then
    raise exception 'No open checkout found for that id';
  end if;
end;
$$;

grant execute on function public.admin_force_check_in_key(uuid) to authenticated;

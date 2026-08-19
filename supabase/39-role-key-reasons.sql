-- Tree Tops Maintenance Platform -- standard key check-out reasons by role
-- Run after 38-sam-key-management-access.sql.
--
-- contractor_reasons (37-key-checkouts-and-contractor-reasons.sql) covers
-- preset reasons for keys checked out TO a contractor. Andy also wants
-- presets for staff checking a key out for THEMSELVES ("self"), varying
-- by their role -- e.g. Sam's "Caravan Prep" role gets "Clean the
-- caravan" / "At the request of the owner" / "Dress the caravan". Same
-- shape as contractor_reasons, keyed to a role instead of a contractor.

create table if not exists public.role_key_reasons (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists role_key_reasons_role_idx on public.role_key_reasons (role_id);

alter table public.role_key_reasons enable row level security;

-- Matches contractor_reasons_select's own openness (org membership only)
-- -- anyone checking a key out for themselves needs to read their own
-- role's presets, and there's nothing sensitive about the list itself.
drop policy if exists role_key_reasons_select on public.role_key_reasons;
create policy role_key_reasons_select on public.role_key_reasons
  for select using (
    exists (select 1 from public.roles r where r.id = role_key_reasons.role_id and r.org_id = public.current_org_id())
  );

drop policy if exists role_key_reasons_insert on public.role_key_reasons;
create policy role_key_reasons_insert on public.role_key_reasons
  for insert with check (
    exists (select 1 from public.roles r where r.id = role_key_reasons.role_id and r.org_id = public.current_org_id())
    and public.has_permission('can_manage_keys')
  );

drop policy if exists role_key_reasons_update on public.role_key_reasons;
create policy role_key_reasons_update on public.role_key_reasons
  for update using (
    exists (select 1 from public.roles r where r.id = role_key_reasons.role_id and r.org_id = public.current_org_id())
    and public.has_permission('can_manage_keys')
  )
  with check (
    exists (select 1 from public.roles r where r.id = role_key_reasons.role_id and r.org_id = public.current_org_id())
    and public.has_permission('can_manage_keys')
  );

drop policy if exists role_key_reasons_delete on public.role_key_reasons;
create policy role_key_reasons_delete on public.role_key_reasons
  for delete using (
    exists (select 1 from public.roles r where r.id = role_key_reasons.role_id and r.org_id = public.current_org_id())
    and public.has_permission('can_manage_keys')
  );

-- Tree Tops Maintenance Platform -- License Agreement Builder
-- Run after 62-office-hub.sql.
--
-- Merges the standalone "license-agreement-builder" tool in (same
-- reasoning as Office Hub in 62-office-hub.sql): it had no login of
-- its own, and Andy is the only person with a GitHub account, so a
-- separate hosted site couldn't give ordinary office staff real
-- access either way. This rides the existing login/permissions
-- instead.
--
-- Two permissions, mirroring Office Hub's use/manage split:
-- can_use_license_agreement runs the wizard and saves/loads drafts;
-- can_manage_license_agreement_settings edits the shared Pitch Fees
-- table, area-season mapping and Rates default underneath it.
insert into public.permissions (key, description) values
  ('can_use_license_agreement', 'Can use the License Agreement Builder wizard'),
  ('can_manage_license_agreement_settings', 'Can edit the License Agreement Builder''s shared Pitch Fees table, area-season mapping and Rates default')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, 'can_use_license_agreement', true
from public.roles r
where r.name in ('Admin', 'Office')
  and r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, 'can_manage_license_agreement_settings', true
from public.roles r
where r.name = 'Admin'
  and r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Shared settings -- replace the original tool's per-browser
-- localStorage copies, now that more than one person uses this
-- through their own login.
-- ---------------------------------------------------------------------

-- vat_percent deliberately dropped: parsed by the original tool but
-- never actually used anywhere (confirmed by reading app.js in full).
create table if not exists public.license_agreement_pitch_fees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  description text not null,
  net_price numeric not null default 0,
  gross_price numeric not null default 0,
  sort_order int not null default 0
);

create table if not exists public.license_agreement_area_seasons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  prefix text not null,
  season_length numeric not null default 9
);

-- One row per org -- the Rates full-year figure that carries over as
-- next sale's default (the original's ltb.ratesFullYear.v1 key).
create table if not exists public.license_agreement_settings (
  org_id uuid primary key references public.organisations(id) on delete cascade,
  rates_full_year numeric
);

-- Replaces the local resumable-progress CSV -- a shared list so a
-- half-finished sale can be picked up by anyone, from any machine,
-- not just the one it was saved from.
create table if not exists public.license_agreement_drafts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  unit_site text,
  customer_name text,
  saved_at timestamptz not null default now(),
  data jsonb not null
);

alter table public.license_agreement_pitch_fees enable row level security;
alter table public.license_agreement_area_seasons enable row level security;
alter table public.license_agreement_settings enable row level security;
alter table public.license_agreement_drafts enable row level security;

drop policy if exists license_agreement_pitch_fees_select on public.license_agreement_pitch_fees;
create policy license_agreement_pitch_fees_select on public.license_agreement_pitch_fees
  for select using (org_id = public.current_org_id() and public.has_permission('can_use_license_agreement'));

drop policy if exists license_agreement_pitch_fees_write on public.license_agreement_pitch_fees;
create policy license_agreement_pitch_fees_write on public.license_agreement_pitch_fees
  for all
  using (org_id = public.current_org_id() and public.has_permission('can_manage_license_agreement_settings'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_license_agreement_settings'));

drop policy if exists license_agreement_area_seasons_select on public.license_agreement_area_seasons;
create policy license_agreement_area_seasons_select on public.license_agreement_area_seasons
  for select using (org_id = public.current_org_id() and public.has_permission('can_use_license_agreement'));

drop policy if exists license_agreement_area_seasons_write on public.license_agreement_area_seasons;
create policy license_agreement_area_seasons_write on public.license_agreement_area_seasons
  for all
  using (org_id = public.current_org_id() and public.has_permission('can_manage_license_agreement_settings'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_license_agreement_settings'));

drop policy if exists license_agreement_settings_select on public.license_agreement_settings;
create policy license_agreement_settings_select on public.license_agreement_settings
  for select using (org_id = public.current_org_id() and public.has_permission('can_use_license_agreement'));

drop policy if exists license_agreement_settings_write on public.license_agreement_settings;
create policy license_agreement_settings_write on public.license_agreement_settings
  for all
  using (org_id = public.current_org_id() and public.has_permission('can_manage_license_agreement_settings'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_license_agreement_settings'));

drop policy if exists license_agreement_drafts_all on public.license_agreement_drafts;
create policy license_agreement_drafts_all on public.license_agreement_drafts
  for all
  using (org_id = public.current_org_id() and public.has_permission('can_use_license_agreement'))
  with check (org_id = public.current_org_id() and public.has_permission('can_use_license_agreement'));

-- ---------------------------------------------------------------------
-- Seed data -- the same bundled Pitch Fees sheet and area defaults the
-- original tool shipped with, so the wizard works immediately rather
-- than showing "not loaded" until an admin re-imports it. WiFi rows
-- kept out: confirmed dead in the original (excluded from every
-- pitch-band lookup, since they don't match the "... Pitch Fees"
-- naming the lookup requires).
-- ---------------------------------------------------------------------

insert into public.license_agreement_pitch_fees (org_id, description, net_price, gross_price, sort_order)
select v.org_id, v.description, v.net_price, v.gross_price, v.sort_order
from (
  select
    (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd') as org_id,
    *
  from (values
    ('OM-Band 1 Pitch Fees', 4250.00, 5100.00, 0),
    ('OM-Band 2 Pitch Fees', 4250.00, 5100.00, 1),
    ('OM-Band 3 Pitch Fees', 4500.00, 5400.00, 2),
    ('OM-Band 4 Pitch Fees', 4583.33, 5500.00, 3),
    ('OM-Band 5 Pitch Fees', 4666.66, 5600.00, 4),
    ('OP-Band 1 Pitch Fees', 3416.66, 4100.00, 5),
    ('OP-Band 1a Pitch Fees', 3500.00, 4200.00, 6),
    ('OP-Band 2 Pitch Fees', 3541.66, 4250.00, 7),
    ('OP-Band 3 Pitch Fees', 3604.16, 4325.00, 8),
    ('OP-Band 4 Lodge Pitch Fees', 4145.83, 4975.00, 9),
    ('OP-Band 4 Pitch Fees', 3625.00, 4350.00, 10),
    ('OP-Band 5 Pitch Fees', 3708.33, 4450.00, 11),
    ('PN-Band 1 Pitch Fees', 3666.66, 4400.00, 12),
    ('PN-Band 2 Pitch Fees', 3691.66, 4430.00, 13),
    ('PN-Band 3 & Sky Pitch Fees', 3812.50, 4575.00, 14),
    ('PN-Band 3 Pitch Fees', 3937.50, 4725.00, 15),
    ('PN-Band 4 & Sky Pitch Fees', 3937.50, 4725.00, 16),
    ('PN-Band 4 Pitch Fees', 3916.66, 4700.00, 17),
    ('PN-Band Lodge + No Sky Pitch Fees', 4187.50, 5025.00, 18),
    ('PN-Band Lodge Pitch Fees', 4166.66, 5000.00, 19),
    ('YH-Band 1 Pitch Fees', 4000.00, 4800.00, 20),
    ('YH-Band 2 Pitch Fees', 4166.66, 5000.00, 21),
    ('YH-Band 3 Pitch Fees', 4250.00, 5100.00, 22),
    ('YH-Lodge 1 Pitch Fees', 4416.66, 5300.00, 23),
    ('YH-Lodge 2 Pitch Fees', 4333.33, 5200.00, 24)
  ) as t(description, net_price, gross_price, sort_order)
) v
where not exists (
  select 1 from public.license_agreement_pitch_fees existing
  where existing.org_id = v.org_id and existing.description = v.description
);

insert into public.license_agreement_area_seasons (org_id, prefix, season_length)
select v.org_id, v.prefix, v.season_length
from (
  select
    (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd') as org_id,
    *
  from (values
    ('OM', 10.5),
    ('YH', 9),
    ('PN', 9),
    ('OP', 9)
  ) as t(prefix, season_length)
) v
where not exists (
  select 1 from public.license_agreement_area_seasons existing
  where existing.org_id = v.org_id and existing.prefix = v.prefix
);

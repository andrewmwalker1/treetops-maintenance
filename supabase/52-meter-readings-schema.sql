-- Tree Tops Maintenance Platform -- Meter Reading pilot
-- Run after 51-jobs-creator-always-visible.sql.
--
-- Adds the schema for the meter-reading PWA workflow: scan a QR code on a
-- pitch's gas/electric meter box, photograph the dial, confirm a reading,
-- sync when back online. See the meter-reading build plan for full context.
--
-- Meters FK straight onto the real, already-seeded public.pitches rows
-- (05-seed-pitches.sql) -- the CampManager CSV "Site" column matches
-- pitches.pitch_number_or_name exactly (spot-checked PN-C01, PN-C17,
-- OP-E06, YH-E18). Duplicate meter records for one pitch+type (CampManager
-- keeps dead/superseded meters as separate rows, e.g. PN-C17 has both a
-- "Dead Meter electric" and its live replacement, both Connected=Yes) are
-- kept, not collapsed -- import_meters() below picks the one with the most
-- recent Last Read date as is_current and records the group in
-- import_duplicate_groups so whoever ran the import can review or override
-- the pick, per Andy's requirement that this is never decided silently.

-- ---------------------------------------------------------------------
-- Permission
-- ---------------------------------------------------------------------

insert into public.permissions (key, description) values
  ('can_manage_meter_readings', 'Can import/export meter reading files, resolve duplicate meters, and edit unit-cost settings')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, 'can_manage_meter_readings', true
from public.roles r
where r.name = 'Admin'
  and r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

create table if not exists public.meter_import_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  imported_by uuid not null references public.profiles(id),
  electric_filename text,
  gas_filename text,
  notes text,
  imported_at timestamptz not null default now()
);

-- One row per CampManager meter record -- duplicates for the same
-- pitch+type are kept as separate rows (is_current picks the live one),
-- not collapsed, so the original CSV data is never lossy.
create table if not exists public.meters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  pitch_id uuid not null references public.pitches(id) on delete cascade,
  external_meter_id text not null,
  meter_type text not null check (meter_type in ('electric', 'gas')),
  qr_code text not null,
  make text,
  model text,
  customer_name text,
  connected boolean not null default true,
  last_read_date date,
  last_reading numeric,
  cost_per_unit numeric,
  vat_rate numeric,
  is_current boolean not null default true,
  import_batch_id uuid references public.meter_import_batches(id) on delete set null,
  created_at timestamptz not null default now()
);

-- A scan only ever resolves to one live meter per pitch+type.
create unique index if not exists meters_qr_code_current_key
  on public.meters (qr_code) where is_current;

create table if not exists public.meter_import_duplicate_groups (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.meter_import_batches(id) on delete cascade,
  pitch_id uuid not null references public.pitches(id) on delete cascade,
  meter_type text not null check (meter_type in ('electric', 'gas')),
  candidate_meter_ids text[] not null,
  chosen_meter_id text not null,
  resolved boolean not null default false,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz
);

create table if not exists public.meter_readings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  meter_id uuid not null references public.meters(id) on delete cascade,
  client_generated_id uuid not null unique,
  reading_value numeric not null,
  read_at timestamptz not null default now(),
  photo_storage_path text,
  gps_lat numeric,
  gps_lng numeric,
  gps_accuracy_m numeric,
  gps_denied boolean not null default false,
  ocr_raw_text text,
  ocr_confidence numeric,
  reading_source text not null check (reading_source in ('ocr', 'ocr_corrected', 'manual')),
  taken_by_profile_id uuid not null references public.profiles(id),
  usage_warning_overridden boolean not null default false,
  usage_warning_note text,
  exported_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists meter_readings_meter_id_idx on public.meter_readings (meter_id);
create index if not exists meter_readings_pending_export_idx on public.meter_readings (site_id) where exported_at is null;

-- Backs the confirm screen's estimated-£ display -- explicitly not for
-- billing (Campmanager remains the system of record), just a sanity check.
create table if not exists public.meter_reading_settings (
  site_id uuid primary key references public.sites(id) on delete cascade,
  electric_unit_cost numeric,
  gas_unit_cost numeric
);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table public.meter_import_batches enable row level security;
alter table public.meters enable row level security;
alter table public.meter_import_duplicate_groups enable row level security;
alter table public.meter_readings enable row level security;
alter table public.meter_reading_settings enable row level security;

create or replace function public.can_see_meter(p_meter_id uuid)
returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.meters m
    where m.id = p_meter_id and public.has_site_scope(m.site_id)
  );
$$;

drop policy if exists meter_import_batches_select on public.meter_import_batches;
create policy meter_import_batches_select on public.meter_import_batches
  for select using (public.has_site_scope(site_id));

drop policy if exists meter_import_batches_insert on public.meter_import_batches;
create policy meter_import_batches_insert on public.meter_import_batches
  for insert with check (
    org_id = public.current_org_id()
    and public.has_site_scope(site_id)
    and imported_by = auth.uid()
    and public.has_permission('can_manage_meter_readings')
  );

drop policy if exists meters_select on public.meters;
create policy meters_select on public.meters
  for select using (public.has_site_scope(site_id));

drop policy if exists meters_insert on public.meters;
create policy meters_insert on public.meters
  for insert with check (
    org_id = public.current_org_id()
    and public.has_site_scope(site_id)
    and public.has_permission('can_manage_meter_readings')
  );

drop policy if exists meters_update on public.meters;
create policy meters_update on public.meters
  for update using (public.has_site_scope(site_id))
  with check (
    org_id = public.current_org_id()
    and public.has_site_scope(site_id)
    and public.has_permission('can_manage_meter_readings')
  );

drop policy if exists meter_import_duplicate_groups_select on public.meter_import_duplicate_groups;
create policy meter_import_duplicate_groups_select on public.meter_import_duplicate_groups
  for select using (public.has_site_scope((select site_id from public.pitches where id = pitch_id)));

drop policy if exists meter_import_duplicate_groups_update on public.meter_import_duplicate_groups;
create policy meter_import_duplicate_groups_update on public.meter_import_duplicate_groups
  for update using (public.has_site_scope((select site_id from public.pitches where id = pitch_id)))
  with check (public.has_permission('can_manage_meter_readings'));

drop policy if exists meter_readings_select on public.meter_readings;
create policy meter_readings_select on public.meter_readings
  for select using (public.has_site_scope(site_id));

drop policy if exists meter_readings_insert on public.meter_readings;
create policy meter_readings_insert on public.meter_readings
  for insert with check (
    org_id = public.current_org_id()
    and public.has_site_scope(site_id)
    and taken_by_profile_id = auth.uid()
  );

drop policy if exists meter_reading_settings_select on public.meter_reading_settings;
create policy meter_reading_settings_select on public.meter_reading_settings
  for select using (public.has_site_scope(site_id));

drop policy if exists meter_reading_settings_upsert on public.meter_reading_settings;
create policy meter_reading_settings_upsert on public.meter_reading_settings
  for insert with check (public.has_site_scope(site_id) and public.has_permission('can_manage_meter_readings'));

drop policy if exists meter_reading_settings_update on public.meter_reading_settings;
create policy meter_reading_settings_update on public.meter_reading_settings
  for update using (public.has_site_scope(site_id))
  with check (public.has_permission('can_manage_meter_readings'));

-- Meter CSV export reuses the existing export_logs audit trail
-- (18-equipment-checkout-log-admin.sql already widened export_logs_insert
-- past its original can_export_jobs-only check) -- widen it once more
-- rather than introducing a parallel audit table for one more export
-- surface.
drop policy if exists export_logs_insert on public.export_logs;
create policy export_logs_insert on public.export_logs
  for insert with check (
    org_id = public.current_org_id()
    and exported_by = auth.uid()
    and (
      public.has_permission('can_export_jobs')
      or public.has_permission('can_manage_equipment_status')
      or public.has_permission('can_manage_meter_readings')
    )
  );

-- ---------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('meter-photos', 'meter-photos', false)
on conflict (id) do nothing;

drop policy if exists meter_photos_storage_select on storage.objects;
create policy meter_photos_storage_select on storage.objects
  for select using (
    bucket_id = 'meter-photos'
    and public.can_see_meter(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists meter_photos_storage_insert on storage.objects;
create policy meter_photos_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'meter-photos'
    and public.can_see_meter(((storage.foldername(name))[1])::uuid)
  );

-- ---------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------

-- Imports both CSVs' rows in one transaction: creates the batch, inserts
-- every row into meters (resolving pitch_id by matching the CSV Site
-- against pitches.pitch_number_or_name), and for any pitch+type with more
-- than one row, picks the most recent last_read_date as is_current and
-- records a meter_import_duplicate_groups row for review. p_rows shape:
-- [{external_meter_id, meter_type, site_code, make, model, customer_name,
--   connected, last_read_date, last_reading, cost_per_unit, vat_rate}, ...]
-- Returns {batch_id, inserted_count, unmatched_site_codes, duplicate_group_count}.
create or replace function public.import_meters(
  p_rows jsonb,
  p_site_id uuid,
  p_electric_filename text,
  p_gas_filename text
)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_batch_id uuid;
  v_row jsonb;
  v_pitch_id uuid;
  v_unmatched text[] := '{}';
  v_inserted int := 0;
  v_dup record;
  v_dup_count int := 0;
begin
  if not public.has_site_scope(p_site_id) or not public.has_permission('can_manage_meter_readings') then
    raise exception 'Not permitted to import meter readings';
  end if;

  insert into public.meter_import_batches (org_id, site_id, imported_by, electric_filename, gas_filename)
  values (public.current_org_id(), p_site_id, auth.uid(), p_electric_filename, p_gas_filename)
  returning id into v_batch_id;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    select id into v_pitch_id
    from public.pitches
    where site_id = p_site_id and pitch_number_or_name = (v_row->>'site_code');

    if v_pitch_id is null then
      v_unmatched := array_append(v_unmatched, v_row->>'site_code');
      continue;
    end if;

    insert into public.meters (
      org_id, site_id, pitch_id, external_meter_id, meter_type, qr_code,
      make, model, customer_name, connected, last_read_date, last_reading,
      cost_per_unit, vat_rate, is_current, import_batch_id
    ) values (
      public.current_org_id(), p_site_id, v_pitch_id,
      v_row->>'external_meter_id', v_row->>'meter_type',
      (v_row->>'site_code') || '-' || case (v_row->>'meter_type') when 'electric' then 'ELEC' else 'GAS' end,
      v_row->>'make', v_row->>'model', v_row->>'customer_name',
      coalesce((v_row->>'connected')::boolean, true),
      nullif(v_row->>'last_read_date', '')::date,
      nullif(v_row->>'last_reading', '')::numeric,
      nullif(v_row->>'cost_per_unit', '')::numeric,
      nullif(v_row->>'vat_rate', '')::numeric,
      -- Marked false below for every meter in a duplicate group except the
      -- auto-picked one; true for a pitch+type with no duplicates.
      true,
      v_batch_id
    );
    v_inserted := v_inserted + 1;
  end loop;

  -- Duplicate detection: any pitch+type with more than one meter row from
  -- THIS batch. Auto-pick the most recent last_read_date as is_current,
  -- demote the rest, record the group for the importer to review.
  for v_dup in
    select pitch_id, meter_type, array_agg(external_meter_id order by last_read_date desc nulls last) as ids,
           (array_agg(id order by last_read_date desc nulls last))[1] as chosen_id,
           (array_agg(external_meter_id order by last_read_date desc nulls last))[1] as chosen_external_id
    from public.meters
    where import_batch_id = v_batch_id
    group by pitch_id, meter_type
    having count(*) > 1
  loop
    update public.meters set is_current = (id = v_dup.chosen_id)
    where import_batch_id = v_batch_id and pitch_id = v_dup.pitch_id and meter_type = v_dup.meter_type;

    insert into public.meter_import_duplicate_groups (import_batch_id, pitch_id, meter_type, candidate_meter_ids, chosen_meter_id)
    values (v_batch_id, v_dup.pitch_id, v_dup.meter_type, v_dup.ids, v_dup.chosen_external_id);

    v_dup_count := v_dup_count + 1;
  end loop;

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'inserted_count', v_inserted,
    'unmatched_site_codes', to_jsonb(v_unmatched),
    'duplicate_group_count', v_dup_count
  );
end;
$$;

create or replace function public.resolve_import_duplicate(
  p_group_id uuid,
  p_chosen_external_meter_id text
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_group public.meter_import_duplicate_groups;
begin
  select * into v_group from public.meter_import_duplicate_groups where id = p_group_id;
  if v_group is null then
    raise exception 'Duplicate group not found';
  end if;
  if not public.has_permission('can_manage_meter_readings') then
    raise exception 'Not permitted to resolve meter duplicates';
  end if;

  update public.meters
  set is_current = (external_meter_id = p_chosen_external_meter_id and import_batch_id = v_group.import_batch_id)
  where import_batch_id = v_group.import_batch_id
    and pitch_id = v_group.pitch_id
    and meter_type = v_group.meter_type;

  update public.meter_import_duplicate_groups
  set resolved = true, resolved_by = auth.uid(), resolved_at = now(), chosen_meter_id = p_chosen_external_meter_id
  where id = p_group_id;
end;
$$;

-- Marks a set of readings exported and rolls each one's value/date into
-- its parent meter's last_reading/last_read_date, so the next round's
-- confirm screen doesn't show a stale "last reading."
create or replace function public.mark_readings_exported(p_reading_ids uuid[])
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.has_permission('can_manage_meter_readings') then
    raise exception 'Not permitted to export meter readings';
  end if;

  update public.meters m
  set last_reading = r.reading_value, last_read_date = r.read_at::date
  from public.meter_readings r
  where r.id = any(p_reading_ids) and r.meter_id = m.id and public.has_site_scope(m.site_id);

  update public.meter_readings
  set exported_at = now()
  where id = any(p_reading_ids) and public.has_site_scope(site_id);
end;
$$;

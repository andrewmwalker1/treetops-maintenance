-- Tree Tops Maintenance Platform -- License Agreement Builder
-- Run after 67-office-hub-private-bucket.sql.
--
-- A shared, org-wide picklist of predefined "Special instructions" text
-- for Step 3 of the wizard, so staff aren't retyping the same wording
-- (e.g. seasonal rates clauses) sale after sale. No new permission: read
-- access follows can_use_license_agreement (anyone in the wizard can see
-- the picklist), and write access follows can_use_office_hub -- day-to-day
-- sales wording, not the shared pricing tables gated by
-- can_manage_license_agreement_settings, so anyone with office hub access
-- can keep it current.
create table if not exists public.license_agreement_standard_instructions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  label text not null,
  body_text text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.license_agreement_standard_instructions enable row level security;

drop policy if exists license_agreement_standard_instructions_select on public.license_agreement_standard_instructions;
create policy license_agreement_standard_instructions_select on public.license_agreement_standard_instructions
  for select using (org_id = public.current_org_id() and public.has_permission('can_use_license_agreement'));

drop policy if exists license_agreement_standard_instructions_write on public.license_agreement_standard_instructions;
create policy license_agreement_standard_instructions_write on public.license_agreement_standard_instructions
  for all
  using (org_id = public.current_org_id() and public.has_permission('can_use_office_hub'))
  with check (org_id = public.current_org_id() and public.has_permission('can_use_office_hub'));

-- Tree Tops Maintenance Platform -- Caravan Sale Tracker. One record per
-- caravan sale (Office Hub's new "Sales" tab), tracking it from order
-- through to the customer being live on insurance cover. See the Build
-- Spec (linked from CLAUDE.md's git history / PR description) for the
-- full decision trail.
-- Run after 94-holiday-year-balances.sql.
-- Idempotent, safe to re-run.

create table if not exists public.caravan_sales (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,

  -- Customer
  title text,
  forename text not null,
  surname text not null,
  address_line1 text,
  address_line2 text,
  postcode text,
  phone1 text,
  phone2 text,
  email1 text,
  email2 text,
  car_registration text,

  -- Caravan
  caravan_make text,
  caravan_model text,
  caravan_year text,
  caravan_condition text check (caravan_condition in ('new', 'pre-owned')),
  pitch_id uuid references public.pitches(id) on delete set null,
  licence_term text,
  handover_date date,

  -- Details of sale -- shaped to match the License Agreement tool's own
  -- price model (license-agreement/calculations.js): window_price is the
  -- one headline agreed figure; pitch fee / rates / included items net
  -- INTO it (itemised for transparency, not added on top); additional
  -- items are the only things actually added on top; deposit and
  -- part-exchange are payments against the total (reduce the balance
  -- due), not price-reducing line items.
  window_price numeric(10,2) not null default 0,
  rates_current_year numeric(10,2) not null default 0,
  pitch_fee_amount numeric(10,2) not null default 0,
  pitch_fee_included boolean not null default true,
  included_items jsonb not null default '[]'::jsonb,
  additional_items jsonb not null default '[]'::jsonb,
  deposit_amount numeric(10,2) not null default 0,
  deposit_date date,
  part_exchange_amount numeric(10,2) not null default 0,
  part_exchange_date date,

  -- Meter readings -- plain fields, not a linked job.
  meter_reading_gas text,
  meter_reading_electric text,
  meter_reading_date date,

  -- Systems & docs
  campmanager_done boolean not null default false,
  campmanager_date date,
  compass_done boolean not null default false,
  agreement_created boolean not null default false,
  agreement_signed_filed boolean not null default false,

  -- Insurance -- payment taken is deliberately absent here: purchase
  -- payment is tracked in a closed external system already, not
  -- duplicated in this tool.
  insurance_quote_raised boolean not null default false,
  insurance_payment_confirmed boolean not null default false,
  customer_on_cover boolean not null default false,

  notes text,
  is_complete boolean not null default false,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.caravan_sales to anon, authenticated, service_role;

create index if not exists caravan_sales_org_site_idx on public.caravan_sales (org_id, site_id);

-- Per-table updated_at trigger -- this codebase has no single shared
-- helper function for this; every mutable table gets its own (see e.g.
-- 78-timesheet-week-notes.sql, 94-holiday-year-balances.sql).
create or replace function public.caravan_sales_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists caravan_sales_updated_at on public.caravan_sales;
create trigger caravan_sales_updated_at
  before update on public.caravan_sales
  for each row execute function public.caravan_sales_set_updated_at();

alter table public.caravan_sales enable row level security;

drop policy if exists caravan_sales_all on public.caravan_sales;
create policy caravan_sales_all on public.caravan_sales
  for all
  using (org_id = public.current_org_id() and public.has_permission('can_use_caravan_sales'))
  with check (org_id = public.current_org_id() and public.has_permission('can_use_caravan_sales'));

-- jobs.sale_id -- added here, after caravan_sales exists, mirroring how
-- jobs.schedule_id already references the scheduler feature's own table.
-- A NEW column: jobs.parent_job_id (79-linked-jobs.sql) is a hard FK to
-- jobs(id) only, strictly job-to-job, not reusable for linking a job to
-- a non-job record.
alter table public.jobs add column if not exists sale_id uuid references public.caravan_sales(id) on delete set null;

-- Tags which of the Sale Tracker's three fixed job slots a linked job
-- is, so the detail page can show "Prep caravan: <status>" reliably
-- regardless of which job_type template was picked for it, rather than
-- guessing from the template's name.
alter table public.jobs add column if not exists sale_role text;
do $$ begin
  alter table public.jobs
    add constraint jobs_sale_role_check check (sale_role is null or sale_role in ('prep', 'gas_test', 'electric_test'));
exception when duplicate_object then null; end $$;

create index if not exists jobs_sale_id_idx on public.jobs (sale_id) where sale_id is not null;

-- One permission covers the whole tab, data entry included -- matching
-- can_use_license_agreement's shape (that tool has no separate
-- data-entry permission, only a *_settings one for template admin, which
-- this feature has no equivalent of).
insert into public.permissions (key, description) values
  ('can_use_caravan_sales', 'Can see and use the Caravan Sale Tracker on Office Hub')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, 'can_use_caravan_sales', true
from public.roles r
where r.name = 'Admin'
  and r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
on conflict do nothing;

-- Tree Tops Maintenance Platform -- Office Hub
-- Run after 61-checklist-section-headings.sql.
--
-- Office Hub is a separate app (own repo, own domain
-- office.treetops.co.uk) but deliberately reuses THIS app's schema,
-- staff accounts and roles rather than inventing its own -- whoever
-- already has a Maintenance login can sign into Office Hub with the
-- same email/OTP, no separate account. See treetops-office-hub's
-- PROJECT-BRIEF.md for the app-side detail.
--
-- Two new permissions, following the exact pattern already used by
-- 32-checklist-item-photo-requirement.sql: insert into permissions +
-- role_permissions, keyed by role name via the org's name (never a
-- hardcoded org id, since a second org could exist one day).
insert into public.permissions (key, description) values
  ('can_use_office_hub', 'Can see and use the Office Hub dashboard'),
  ('can_manage_office_hub_catalog', 'Can add/edit/delete Office Hub links and documents')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, p.key, true
from public.roles r
cross join (values ('can_use_office_hub'), ('can_manage_office_hub_catalog')) as p(key)
where r.name = 'Admin'
  and r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, 'can_use_office_hub', true
from public.roles r
where r.name in ('Head Gardener', 'Office')
  and r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Catalog: categorised links and documents, admin-managed
-- ---------------------------------------------------------------------

create table if not exists public.office_hub_link_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create table if not exists public.office_hub_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  category_id uuid references public.office_hub_link_categories(id) on delete set null,
  label text not null,
  url text not null,
  description text,
  sort_order int not null default 0
);

create table if not exists public.office_hub_doc_categories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create table if not exists public.office_hub_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  category_id uuid references public.office_hub_doc_categories(id) on delete set null,
  title text not null,
  file_url text not null,
  description text,
  sort_order int not null default 0
);

-- ---------------------------------------------------------------------
-- Each user's own pinned items -- scoped to links/documents only
-- (v1 scope: "their most used functions or documents", not
-- contractors/places-to-eat, which stay browse-only).
-- ---------------------------------------------------------------------

create table if not exists public.office_hub_dashboard_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  item_type text not null check (item_type in ('link', 'document')),
  item_id uuid not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (profile_id, item_type, item_id)
);

-- ---------------------------------------------------------------------
-- RLS -- reuses the existing current_org_id()/has_permission() helpers
-- from 02-rls-policies.sql. No new security-definer function needed;
-- none of these policies read another table's protected rows the way
-- can_see_job()/can_see_equipment() do.
-- ---------------------------------------------------------------------

alter table public.office_hub_link_categories enable row level security;
alter table public.office_hub_links enable row level security;
alter table public.office_hub_doc_categories enable row level security;
alter table public.office_hub_documents enable row level security;
alter table public.office_hub_dashboard_items enable row level security;

drop policy if exists office_hub_link_categories_select on public.office_hub_link_categories;
create policy office_hub_link_categories_select on public.office_hub_link_categories
  for select using (org_id = public.current_org_id() and public.has_permission('can_use_office_hub'));

drop policy if exists office_hub_link_categories_write on public.office_hub_link_categories;
create policy office_hub_link_categories_write on public.office_hub_link_categories
  for all
  using (org_id = public.current_org_id() and public.has_permission('can_manage_office_hub_catalog'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_office_hub_catalog'));

drop policy if exists office_hub_links_select on public.office_hub_links;
create policy office_hub_links_select on public.office_hub_links
  for select using (org_id = public.current_org_id() and public.has_permission('can_use_office_hub'));

drop policy if exists office_hub_links_write on public.office_hub_links;
create policy office_hub_links_write on public.office_hub_links
  for all
  using (org_id = public.current_org_id() and public.has_permission('can_manage_office_hub_catalog'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_office_hub_catalog'));

drop policy if exists office_hub_doc_categories_select on public.office_hub_doc_categories;
create policy office_hub_doc_categories_select on public.office_hub_doc_categories
  for select using (org_id = public.current_org_id() and public.has_permission('can_use_office_hub'));

drop policy if exists office_hub_doc_categories_write on public.office_hub_doc_categories;
create policy office_hub_doc_categories_write on public.office_hub_doc_categories
  for all
  using (org_id = public.current_org_id() and public.has_permission('can_manage_office_hub_catalog'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_office_hub_catalog'));

drop policy if exists office_hub_documents_select on public.office_hub_documents;
create policy office_hub_documents_select on public.office_hub_documents
  for select using (org_id = public.current_org_id() and public.has_permission('can_use_office_hub'));

drop policy if exists office_hub_documents_write on public.office_hub_documents;
create policy office_hub_documents_write on public.office_hub_documents
  for all
  using (org_id = public.current_org_id() and public.has_permission('can_manage_office_hub_catalog'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_office_hub_catalog'));

drop policy if exists office_hub_dashboard_items_all on public.office_hub_dashboard_items;
create policy office_hub_dashboard_items_all on public.office_hub_dashboard_items
  for all
  using (profile_id = auth.uid() and public.has_permission('can_use_office_hub'))
  with check (profile_id = auth.uid() and public.has_permission('can_use_office_hub'));

-- ---------------------------------------------------------------------
-- Storage -- a dedicated bucket, not Hub's `info-pdfs` (that bucket's
-- insert policy checks hub.is_hub_admin(), which an Office Hub admin
-- wouldn't satisfy -- these are two different apps' notion of "admin").
--
-- Manual step (no Supabase CLI/MCP access from this environment):
-- create the "office-hub-files" bucket via the Supabase dashboard
-- (Storage -> New bucket -> Public bucket ON) before this policy does
-- anything useful -- marking a bucket public only allows anonymous
-- *reads*; this policy is what allows an Office Hub admin to *upload*.
-- ---------------------------------------------------------------------

drop policy if exists office_hub_files_insert_admin on storage.objects;
create policy office_hub_files_insert_admin on storage.objects
  for insert
  with check (bucket_id = 'office-hub-files' and public.has_permission('can_manage_office_hub_catalog'));

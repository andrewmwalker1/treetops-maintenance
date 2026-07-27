-- Tree Tops Maintenance Platform — activity types + RA/MS library
-- Restructures H&S linkage per Andy's design (2026-07-27):
--   - Activity types (task_types) are selected against a JOB AS A WHOLE
--     (many-to-many, zero or more per job) — not inherited from a single
--     job_type as originally built.
--   - Risk assessments and method statements live in one reusable
--     library, attached to activity types many-to-many (one document can
--     cover several activities; one activity can need several documents).
-- Supersedes the original 1:1 task_type -> risk_assessment design from
-- 01-schema.sql. No data existed in the old risk_assessments table, so
-- this drops it outright rather than migrating rows.
--
-- Run after 01-schema.sql through 05-seed-pitches.sql.

-- ---------------------------------------------------------------------
-- Drop superseded structures
-- ---------------------------------------------------------------------

alter table public.task_types drop constraint if exists task_types_risk_assessment_id_fkey;
alter table public.task_types drop column if exists risk_assessment_id;
drop table if exists public.risk_assessments;

-- job_types no longer carries a single task_type — activity types are
-- now chosen per-job directly (job_activity_types below).
alter table public.job_types drop constraint if exists job_types_task_type_id_fkey;
alter table public.job_types drop column if exists task_type_id;

-- ---------------------------------------------------------------------
-- RA/MS library
-- ---------------------------------------------------------------------

do $$ begin
  create type public.safety_document_type as enum ('risk_assessment', 'method_statement');
exception when duplicate_object then null; end $$;

create table if not exists public.ra_ms_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  type public.safety_document_type not null,
  title text not null,
  -- Secondary summary shown alongside the PDF link (Andy's "quick-glance"
  -- request) — optional, the PDF is authoritative.
  description text,
  pdf_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Activity types <-> library documents (many-to-many).
create table if not exists public.activity_type_documents (
  task_type_id uuid not null references public.task_types(id) on delete cascade,
  document_id uuid not null references public.ra_ms_documents(id) on delete cascade,
  primary key (task_type_id, document_id)
);

-- Jobs <-> activity types (many-to-many) — "zero or more activity types
-- per job", chosen independently of job_type.
create table if not exists public.job_activity_types (
  job_id uuid not null references public.jobs(id) on delete cascade,
  task_type_id uuid not null references public.task_types(id) on delete cascade,
  primary key (job_id, task_type_id)
);

-- ---------------------------------------------------------------------
-- New permissions
-- ---------------------------------------------------------------------

insert into public.permissions (key, description) values
  ('can_edit_job_checklist', 'Can add, remove, reorder, or rename checklist items on a job'),
  ('can_manage_reference_data', 'Can manage job templates, activity types, and the RA/MS library')
on conflict (key) do nothing;

-- Grant both to Tree Tops' Admin role (03-seed-treetops.sql's blanket
-- grant only covered permissions that existed at the time it ran).
insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, p.key, true
from public.roles r
cross join public.permissions p
where r.name = 'Admin'
  and r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
  and p.key in ('can_edit_job_checklist', 'can_manage_reference_data')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Helper function + trigger
-- ---------------------------------------------------------------------

create or replace function public.can_see_document(p_document_id uuid)
returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.ra_ms_documents d
    where d.id = p_document_id and d.org_id = public.current_org_id()
  );
$$;

-- Checking an item off never needs the permission; changing its text or
-- position does. Same shape as jobs_enforce_reallocation.
create or replace function public.enforce_job_subtask_edit_permission()
returns trigger as $$
begin
  if (new.label is distinct from old.label
      or new.sort_order is distinct from old.sort_order)
     and not public.has_permission('can_edit_job_checklist') then
    raise exception 'Editing checklist item text or order requires the can_edit_job_checklist permission';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists job_subtasks_enforce_edit on public.job_subtasks;
create trigger job_subtasks_enforce_edit
  before update on public.job_subtasks
  for each row execute function public.enforce_job_subtask_edit_permission();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table public.ra_ms_documents enable row level security;
alter table public.activity_type_documents enable row level security;
alter table public.job_activity_types enable row level security;

drop policy if exists ra_ms_documents_select on public.ra_ms_documents;
create policy ra_ms_documents_select on public.ra_ms_documents
  for select using (org_id = public.current_org_id());

drop policy if exists ra_ms_documents_insert on public.ra_ms_documents;
create policy ra_ms_documents_insert on public.ra_ms_documents
  for insert with check (org_id = public.current_org_id() and public.has_permission('can_manage_reference_data'));

drop policy if exists ra_ms_documents_update on public.ra_ms_documents;
create policy ra_ms_documents_update on public.ra_ms_documents
  for update using (org_id = public.current_org_id() and public.has_permission('can_manage_reference_data'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_reference_data'));

drop policy if exists ra_ms_documents_delete on public.ra_ms_documents;
create policy ra_ms_documents_delete on public.ra_ms_documents
  for delete using (org_id = public.current_org_id() and public.has_permission('can_manage_reference_data'));

drop policy if exists activity_type_documents_select on public.activity_type_documents;
create policy activity_type_documents_select on public.activity_type_documents
  for select using (
    exists (select 1 from public.task_types tt where tt.id = activity_type_documents.task_type_id and tt.org_id = public.current_org_id())
  );

drop policy if exists activity_type_documents_insert on public.activity_type_documents;
create policy activity_type_documents_insert on public.activity_type_documents
  for insert with check (
    exists (select 1 from public.task_types tt where tt.id = activity_type_documents.task_type_id and tt.org_id = public.current_org_id())
    and public.has_permission('can_manage_reference_data')
  );

drop policy if exists activity_type_documents_delete on public.activity_type_documents;
create policy activity_type_documents_delete on public.activity_type_documents
  for delete using (
    exists (select 1 from public.task_types tt where tt.id = activity_type_documents.task_type_id and tt.org_id = public.current_org_id())
    and public.has_permission('can_manage_reference_data')
  );

-- Activity type selection on a job is treated as ordinary job metadata
-- (like priority or location), not checklist editing — anyone who can
-- see/create the job can set it, so operatives reporting their own jobs
-- still get the right safety info surfaced.
drop policy if exists job_activity_types_select on public.job_activity_types;
create policy job_activity_types_select on public.job_activity_types
  for select using (public.can_see_job(job_id));

drop policy if exists job_activity_types_insert on public.job_activity_types;
create policy job_activity_types_insert on public.job_activity_types
  for insert with check (public.can_see_job(job_id));

drop policy if exists job_activity_types_delete on public.job_activity_types;
create policy job_activity_types_delete on public.job_activity_types
  for delete using (public.can_see_job(job_id));

-- Insert stays open to whoever can see the job (unchanged from
-- 02-rls-policies.sql) — someone without can_edit_job_checklist still
-- needs to be able to apply a template's default checklist (or type one
-- in) when they create a job. What the permission actually locks down is
-- REMOVING or changing items afterward: delete requires it outright, and
-- the trigger above requires it for renaming/reordering an existing row
-- (checking one off does not). This is a judgement call on an ambiguous
-- point — RLS can't tell "applying a template at creation" apart from
-- "adding an item later," so if Andy wants creation-time additions
-- locked down too, insert would need the permission as well, at the cost
-- of operatives being unable to get any checklist onto jobs they create
-- themselves.
drop policy if exists job_subtasks_delete on public.job_subtasks;
create policy job_subtasks_delete on public.job_subtasks
  for delete using (public.can_see_job(job_id) and public.has_permission('can_edit_job_checklist'));

-- job_types.name doubles as the template picker; task_types (activity
-- types) get insert/update/delete for the admin section, gated the same
-- way as the rest of org reference data.
drop policy if exists task_types_insert on public.task_types;
create policy task_types_insert on public.task_types
  for insert with check (org_id = public.current_org_id() and public.has_permission('can_manage_reference_data'));

drop policy if exists task_types_update on public.task_types;
create policy task_types_update on public.task_types
  for update using (org_id = public.current_org_id() and public.has_permission('can_manage_reference_data'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_reference_data'));

drop policy if exists task_types_delete on public.task_types;
create policy task_types_delete on public.task_types
  for delete using (org_id = public.current_org_id() and public.has_permission('can_manage_reference_data'));

drop policy if exists job_types_insert on public.job_types;
create policy job_types_insert on public.job_types
  for insert with check (org_id = public.current_org_id() and public.has_permission('can_manage_reference_data'));

drop policy if exists job_types_update on public.job_types;
create policy job_types_update on public.job_types
  for update using (org_id = public.current_org_id() and public.has_permission('can_manage_reference_data'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_reference_data'));

drop policy if exists job_types_delete on public.job_types;
create policy job_types_delete on public.job_types
  for delete using (org_id = public.current_org_id() and public.has_permission('can_manage_reference_data'));

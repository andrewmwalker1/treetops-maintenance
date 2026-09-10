-- Tree Tops Maintenance Platform -- documents (JPG or PDF) attached to
-- individual equipment items, with the same optional-expiry reminder
-- pattern as contractor documents (29-contractor-documents.sql). Run
-- after 64-license-agreement-template-upload.sql.
--
-- Some equipment documents are pure reference (an invoice for a repair,
-- a manual) with no expiry; others are date-critical (Gas Test certs on
-- staff room boilers, MOT certs on vehicles) and need the same "raise a
-- job before it lapses" behaviour Andy already has for contractors.
-- equipment_documents is one row per document, not one blob per item, so
-- a machine with both an MOT and a service invoice tracks each
-- independently -- structurally and behaviourally this is
-- contractor_documents with equipment_id swapped in for contractor_id.
--
-- reminder_triggered_at / reminder_job_id / the reset-on-expiry-change
-- trigger all work exactly as they do for contractor documents -- see
-- 29-contractor-documents.sql for the full rationale, not repeated here.
--
-- Gated entirely behind can_manage_equipment_status, the same permission
-- the Equipment admin screen itself requires -- like contractor
-- documents, SELECT is gated too (compliance-sensitive), not just
-- insert/update/delete.

create table if not exists public.equipment_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  description text not null,
  expiry_date date,
  storage_path text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  reminder_triggered_at timestamptz,
  reminder_job_id uuid references public.jobs(id) on delete set null
);
create index if not exists equipment_documents_equipment_idx on public.equipment_documents (equipment_id);
-- What the reminder function scans every day: documents with an expiry
-- that haven't had their reminder cycle triggered yet.
create index if not exists equipment_documents_pending_reminder_idx
  on public.equipment_documents (expiry_date)
  where expiry_date is not null and reminder_triggered_at is null;

alter table public.equipment_documents enable row level security;

drop policy if exists equipment_documents_select on public.equipment_documents;
create policy equipment_documents_select on public.equipment_documents
  for select using (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'));

drop policy if exists equipment_documents_insert on public.equipment_documents;
create policy equipment_documents_insert on public.equipment_documents
  for insert with check (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'));

drop policy if exists equipment_documents_update on public.equipment_documents;
create policy equipment_documents_update on public.equipment_documents
  for update using (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'));

drop policy if exists equipment_documents_delete on public.equipment_documents;
create policy equipment_documents_delete on public.equipment_documents
  for delete using (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'));

create or replace function public.reset_equipment_document_reminder()
returns trigger as $$
begin
  if new.expiry_date is distinct from old.expiry_date then
    new.reminder_triggered_at := null;
    new.reminder_job_id := null;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists equipment_documents_reset_reminder on public.equipment_documents;
create trigger equipment_documents_reset_reminder
  before update on public.equipment_documents
  for each row execute function public.reset_equipment_document_reminder();

-- ---------------------------------------------------------------------
-- Storage: private bucket, path convention `<equipment_id>/<filename>`
-- (same pattern as contractor-documents).
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('equipment-documents', 'equipment-documents', false)
on conflict (id) do nothing;

create or replace function public.can_manage_equipment_document(p_equipment_id uuid)
returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.equipment e
    where e.id = p_equipment_id and e.org_id = public.current_org_id()
  ) and public.has_permission('can_manage_equipment_status');
$$;

drop policy if exists equipment_documents_storage_select on storage.objects;
create policy equipment_documents_storage_select on storage.objects
  for select using (
    bucket_id = 'equipment-documents'
    and public.can_manage_equipment_document(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists equipment_documents_storage_insert on storage.objects;
create policy equipment_documents_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'equipment-documents'
    and public.can_manage_equipment_document(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists equipment_documents_storage_delete on storage.objects;
create policy equipment_documents_storage_delete on storage.objects
  for delete using (
    bucket_id = 'equipment-documents'
    and public.can_manage_equipment_document(((storage.foldername(name))[1])::uuid)
  );

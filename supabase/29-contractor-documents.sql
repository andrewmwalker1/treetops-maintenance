-- Tree Tops Maintenance Platform -- contractor documents (proof of
-- qualifications, insurance, H&S) with expiry reminders
-- Run after 28-job-activity-types-edit-permission.sql.
--
-- One contractor can hold several documents, each expiring on its own
-- schedule (e.g. insurance renews yearly, a qualification every 3 years) --
-- contractor_documents is one row per document, not one blob per
-- contractor, so each can be tracked and reminded independently.
--
-- reminder_triggered_at gates the daily contractor-document-reminders Edge
-- Function (deployed separately): once set, that document's *current*
-- expiry has already had its Office job + contractor email, so the
-- function won't repeat it every day between the 7-day mark and expiry.
-- The reset trigger below clears it whenever expiry_date changes (a
-- renewed document -- new expiry, new PDF -- earns a fresh reminder
-- cycle), so admin never has to remember to clear the flag by hand.
-- reminder_job_id is kept alongside purely so admin can click through to
-- the job that was raised, same spirit as jobs.schedule_id.
--
-- Gated entirely behind can_manage_contractors, same permission as the
-- Contractors admin screen itself (21-contractors-and-groups-admin.sql) --
-- unlike contractors_select (org-wide, no permission needed), these are
-- compliance-sensitive documents so SELECT is gated too, not just
-- insert/update/delete.

create table if not exists public.contractor_documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  contractor_id uuid not null references public.contractors(id) on delete cascade,
  description text not null,
  expiry_date date,
  storage_path text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  reminder_triggered_at timestamptz,
  reminder_job_id uuid references public.jobs(id) on delete set null
);
create index if not exists contractor_documents_contractor_idx on public.contractor_documents (contractor_id);
-- What the reminder function scans every day: documents with an expiry
-- that haven't had their reminder cycle triggered yet.
create index if not exists contractor_documents_pending_reminder_idx
  on public.contractor_documents (expiry_date)
  where expiry_date is not null and reminder_triggered_at is null;

alter table public.contractor_documents enable row level security;

drop policy if exists contractor_documents_select on public.contractor_documents;
create policy contractor_documents_select on public.contractor_documents
  for select using (org_id = public.current_org_id() and public.has_permission('can_manage_contractors'));

drop policy if exists contractor_documents_insert on public.contractor_documents;
create policy contractor_documents_insert on public.contractor_documents
  for insert with check (org_id = public.current_org_id() and public.has_permission('can_manage_contractors'));

drop policy if exists contractor_documents_update on public.contractor_documents;
create policy contractor_documents_update on public.contractor_documents
  for update using (org_id = public.current_org_id() and public.has_permission('can_manage_contractors'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_contractors'));

drop policy if exists contractor_documents_delete on public.contractor_documents;
create policy contractor_documents_delete on public.contractor_documents
  for delete using (org_id = public.current_org_id() and public.has_permission('can_manage_contractors'));

create or replace function public.reset_contractor_document_reminder()
returns trigger as $$
begin
  if new.expiry_date is distinct from old.expiry_date then
    new.reminder_triggered_at := null;
    new.reminder_job_id := null;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists contractor_documents_reset_reminder on public.contractor_documents;
create trigger contractor_documents_reset_reminder
  before update on public.contractor_documents
  for each row execute function public.reset_contractor_document_reminder();

-- ---------------------------------------------------------------------
-- Storage: private bucket, path convention `<contractor_id>/<filename>`
-- (same upload-after-insert-or-upsert pattern as ra-ms-pdfs).
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('contractor-documents', 'contractor-documents', false)
on conflict (id) do nothing;

create or replace function public.can_manage_contractor_document(p_contractor_id uuid)
returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.contractors c
    where c.id = p_contractor_id and c.org_id = public.current_org_id()
  ) and public.has_permission('can_manage_contractors');
$$;

drop policy if exists contractor_documents_storage_select on storage.objects;
create policy contractor_documents_storage_select on storage.objects
  for select using (
    bucket_id = 'contractor-documents'
    and public.can_manage_contractor_document(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists contractor_documents_storage_insert on storage.objects;
create policy contractor_documents_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'contractor-documents'
    and public.can_manage_contractor_document(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists contractor_documents_storage_delete on storage.objects;
create policy contractor_documents_storage_delete on storage.objects
  for delete using (
    bucket_id = 'contractor-documents'
    and public.can_manage_contractor_document(((storage.foldername(name))[1])::uuid)
  );

-- Tree Tops Maintenance Platform — storage bucket for RA/MS PDFs
-- Run after 06-activity-types-and-safety-library.sql.
--
-- Private bucket, path convention `<document_id>/<filename>`. The app
-- creates the ra_ms_documents row first (with a client-generated id and
-- pdf_storage_path left null), then uploads to that id, then updates the
-- row — avoiding a chicken-and-egg path/RLS problem. Because of that,
-- insert only needs the permission check; the document row already
-- carries the right org_id by the time anything is uploaded to it.

insert into storage.buckets (id, name, public)
values ('ra-ms-pdfs', 'ra-ms-pdfs', false)
on conflict (id) do nothing;

drop policy if exists ra_ms_pdfs_storage_select on storage.objects;
create policy ra_ms_pdfs_storage_select on storage.objects
  for select using (
    bucket_id = 'ra-ms-pdfs'
    and public.can_see_document(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists ra_ms_pdfs_storage_insert on storage.objects;
create policy ra_ms_pdfs_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'ra-ms-pdfs'
    and public.has_permission('can_manage_reference_data')
  );

drop policy if exists ra_ms_pdfs_storage_delete on storage.objects;
create policy ra_ms_pdfs_storage_delete on storage.objects
  for delete using (
    bucket_id = 'ra-ms-pdfs'
    and public.has_permission('can_manage_reference_data')
  );

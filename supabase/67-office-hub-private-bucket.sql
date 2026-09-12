-- Tree Tops Maintenance Platform -- Office Hub storage security fix.
-- Run after 66-office-hub-tile-style.sql.
--
-- 62-office-hub.sql's own comment instructed creating "office-hub-files"
-- as a PUBLIC bucket, on the reasoning that only the *insert* needed
-- gating -- but a public bucket serves anonymous reads of any object to
-- anyone with its URL, no RLS check at all, which silently bypassed the
-- can_use_office_hub permission gate the office_hub_documents *table*
-- enforces. Every other document type in this schema (contractor
-- documents, equipment documents, RA/MS PDFs, license-agreement
-- uploads) uses a private bucket with a matching storage.objects SELECT
-- policy -- this brings Office Hub in line with that pattern.
--
-- Idempotent: safe to re-run.

-- Flip the bucket private (creates it if the manual dashboard step was
-- somehow never done, same insert-into-storage.buckets approach already
-- used by 29-contractor-documents.sql / 65-equipment-documents.sql).
insert into storage.buckets (id, name, public)
values ('office-hub-files', 'office-hub-files', false)
on conflict (id) do update set public = false;

-- Existing rows' file_url holds a full public URL from the old
-- getPublicUrl() call (src/pages/admin/OfficeHubTab.jsx). The app now
-- treats file_url as a bare storage path and resolves a signed URL from
-- it on demand (see useSignedDocUrl in src/pages/OfficeHub.jsx), so
-- strip the now-defunct public-URL prefix off any row that still has
-- one. Only matches the old format, so this is a no-op once already run.
update public.office_hub_documents
set file_url = regexp_replace(file_url, '^.*/storage/v1/object/public/office-hub-files/', '')
where file_url ~ '/storage/v1/object/public/office-hub-files/';

-- The gate a public bucket couldn't enforce: same permission check as
-- office_hub_documents_select (62-office-hub.sql). No org_id scoping
-- here (storage.objects has no such column, and the upload path is a
-- flat `<timestamp>-<uuid>-<filename>`, not folder-scoped by org) --
-- consistent with office_hub_dashboard_items_all, which likewise relies
-- on has_permission() alone rather than an explicit org check.
drop policy if exists office_hub_files_select on storage.objects;
create policy office_hub_files_select on storage.objects
  for select using (
    bucket_id = 'office-hub-files'
    and public.has_permission('can_use_office_hub')
  );

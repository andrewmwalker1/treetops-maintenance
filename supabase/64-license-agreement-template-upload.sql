-- Tree Tops Maintenance Platform -- in-app License Agreement template upload
-- Run after 63-license-agreement.sql.
--
-- Adds the piece deliberately deferred when License Agreement Builder
-- was first merged in: letting an admin upload and convert an edited
-- Word template from inside the app itself, so a wording change
-- doesn't need a Claude Code session if Andy's away. Private bucket +
-- RLS, matching job-photos/fault-photos' pattern (04-storage.sql)
-- rather than a public bucket -- consistent with how the rest of this
-- app's storage is gated by permission, not just "not linked publicly".

insert into storage.buckets (id, name, public)
values ('license-agreement-files', 'license-agreement-files', false)
on conflict (id) do nothing;

drop policy if exists license_agreement_files_select on storage.objects;
create policy license_agreement_files_select on storage.objects
  for select using (
    bucket_id = 'license-agreement-files'
    and public.has_permission('can_use_license_agreement')
  );

drop policy if exists license_agreement_files_insert on storage.objects;
create policy license_agreement_files_insert on storage.objects
  for insert with check (
    bucket_id = 'license-agreement-files'
    and public.has_permission('can_manage_license_agreement_settings')
  );

drop policy if exists license_agreement_files_delete on storage.objects;
create policy license_agreement_files_delete on storage.objects
  for delete using (
    bucket_id = 'license-agreement-files'
    and public.has_permission('can_manage_license_agreement_settings')
  );

-- null = use the bundled default template shipped in public/license-agreement/.
alter table public.license_agreement_settings add column if not exists template_storage_path text;
alter table public.license_agreement_settings add column if not exists template_file_name text;
alter table public.license_agreement_settings add column if not exists template_uploaded_at timestamptz;

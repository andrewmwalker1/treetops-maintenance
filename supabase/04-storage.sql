-- Tree Tops Maintenance Platform — Storage buckets for photos
-- (job completion/subtask photos and equipment fault photos).
-- Run after 01-schema.sql through 03-seed-treetops.sql.
--
-- Both buckets are private; access is enforced by RLS on storage.objects
-- using the same can_see_job() / can_see_equipment() functions the table
-- RLS uses (Section 4). Upload path convention (enforced by the app, not
-- the database): `<job_id>/<filename>` for job-photos,
-- `<equipment_id>/<filename>` for fault-photos — the first path segment
-- is read back out via storage.foldername(name).

insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('fault-photos', 'fault-photos', false)
on conflict (id) do nothing;

drop policy if exists job_photos_storage_select on storage.objects;
create policy job_photos_storage_select on storage.objects
  for select using (
    bucket_id = 'job-photos'
    and public.can_see_job(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists job_photos_storage_insert on storage.objects;
create policy job_photos_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'job-photos'
    and public.can_see_job(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists fault_photos_storage_select on storage.objects;
create policy fault_photos_storage_select on storage.objects
  for select using (
    bucket_id = 'fault-photos'
    and public.can_see_equipment(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists fault_photos_storage_insert on storage.objects;
create policy fault_photos_storage_insert on storage.objects
  for insert with check (
    bucket_id = 'fault-photos'
    and public.can_see_equipment(((storage.foldername(name))[1])::uuid)
  );

-- 86: private "photo-library" storage bucket for the treetops.co.uk website
-- rebuild (repo andrewmwalker1/treetops-website).
--
-- Andy uploads the park's photo library here from the dashboard
-- (Storage -> photo-library -> Upload), sorted into folders such as aerial/,
-- gardens/, views/, homes-outside/, homes-inside/. Claude sessions read it
-- with the service role to choose and prepare photos for the website.
--
-- Private on purpose: no RLS policies are added, so only the service role
-- (the dashboard, and server-side tools) can read or write it. The website
-- itself never loads from this bucket; chosen photos are resized and
-- published separately.
--
-- Applied 11 Nov 2026 through the Storage API (same settings as below).
-- Idempotent: safe to re-run in the SQL Editor.

insert into storage.buckets (id, name, public, allowed_mime_types)
values ('photo-library', 'photo-library', false, array['image/*', 'video/*'])
on conflict (id) do update
  set public = false,
      allowed_mime_types = excluded.allowed_mime_types;

-- PN-B03 was missing from 05-seed-pitches.sql (the seed skips PN-B03, B04,
-- B06 and B09), so it never appeared in any pitch picker and keys couldn't
-- be registered against it. Idempotent: the (site_id, pitch_number_or_name)
-- unique constraint makes a re-run a no-op.
insert into public.pitches (site_id, pitch_number_or_name)
select s.id, 'PN-B03'
from public.sites s
join public.organisations o on o.id = s.org_id
where o.name = 'Tree Tops Caravan Park Ltd' and s.name = 'Tree Tops'
on conflict (site_id, pitch_number_or_name) do nothing;

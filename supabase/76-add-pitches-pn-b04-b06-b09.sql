-- PN-B04, PN-B06 and PN-B09 were also skipped by 05-seed-pitches.sql (see
-- 75-add-pitch-pn-b03.sql for PN-B03). Idempotent: the (site_id,
-- pitch_number_or_name) unique constraint makes a re-run a no-op.
insert into public.pitches (site_id, pitch_number_or_name)
select s.id, code
from public.sites s
join public.organisations o on o.id = s.org_id
cross join (values ('PN-B04'), ('PN-B06'), ('PN-B09')) as v(code)
where o.name = 'Tree Tops Caravan Park Ltd' and s.name = 'Tree Tops'
on conflict (site_id, pitch_number_or_name) do nothing;

-- OP-C06 was skipped by 05-seed-pitches.sql (same as PN-B03/B04/B06/B09,
-- see 75/76). Idempotent: the (site_id, pitch_number_or_name) unique
-- constraint makes a re-run a no-op.
insert into public.pitches (site_id, pitch_number_or_name)
select s.id, code
from public.sites s
join public.organisations o on o.id = s.org_id
cross join (values ('OP-C06')) as v(code)
where o.name = 'Tree Tops Caravan Park Ltd' and s.name = 'Tree Tops'
on conflict (site_id, pitch_number_or_name) do nothing;

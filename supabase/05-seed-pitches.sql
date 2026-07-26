-- Tree Tops Maintenance Platform — pitch seed data
-- Source: Andy's "Holiday Homes.csv" export (206 pitch codes; one stray
-- row, "Unit Site", was excluded per Andy's confirmation — not a real
-- pitch code).
-- Run after 01-schema.sql through 04-storage.sql.
--
-- pitches had no unique constraint to make re-running safe, so this adds
-- one retroactively before inserting (mirrored in 01-schema.sql for
-- future fresh installs — if you re-run 01-schema.sql later this is a
-- no-op).

do $$ begin
  alter table public.pitches
    add constraint pitches_site_id_pitch_number_or_name_key
    unique (site_id, pitch_number_or_name);
exception when duplicate_object then null; end $$;

do $$
declare
  v_site_id uuid;
begin
  select s.id into v_site_id
  from public.sites s
  join public.organisations o on o.id = s.org_id
  where o.name = 'Tree Tops Caravan Park Ltd' and s.name = 'Tree Tops';

  if v_site_id is null then
    raise exception 'Tree Tops site not found — run 03-seed-treetops.sql first';
  end if;

  insert into public.pitches (site_id, pitch_number_or_name)
  select v_site_id, code
  from (values
    ('OM-L01'), ('OM-L02'), ('OM-L03'), ('OM-L04'), ('OM-L05'), ('OM-L06'),
    ('OM-L07'), ('OM-L08'), ('OM-L09'), ('OM-L10'), ('OM-L11'), ('OM-L12'),
    ('OP-A02'), ('OP-A03'), ('OP-A04'), ('OP-A05'), ('OP-A11'), ('OP-A12'),
    ('OP-A13'), ('OP-A14'), ('OP-A15'), ('OP-A16'),
    ('OP-B01'), ('OP-B05'), ('OP-B06'), ('OP-B10'), ('OP-B11'), ('OP-B12'),
    ('OP-B13'), ('OP-B14'), ('OP-B15'), ('OP-B17'), ('OP-B18'), ('OP-B19'),
    ('OP-B20'), ('OP-B21'), ('OP-B22'), ('OP-B23'), ('OP-B24'), ('OP-B25'),
    ('OP-B26'), ('OP-B27'), ('OP-B28'), ('OP-B29'), ('OP-B30'),
    ('OP-C01'), ('OP-C04'), ('OP-C05'), ('OP-C08'), ('OP-C09'), ('OP-C10'), ('OP-C11'),
    ('OP-D02'), ('OP-D03'), ('OP-D04'), ('OP-D05'), ('OP-D06'),
    ('OP-E01'), ('OP-E02'), ('OP-E03'), ('OP-E04'), ('OP-E05'), ('OP-E06'),
    ('OP-E07'), ('OP-E08'), ('OP-E09'), ('OP-E10'), ('OP-E11'), ('OP-E12'),
    ('OP-E13'), ('OP-E14'), ('OP-E15'), ('OP-E16'), ('OP-E17'), ('OP-E18'),
    ('OP-E19'), ('OP-E20'), ('OP-E21'), ('OP-E22'), ('OP-E23'), ('OP-E24'), ('OP-E25'),
    ('OP-F01'), ('OP-F02'), ('OP-F03'), ('OP-F04'), ('OP-F05'), ('OP-F06'),
    ('OP-F07'), ('OP-F08'), ('OP-F09'), ('OP-F10'), ('OP-F11'), ('OP-F12'),
    ('OP-F13'), ('OP-F14'), ('OP-F15'), ('OP-F16'), ('OP-F17'), ('OP-F20'),
    ('OP-G01'), ('OP-G02'), ('OP-G03'), ('OP-G04'), ('OP-G05'), ('OP-G06'), ('OP-G07'), ('OP-G08'),
    ('PN-A01'), ('PN-A02'), ('PN-A03'), ('PN-A04'), ('PN-A05'), ('PN-A06'),
    ('PN-A07'), ('PN-A08'), ('PN-A09'), ('PN-A10'), ('PN-A11'), ('PN-A12'),
    ('PN-A13'), ('PN-A14'), ('PN-A15'), ('PN-A16'), ('PN-A17'),
    ('PN-B01'), ('PN-B02'), ('PN-B05'), ('PN-B07'), ('PN-B08'), ('PN-B10'),
    ('PN-B11'), ('PN-B12'), ('PN-B13'), ('PN-B14'), ('PN-B15'), ('PN-B16'), ('PN-B17'),
    ('PN-C01'), ('PN-C02'), ('PN-C03'), ('PN-C04'), ('PN-C05'), ('PN-C06'),
    ('PN-C07'), ('PN-C08'), ('PN-C09'), ('PN-C10'), ('PN-C11'), ('PN-C12'),
    ('PN-C13'), ('PN-C14'), ('PN-C15'), ('PN-C16'), ('PN-C17'),
    ('YH-D01'), ('YH-D02'), ('YH-D03'), ('YH-D04'), ('YH-D05'), ('YH-D06'),
    ('YH-D07'), ('YH-D08'), ('YH-D09'), ('YH-D10'), ('YH-D11'), ('YH-D12'),
    ('YH-D13'), ('YH-D15'), ('YH-D16'),
    ('YH-E01'), ('YH-E02'), ('YH-E03'), ('YH-E04'), ('YH-E05'), ('YH-E06'),
    ('YH-E07'), ('YH-E08'), ('YH-E09'), ('YH-E10'), ('YH-E11'), ('YH-E12'),
    ('YH-E13'), ('YH-E14'), ('YH-E15'), ('YH-E16'), ('YH-E17'), ('YH-E18'),
    ('YH-E19'), ('YH-E20'), ('YH-E21'),
    ('YH-F01'), ('YH-F02'), ('YH-F03'), ('YH-F04'), ('YH-F05'), ('YH-F06'),
    ('YH-F07'), ('YH-F08'), ('YH-F09'), ('YH-F10'), ('YH-F11'), ('YH-F12'),
    ('YH-F13'), ('YH-F14'), ('YH-F15')
  ) as codes(code)
  on conflict (site_id, pitch_number_or_name) do nothing;
end $$;

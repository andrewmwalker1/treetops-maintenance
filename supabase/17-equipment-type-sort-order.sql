-- Adds a manual sort order to equipment_types, so the admin can control the
-- category order shown on the workshop kiosk's check-out grid instead of it
-- always being alphabetical -- same pattern common_fault_descriptions.sort_order
-- already uses (12-equipment-types.sql / 16-rfid-kiosk-and-equipment-checkout.sql).
alter table public.equipment_types add column if not exists sort_order int not null default 0;

-- Backfill existing rows to their current alphabetical position, so nothing
-- visibly reorders the moment this runs. Guarded so re-running this file
-- later (e.g. after the admin has already reordered types) doesn't reset
-- everything back to alphabetical.
do $$
begin
  if not exists (select 1 from public.equipment_types where sort_order <> 0) then
    with ordered as (
      select id, row_number() over (partition by org_id order by name) - 1 as rn
      from public.equipment_types
    )
    update public.equipment_types e
    set sort_order = ordered.rn
    from ordered
    where ordered.id = e.id;
  end if;
end $$;

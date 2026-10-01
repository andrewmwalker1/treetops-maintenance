-- "No checkout" belongs to the equipment type, not the individual machine:
-- a whole type (robomowers, guest lodges, boilers...) is kept as an asset
-- for reminders and documents but never offered to the team for
-- check-out. 77-equipment-no-checkout.sql put the flag on equipment
-- instead; this moves it to equipment_types.
-- Run after 79-linked-jobs.sql. Idempotent.

alter table public.equipment_types
  add column if not exists no_checkout boolean not null default false;

-- Carry over: a type with any machine flagged under the old per-machine
-- flag becomes a no-checkout type. Then clear the old flags, so nothing
-- is left blocked by a setting the admin screens no longer show.
-- equipment.no_checkout itself is left in place (unused) rather than
-- dropped, so an app version from before this change keeps loading until
-- the new one deploys.
update public.equipment_types t
   set no_checkout = true
 where not t.no_checkout
   and exists (
     select 1 from public.equipment e
      where e.equipment_type_id = t.id and e.no_checkout
   );

update public.equipment set no_checkout = false where no_checkout;

-- Enforce it in the database too, so a stale screen or a hand-built
-- request can't check out a machine of a no-checkout type.
drop policy if exists equipment_checkouts_insert on public.equipment_checkouts;
create policy equipment_checkouts_insert on public.equipment_checkouts
  for insert with check (
    public.can_see_equipment(equipment_id)
    and profile_id = auth.uid()
    and exists (
      select 1 from public.equipment e
      left join public.equipment_types t on t.id = e.equipment_type_id
      where e.id = equipment_id
        and e.status in ('in_service', 'monitor')
        and not coalesce(t.no_checkout, false)
    )
  );

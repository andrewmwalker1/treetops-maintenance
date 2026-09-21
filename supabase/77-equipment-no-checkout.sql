-- "No checkout" flag on equipment: the system doubles as an asset log
-- (guest lodges, boilers...) where some assets are tracked for reminders
-- and documents but must never be offered to the team for check-out.
-- Run after 76-add-pitches-pn-b04-b06-b09.sql. Idempotent.
--
-- The kiosk/main-app checkout screens filter these out client-side
-- (equipmentAvailability.js); the insert policy below enforces it in the
-- database too, so a stale screen or a hand-built request can't check one
-- out anyway.
--
-- The policy also now accepts status 'monitor' alongside 'in_service'.
-- 53-equipment-monitor-status.sql introduced 'monitor' as checkout-eligible
-- (the app has offered those units ever since) but never widened this
-- policy, so checking one out was silently rejected by RLS.

alter table public.equipment
  add column if not exists no_checkout boolean not null default false;

drop policy if exists equipment_checkouts_insert on public.equipment_checkouts;
create policy equipment_checkouts_insert on public.equipment_checkouts
  for insert with check (
    public.can_see_equipment(equipment_id)
    and profile_id = auth.uid()
    and exists (
      select 1 from public.equipment e
      where e.id = equipment_id
        and e.status in ('in_service', 'monitor')
        and not e.no_checkout
    )
  );

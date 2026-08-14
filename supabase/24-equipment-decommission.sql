-- Decommissioning: a structured alternative to deleting an equipment row.
-- Andy's rule (2026-08-15): deleting equipment should not be a casual,
-- self-service action -- it's now removed from the Equipment admin UI
-- (this migration doesn't touch the equipment_delete RLS policy from
-- 13-equipment-admin.sql, so a genuine data-entry mistake can still be
-- cleaned up directly in the SQL editor). Decommissioning is the everyday
-- path for a machine that's actually gone (scrapped/sold/other) --
-- captures why, when, and any notes, and flips status away from
-- 'in_service' so it stops being offered in the kiosk check-out flow
-- (equipmentAvailability.js already filters on status = 'in_service',
-- so no query changes are needed there for this to take effect).
--
-- ALTER TYPE ... ADD VALUE cannot run inside a DO block or any other
-- transaction-block context (a hard Postgres restriction, unlike the
-- `exception when duplicate_object` pattern used elsewhere in this repo)
-- -- IF NOT EXISTS (PG12+) is what makes this idempotent instead.
alter type public.equipment_status add value if not exists 'decommissioned';

alter table public.equipment
  add column if not exists decommissioned_at date,
  add column if not exists decommission_reason text,
  add column if not exists decommission_notes text;

do $$ begin
  alter table public.equipment
    add constraint equipment_decommission_reason_check
    check (decommission_reason is null or decommission_reason in ('scrapped', 'sold', 'other'));
exception when duplicate_object then null; end $$;

-- No RLS changes: decommissioning is a plain equipment UPDATE (status +
-- the three new columns), already covered by the existing equipment_update
-- policy's can_manage_equipment_status gate -- the same permission that
-- already governs every other write on this table.

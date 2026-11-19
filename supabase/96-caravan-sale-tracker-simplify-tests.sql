-- Tree Tops Maintenance Platform -- Caravan Sale Tracker: simplify gas
-- and electric test tracking from real linked Jobs (which needed a
-- Contractor assignee) to plain booked/completed date fields on the
-- sale itself, per Andy's simplification request. "Prep caravan"
-- stays a real linked Job (jobs.sale_role = 'prep' is still used);
-- 'gas_test' and 'electric_test' are no longer valid sale_role values.
-- Run after 95-caravan-sale-tracker.sql.
-- Idempotent, safe to re-run.

alter table public.caravan_sales add column if not exists electric_test_booked_date date;
alter table public.caravan_sales add column if not exists electric_test_completed_date date;
alter table public.caravan_sales add column if not exists gas_test_booked_date date;
alter table public.caravan_sales add column if not exists gas_test_completed_date date;

-- Null out anything that would violate the narrower constraint below --
-- harmless on a fresh run (nothing has used this feature in anger yet),
-- but keeps this file safe to re-run regardless.
update public.jobs set sale_role = null where sale_role in ('gas_test', 'electric_test');

alter table public.jobs drop constraint if exists jobs_sale_role_check;
alter table public.jobs add constraint jobs_sale_role_check check (sale_role is null or sale_role = 'prep');

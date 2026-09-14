-- Tree Tops Maintenance Platform -- Force-set staff_time_profiles'
-- updated_by/updated_at server-side (found via code review 2026-09-14).
-- Run after 70-holiday-accrual-and-booking.sql. Idempotent (CREATE OR
-- REPLACE + DROP TRIGGER IF EXISTS before CREATE), safe to re-run.
--
-- upsertStaffTimeProfile (src/lib/holidayQueries.js) was passing
-- updated_by: profileId -- the row's own subject, not the admin actually
-- making the edit -- because there was no trigger to override it, unlike
-- timesheet_entries_before_update's already-established
-- "new.updated_by := auth.uid()" pattern. Also fixes updated_at, whose
-- column default only applied on insert -- an update never bumped it.
create or replace function public.staff_time_profiles_before_upsert()
returns trigger
language plpgsql
as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists staff_time_profiles_before_upsert on public.staff_time_profiles;
create trigger staff_time_profiles_before_upsert
  before insert or update on public.staff_time_profiles
  for each row execute function public.staff_time_profiles_before_upsert();

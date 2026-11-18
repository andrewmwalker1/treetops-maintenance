-- Tree Tops Maintenance Platform -- stop any signed-in user calling the
-- bank-holiday helpers directly (SECURITY-PLAN.md §2, 17 Nov 2026 review).
-- Run after 88-checklist-item-tick-timestamps.sql. Idempotent (REVOKE is a
-- no-op when the privilege is already gone), safe to re-run.
--
-- apply_bank_holiday_for_profile / remove_bank_holiday_for_profile
-- (70-holiday-accrual-and-booking.sql) are security definer with no caller
-- check, and Postgres grants EXECUTE on new functions to PUBLIC -- so anyone
-- signed in could add or delete bank-holiday rows on anyone's timesheet via
-- /rest/v1/rpc/apply_bank_holiday_for_profile. They're only meant to be
-- called from the sync_bank_holiday_* triggers. Those trigger functions are
-- themselves security definer, so they call the helpers as the owner and
-- keep working after this revoke. No client code calls them.

revoke execute on function public.apply_bank_holiday_for_profile(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.remove_bank_holiday_for_profile(uuid, uuid)
  from public, anon, authenticated;

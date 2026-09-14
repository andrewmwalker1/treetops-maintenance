-- Tree Tops Maintenance Platform -- Guard against a zero baseline_weekly_hours
-- (found via code review 2026-09-14). Run after 70-holiday-accrual-and-
-- booking.sql. Idempotent (drop-then-add constraint), safe to re-run.
--
-- holiday_entitlement_hours() and holiday_accrual_ratio() both divide by
-- holiday_settings.baseline_weekly_hours, but the admin UI only enforced
-- min="0" on the input -- saving 0 there breaks entitlement/accrual math
-- for the whole org (division by zero) until someone notices and reverts
-- it. The client (HolidaySettingsTab.jsx) now also blocks saving 0/blank,
-- but the constraint is the real guarantee.
alter table public.holiday_settings drop constraint if exists holiday_settings_baseline_weekly_hours_positive;
alter table public.holiday_settings add constraint holiday_settings_baseline_weekly_hours_positive
  check (baseline_weekly_hours > 0);

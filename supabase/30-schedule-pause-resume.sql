-- Tree Tops Maintenance Platform -- pause/resume recurring jobs
-- Run after 29-contractor-documents.sql.
--
-- Previously the only way to stop a recurring job was to delete the
-- schedules row, losing its rrule/lead-in/history. Adds an is_active
-- flag so it can be paused and resumed instead. generate-scheduled-jobs
-- (the daily edge function) must be updated to filter on this -- see
-- that function's own comment, written in anticipation of this column.
--
-- No RLS change needed: 11-schedules-admin.sql's schedules_update policy
-- already covers any column write under can_manage_reference_data.

alter table public.schedules add column if not exists is_active boolean not null default true;

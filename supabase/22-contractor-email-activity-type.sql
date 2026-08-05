-- Tree Tops Maintenance Platform -- contractor email activity log entry
-- Run after 21-contractors-and-groups-admin.sql.
--
-- The send-contractor-job-email Edge Function logs a job_activity row
-- each time it sends (or resends) a job's details to a contractor, so
-- office staff can see it happened without a separate "sent" flag. Needs
-- a new event_type value -- can't be added and used in the same
-- transaction, so this is its own migration, run before the function
-- that inserts rows with it.

alter type public.job_activity_event_type add value if not exists 'contractor_email';

-- Tree Tops Maintenance Platform -- job progress-update activity log entry
-- Run after 22-contractor-email-activity-type.sql.
--
-- Kiosk staff can log a rough "X% done" progress update on a job without
-- marking it complete -- a lighter-weight touch-friendly alternative to
-- typing a comment. Stored as a job_activity row (new_value: {percent}),
-- same actor+timestamp trail every other activity type already gets. Needs
-- a new event_type value -- can't be added and used in the same
-- transaction, so this is its own migration, run before the app code that
-- inserts rows with it.

alter type public.job_activity_event_type add value if not exists 'progress_update';

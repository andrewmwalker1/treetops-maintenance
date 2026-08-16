-- Tree Tops Maintenance Platform -- gate removing an activity type from a
-- job behind can_edit_job_details.
-- Run after 27-job-details-edit-permission.sql.
--
-- 06-activity-types-and-safety-library.sql originally treated activity
-- type selection as ordinary job metadata anyone who can see the job
-- could change -- that decision is superseded now that due
-- date/priority/status/location editing requires can_edit_job_details
-- (27-*.sql): the job screen's checkbox editor for activity types is
-- gated behind the same permission, so this brings the RLS in line with
-- it for the "remove" half of that editor.
--
-- Insert stays open on purpose, same judgement call as job_subtasks in
-- 06-*.sql: NewJob.jsx lets whoever creates a job attach activity types
-- (so the right RA/MS documents surface) without needing
-- can_edit_job_details, same as it lets them apply a checklist template
-- without can_edit_job_checklist. Someone without the permission could
-- still re-add a type via a direct API call even though the job screen's
-- checkboxes are hidden from them -- an accepted gap, not an oversight,
-- matching the equivalent gap already documented for job_subtasks.
-- Select is untouched -- viewing a job's activity types (and the RA/MS
-- documents linked to them) never required a permission and still
-- shouldn't.

drop policy if exists job_activity_types_delete on public.job_activity_types;
create policy job_activity_types_delete on public.job_activity_types
  for delete using (public.can_see_job(job_id) and public.has_permission('can_edit_job_details'));

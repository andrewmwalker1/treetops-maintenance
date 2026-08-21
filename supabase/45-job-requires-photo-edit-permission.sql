-- Tree Tops Maintenance Platform -- extend can_require_job_photo to editing
-- Run after 44-role-assignable-job-targets.sql.
--
-- can_require_job_photo (19-job-completion-photo-requirement.sql) only ever
-- gated the checkbox on the New Job screen -- jobs_update (02-rls-
-- policies.sql) doesn't check this permission at all, so jobs.requires_photo
-- could already be changed by anyone who could edit a job, once JobDetail.jsx
-- grew its own "Require a photo" checkbox. Closes the same gap 32-checklist-
-- item-photo-requirement.sql closed for job_subtasks.requires_photo -- same
-- pattern, applied to the whole-job flag instead of a checklist item.

create or replace function public.enforce_job_requires_photo_permission()
returns trigger as $$
begin
  if not public.has_permission('can_require_job_photo') then
    raise exception 'Changing a job''s photo requirement needs the can_require_job_photo permission';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists jobs_enforce_requires_photo_permission on public.jobs;
create trigger jobs_enforce_requires_photo_permission
  before update on public.jobs
  for each row
  when (old.requires_photo is distinct from new.requires_photo)
  execute function public.enforce_job_requires_photo_permission();

-- Tree Tops Maintenance Platform -- whoever raised a job can always see it
-- Run after 50-role-visibility-write-policies.sql.
--
-- can_see_job() (02-rls-policies.sql, Section 4.3) never checked
-- created_by -- only the assignee (person/group), role_visibility, or
-- can_see_all_jobs. Andy's example: Maintenance raises a materials
-- request and assigns it to Office; the moment it's created, Maintenance
-- loses all visibility of it (they're not assigned, and role_visibility
-- has no Maintenance -> Office row), so they can never check whether it's
-- been picked up or completed. This adds created_by = auth.uid() as one
-- more way in -- a blanket rule, not something admins configure per role
-- (unlike role_visibility), since "I can always see what I asked for" is
-- true regardless of who ends up doing it. Applies everywhere
-- can_see_job() is already used (jobs/job_photos/job_subtasks/
-- job_activity select policies), so nothing else needs touching.

create or replace function public.can_see_job(p_job_id uuid)
returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.jobs j
    where j.id = p_job_id
      and (
        public.is_platform_admin()
        or (
          public.has_site_scope(j.site_id)
          and (
            j.created_by = auth.uid()
            or j.assignee_profile_id = auth.uid()
            or (j.assignee_group_id is not null and public.is_in_group(j.assignee_group_id))
            or (
              j.assignee_profile_id is not null
              and public.role_can_see_role(
                (select p.role_id from public.profiles p where p.id = j.assignee_profile_id)
              )
            )
            or public.has_permission('can_see_all_jobs')
          )
        )
      )
  );
$$;

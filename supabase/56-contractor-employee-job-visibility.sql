-- Tree Tops Maintenance Platform -- a contractor's own staff can see their
-- own company's jobs
-- Run after 55-key-tag-events-handover-detail.sql.
--
-- can_see_job (21-contractors-and-groups-admin.sql) added a contractor
-- branch, but it only covers can_see_contractor_jobs holders (Tree Tops
-- staff who need to see every contractor's work) -- there was never a
-- branch for the contractor's own employee seeing jobs assigned to their
-- own company. Kevin Parry Ltd's own login (Kev or Ben, profiles.contractor_id
-- pointing at that contractors row -- 43-contractor-linked-profiles.sql)
-- would not see a job assigned to "Kevin Parry Ltd" without this.
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
            j.assignee_profile_id = auth.uid()
            or (j.assignee_group_id is not null and public.is_in_group(j.assignee_group_id))
            or (
              j.assignee_profile_id is not null
              and public.role_can_see_role(
                (select p.role_id from public.profiles p where p.id = j.assignee_profile_id)
              )
            )
            or (
              j.assignee_contractor_id is not null
              and j.assignee_contractor_id = (select p.contractor_id from public.profiles p where p.id = auth.uid())
            )
            or (j.assignee_contractor_id is not null and public.has_permission('can_see_contractor_jobs'))
            or public.has_permission('can_see_all_jobs')
          )
        )
      )
  );
$$;

-- Tree Tops Maintenance Platform — Row Level Security
-- Covers Section 4 (Access Control) of BUILD-BRIEF.md.
-- Run this after 01-schema.sql. Idempotent: policies are dropped and
-- recreated, functions use create or replace.
--
-- All helper functions are `security definer` so they can read
-- profiles/site_scope/role_visibility/etc. without recursing into the
-- RLS policies defined on those same tables. Each sets an explicit
-- search_path to avoid search-path hijacking.

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------

create or replace function public.current_org_id()
returns uuid
language sql security definer stable
set search_path = public, pg_temp
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

create or replace function public.current_role_id()
returns uuid
language sql security definer stable
set search_path = public, pg_temp
as $$
  select role_id from public.profiles where id = auth.uid();
$$;

create or replace function public.has_site_scope(p_site_id uuid)
returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.site_scope
    where profile_id = auth.uid() and site_id = p_site_id
  );
$$;

create or replace function public.has_permission(p_key text)
returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.role_permissions rp
    where rp.role_id = public.current_role_id()
      and rp.permission_key = p_key
      and rp.enabled
  );
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.platform_admins where profile_id = auth.uid()
  );
$$;

create or replace function public.is_in_group(p_group_id uuid)
returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.group_members
    where profile_id = auth.uid() and group_id = p_group_id
  );
$$;

create or replace function public.role_can_see_role(p_visible_role_id uuid)
returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.role_visibility
    where role_id = public.current_role_id() and visible_role_id = p_visible_role_id
  );
$$;

-- Section 4.3: a job is visible if its site is in scope AND the caller
-- is the assignee, in the assignee group, has visibility of the
-- assignee's role, or holds the org-wide "see everything" permission.
-- Platform admins get support read-access too (Section 4.5).
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
            or public.has_permission('can_see_all_jobs')
          )
        )
      )
  );
$$;

create or replace function public.can_see_equipment(p_equipment_id uuid)
returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.equipment e
    where e.id = p_equipment_id
      and (
        public.is_platform_admin()
        or (e.site_id is not null and public.has_site_scope(e.site_id))
        or e.held_by_profile_id = auth.uid()
        or (e.org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'))
      )
  );
$$;

-- Reallocation (changing who a job is assigned to) is gated by
-- can_reallocate_jobs, per Section 5. RLS can't check "which columns
-- changed" on its own, so this trigger does it.
create or replace function public.enforce_job_reallocation_permission()
returns trigger as $$
begin
  if (new.assignee_profile_id is distinct from old.assignee_profile_id
      or new.assignee_group_id is distinct from old.assignee_group_id)
     and not public.has_permission('can_reallocate_jobs') then
    raise exception 'Reallocating a job requires the can_reallocate_jobs permission';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists jobs_enforce_reallocation on public.jobs;
create trigger jobs_enforce_reallocation
  before update on public.jobs
  for each row execute function public.enforce_job_reallocation_permission();

-- ---------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------

alter table public.organisations enable row level security;
alter table public.roles enable row level security;
alter table public.sites enable row level security;
alter table public.terminology_templates enable row level security;
alter table public.profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.role_visibility enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.site_scope enable row level security;
alter table public.platform_admins enable row level security;
alter table public.admin_access_log enable row level security;
alter table public.pitches enable row level security;
alter table public.areas enable row level security;
alter table public.task_types enable row level security;
alter table public.risk_assessments enable row level security;
alter table public.training_videos enable row level security;
alter table public.job_statuses enable row level security;
alter table public.job_types enable row level security;
alter table public.schedules enable row level security;
alter table public.jobs enable row level security;
alter table public.job_photos enable row level security;
alter table public.job_subtasks enable row level security;
alter table public.job_activity enable row level security;
alter table public.equipment enable row level security;
alter table public.equipment_checks enable row level security;
alter table public.fault_reports enable row level security;
alter table public.fault_photos enable row level security;
alter table public.repair_records enable row level security;
alter table public.notifications enable row level security;
alter table public.export_logs enable row level security;
alter table public.push_subscriptions enable row level security;

-- ---------------------------------------------------------------------
-- Tenancy & structure
-- ---------------------------------------------------------------------

drop policy if exists organisations_select on public.organisations;
create policy organisations_select on public.organisations
  for select using (id = public.current_org_id() or public.is_platform_admin());

drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles
  for select using (org_id = public.current_org_id() or public.is_platform_admin());

drop policy if exists sites_select on public.sites;
create policy sites_select on public.sites
  for select using (org_id = public.current_org_id() or public.is_platform_admin());

-- Shared reference data, not tenant-scoped.
drop policy if exists terminology_templates_select on public.terminology_templates;
create policy terminology_templates_select on public.terminology_templates
  for select using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------
-- People & access
-- ---------------------------------------------------------------------

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid() or org_id = public.current_org_id() or public.is_platform_admin()
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists permissions_select on public.permissions;
create policy permissions_select on public.permissions
  for select using (auth.role() = 'authenticated');

drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions
  for select using (
    exists (select 1 from public.roles r where r.id = role_permissions.role_id and r.org_id = public.current_org_id())
  );

drop policy if exists role_visibility_select on public.role_visibility;
create policy role_visibility_select on public.role_visibility
  for select using (
    exists (select 1 from public.roles r where r.id = role_visibility.role_id and r.org_id = public.current_org_id())
  );

drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups
  for select using (org_id = public.current_org_id());

drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members
  for select using (
    exists (select 1 from public.groups g where g.id = group_members.group_id and g.org_id = public.current_org_id())
  );

-- Users see their own scope rows; wider org-admin visibility can be
-- added (e.g. via a can_manage_users permission) once a user-management
-- screen is scoped.
drop policy if exists site_scope_select on public.site_scope;
create policy site_scope_select on public.site_scope
  for select using (profile_id = auth.uid() or public.is_platform_admin());

drop policy if exists platform_admins_select on public.platform_admins;
create policy platform_admins_select on public.platform_admins
  for select using (public.is_platform_admin());

drop policy if exists admin_access_log_all on public.admin_access_log;
create policy admin_access_log_all on public.admin_access_log
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ---------------------------------------------------------------------
-- Pitches & areas (site-scoped, Section 4.2)
-- ---------------------------------------------------------------------

drop policy if exists pitches_select on public.pitches;
create policy pitches_select on public.pitches
  for select using (public.has_site_scope(site_id) or public.is_platform_admin());

drop policy if exists areas_select on public.areas;
create policy areas_select on public.areas
  for select using (public.has_site_scope(site_id) or public.is_platform_admin());

-- Areas grow via usage — any scoped user can add one.
drop policy if exists areas_insert on public.areas;
create policy areas_insert on public.areas
  for insert with check (public.has_site_scope(site_id) and created_by = auth.uid());

-- ---------------------------------------------------------------------
-- Task types, risk assessments, job config (org reference data)
-- ---------------------------------------------------------------------

drop policy if exists task_types_select on public.task_types;
create policy task_types_select on public.task_types
  for select using (org_id = public.current_org_id());

drop policy if exists risk_assessments_select on public.risk_assessments;
create policy risk_assessments_select on public.risk_assessments
  for select using (org_id = public.current_org_id());

drop policy if exists training_videos_select on public.training_videos;
create policy training_videos_select on public.training_videos
  for select using (org_id = public.current_org_id());

drop policy if exists job_statuses_select on public.job_statuses;
create policy job_statuses_select on public.job_statuses
  for select using (org_id = public.current_org_id());

drop policy if exists job_types_select on public.job_types;
create policy job_types_select on public.job_types
  for select using (org_id = public.current_org_id());

drop policy if exists schedules_select on public.schedules;
create policy schedules_select on public.schedules
  for select using (public.has_site_scope(site_id));

-- ---------------------------------------------------------------------
-- Jobs (Section 4.3-4.4)
-- ---------------------------------------------------------------------

drop policy if exists jobs_select on public.jobs;
create policy jobs_select on public.jobs
  for select using (public.can_see_job(id));

drop policy if exists jobs_insert on public.jobs;
create policy jobs_insert on public.jobs
  for insert with check (
    org_id = public.current_org_id()
    and public.has_site_scope(site_id)
    and created_by = auth.uid()
  );

drop policy if exists jobs_update on public.jobs;
create policy jobs_update on public.jobs
  for update using (public.can_see_job(id))
  with check (org_id = public.current_org_id() and public.has_site_scope(site_id));

drop policy if exists job_photos_select on public.job_photos;
create policy job_photos_select on public.job_photos
  for select using (public.can_see_job(job_id));

drop policy if exists job_photos_insert on public.job_photos;
create policy job_photos_insert on public.job_photos
  for insert with check (public.can_see_job(job_id) and uploaded_by = auth.uid());

drop policy if exists job_subtasks_select on public.job_subtasks;
create policy job_subtasks_select on public.job_subtasks
  for select using (public.can_see_job(job_id));

drop policy if exists job_subtasks_insert on public.job_subtasks;
create policy job_subtasks_insert on public.job_subtasks
  for insert with check (public.can_see_job(job_id));

drop policy if exists job_subtasks_update on public.job_subtasks;
create policy job_subtasks_update on public.job_subtasks
  for update using (public.can_see_job(job_id)) with check (public.can_see_job(job_id));

-- job_activity: append-only visibility inherited from the parent job.
-- Corrective updates are allowed; deletes are blocked (no delete policy
-- here, plus the forbid_job_activity_delete trigger in 01-schema.sql).
drop policy if exists job_activity_select on public.job_activity;
create policy job_activity_select on public.job_activity
  for select using (public.can_see_job(job_id));

drop policy if exists job_activity_insert on public.job_activity;
create policy job_activity_insert on public.job_activity
  for insert with check (public.can_see_job(job_id) and actor_profile_id = auth.uid());

drop policy if exists job_activity_update on public.job_activity;
create policy job_activity_update on public.job_activity
  for update using (public.can_see_job(job_id)) with check (public.can_see_job(job_id));

-- ---------------------------------------------------------------------
-- Equipment & H&S
-- ---------------------------------------------------------------------

drop policy if exists equipment_select on public.equipment;
create policy equipment_select on public.equipment
  for select using (public.can_see_equipment(id));

drop policy if exists equipment_insert on public.equipment;
create policy equipment_insert on public.equipment
  for insert with check (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'));

drop policy if exists equipment_update on public.equipment;
create policy equipment_update on public.equipment
  for update using (public.can_see_equipment(id))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'));

drop policy if exists equipment_checks_select on public.equipment_checks;
create policy equipment_checks_select on public.equipment_checks
  for select using (public.can_see_equipment(equipment_id));

drop policy if exists equipment_checks_insert on public.equipment_checks;
create policy equipment_checks_insert on public.equipment_checks
  for insert with check (public.can_see_equipment(equipment_id) and checked_by = auth.uid());

drop policy if exists fault_reports_select on public.fault_reports;
create policy fault_reports_select on public.fault_reports
  for select using (public.can_see_equipment(equipment_id));

drop policy if exists fault_reports_insert on public.fault_reports;
create policy fault_reports_insert on public.fault_reports
  for insert with check (public.can_see_equipment(equipment_id) and reported_by = auth.uid());

drop policy if exists fault_photos_select on public.fault_photos;
create policy fault_photos_select on public.fault_photos
  for select using (
    exists (select 1 from public.fault_reports fr where fr.id = fault_photos.fault_report_id and public.can_see_equipment(fr.equipment_id))
  );

drop policy if exists fault_photos_insert on public.fault_photos;
create policy fault_photos_insert on public.fault_photos
  for insert with check (
    exists (select 1 from public.fault_reports fr where fr.id = fault_photos.fault_report_id and public.can_see_equipment(fr.equipment_id))
  );

drop policy if exists repair_records_select on public.repair_records;
create policy repair_records_select on public.repair_records
  for select using (public.can_see_equipment(equipment_id));

drop policy if exists repair_records_insert on public.repair_records;
create policy repair_records_insert on public.repair_records
  for insert with check (public.can_see_equipment(equipment_id) and public.has_permission('can_manage_equipment_status'));

-- ---------------------------------------------------------------------
-- Notifications & exports
-- ---------------------------------------------------------------------

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select using (recipient_profile_id = auth.uid());

drop policy if exists export_logs_select on public.export_logs;
create policy export_logs_select on public.export_logs
  for select using (org_id = public.current_org_id() and (exported_by = auth.uid() or public.has_permission('can_see_all_jobs')));

drop policy if exists export_logs_insert on public.export_logs;
create policy export_logs_insert on public.export_logs
  for insert with check (
    org_id = public.current_org_id()
    and exported_by = auth.uid()
    and public.has_permission('can_export_jobs')
  );

drop policy if exists push_subscriptions_all on public.push_subscriptions;
create policy push_subscriptions_all on public.push_subscriptions
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

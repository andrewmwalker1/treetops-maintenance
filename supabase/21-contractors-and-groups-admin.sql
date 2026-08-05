-- Tree Tops Maintenance Platform -- contractor companies + groups admin
-- Run after 20-delete-job.sql.
--
-- Contractors are deliberately NOT profiles/auth.users -- most never log
-- in (that's the whole point), so they get their own lightweight table
-- with no Auth involvement, no role, no RLS-visibility machinery. A job
-- gets a third, mutually-exclusive assignee option alongside person/group.
--
-- Job visibility (can_see_job) previously only had assignee-based paths
-- for a person (direct match, or role_can_see_role of their role) or a
-- group (membership) -- neither applies to a contractor-assigned job, so
-- without the new can_see_contractor_jobs branch below, contractor jobs
-- would only be visible to can_see_all_jobs holders, invisible to normal
-- Office/Maintenance staff who need to track them.
--
-- Also fixes a real gap this would otherwise introduce:
-- enforce_job_reallocation_permission only watched assignee_profile_id/
-- assignee_group_id changes -- reassigning a job to/from a contractor
-- would have silently bypassed can_reallocate_jobs entirely.
--
-- Groups have existed since 01-schema.sql but never had an admin screen
-- or any insert/update/delete RLS policy -- select-only. Adding CRUD
-- policies (gated by can_manage_users, same permission the Users screen
-- already uses) so a Groups admin tab can actually manage them.

create table if not exists public.contractors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  address text,
  main_email text,
  main_phone text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.contractors enable row level security;

drop policy if exists contractors_select on public.contractors;
create policy contractors_select on public.contractors
  for select using (org_id = public.current_org_id());

drop policy if exists contractors_insert on public.contractors;
create policy contractors_insert on public.contractors
  for insert with check (org_id = public.current_org_id() and public.has_permission('can_manage_contractors'));

drop policy if exists contractors_update on public.contractors;
create policy contractors_update on public.contractors
  for update using (org_id = public.current_org_id() and public.has_permission('can_manage_contractors'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_contractors'));

drop policy if exists contractors_delete on public.contractors;
create policy contractors_delete on public.contractors
  for delete using (org_id = public.current_org_id() and public.has_permission('can_manage_contractors'));

insert into public.permissions (key, description) values
  ('can_manage_contractors', 'Can add, edit, and delete contractor companies'),
  ('can_see_contractor_jobs', 'Can see jobs assigned to a contractor')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, p.key, true
from public.roles r
cross join (values ('can_manage_contractors'), ('can_see_contractor_jobs')) as p(key)
where r.name = 'Admin'
  and r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
on conflict do nothing;

alter table public.jobs add column if not exists assignee_contractor_id uuid references public.contractors(id) on delete set null;
create index if not exists jobs_assignee_contractor_idx on public.jobs (assignee_contractor_id);

alter table public.jobs drop constraint if exists jobs_single_assignee;
alter table public.jobs add constraint jobs_single_assignee check (
  num_nonnulls(assignee_profile_id, assignee_group_id, assignee_contractor_id) <= 1
);

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
            or (j.assignee_contractor_id is not null and public.has_permission('can_see_contractor_jobs'))
            or public.has_permission('can_see_all_jobs')
          )
        )
      )
  );
$$;

create or replace function public.enforce_job_reallocation_permission()
returns trigger as $$
begin
  if (new.assignee_profile_id is distinct from old.assignee_profile_id
      or new.assignee_group_id is distinct from old.assignee_group_id
      or new.assignee_contractor_id is distinct from old.assignee_contractor_id)
     and not public.has_permission('can_reallocate_jobs') then
    raise exception 'Reallocating a job requires the can_reallocate_jobs permission';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop policy if exists groups_insert on public.groups;
create policy groups_insert on public.groups
  for insert with check (org_id = public.current_org_id() and public.has_permission('can_manage_users'));

drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups
  for update using (org_id = public.current_org_id() and public.has_permission('can_manage_users'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_users'));

drop policy if exists groups_delete on public.groups;
create policy groups_delete on public.groups
  for delete using (org_id = public.current_org_id() and public.has_permission('can_manage_users'));

drop policy if exists group_members_insert on public.group_members;
create policy group_members_insert on public.group_members
  for insert with check (
    exists (select 1 from public.groups g where g.id = group_members.group_id and g.org_id = public.current_org_id())
    and public.has_permission('can_manage_users')
  );

drop policy if exists group_members_delete on public.group_members;
create policy group_members_delete on public.group_members
  for delete using (
    exists (select 1 from public.groups g where g.id = group_members.group_id and g.org_id = public.current_org_id())
    and public.has_permission('can_manage_users')
  );

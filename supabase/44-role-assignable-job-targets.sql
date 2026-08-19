-- Tree Tops Maintenance Platform -- who a role can create/reassign jobs to
-- Run after 43-contractor-linked-profiles.sql.
--
-- Andy: job assignment should follow the actual management structure, not
-- just "anyone can assign to anyone" (the previous behaviour -- jobs_insert
-- had no assignment restriction at all). Deliberately NOT implicit even
-- for a role assigning within itself: an ordinary Maintenance team member
-- funnels a job idea up to Andy or Jayne, who triage and route it
-- properly, rather than everyone being able to self-assign or hand work
-- sideways. Caravan Prep (Sam) is the exception -- she runs her own team,
-- so her row explicitly includes her own role as well as the two she can
-- escalate to. Same shape as role_visibility (36-key-tags-schema.sql's
-- sibling table from 01-schema.sql), just for assignment instead of
-- visibility -- deliberately a separate table rather than overloading
-- role_visibility, since "can see this role's jobs" and "can hand this
-- role a job" are different questions with different answers (Head
-- Gardener can SEE Maintenance's jobs via role_visibility? no -- but can
-- ASSIGN to Maintenance per Andy's example; the two just aren't the same
-- relation).
create table if not exists public.role_assignable_roles (
  role_id uuid not null references public.roles(id) on delete cascade,
  assignable_role_id uuid not null references public.roles(id) on delete cascade,
  primary key (role_id, assignable_role_id)
);

alter table public.role_assignable_roles enable row level security;

-- Matches role_visibility_select's own openness (02-rls-policies.sql) --
-- anyone needs to read their own role's row to know who shows up in their
-- own assignee picker (src/lib/assignableTargets.js).
drop policy if exists role_assignable_roles_select on public.role_assignable_roles;
create policy role_assignable_roles_select on public.role_assignable_roles
  for select using (
    exists (select 1 from public.roles r where r.id = role_assignable_roles.role_id and r.org_id = public.current_org_id())
  );

drop policy if exists role_assignable_roles_insert on public.role_assignable_roles;
create policy role_assignable_roles_insert on public.role_assignable_roles
  for insert with check (
    exists (select 1 from public.roles r where r.id = role_assignable_roles.role_id and r.org_id = public.current_org_id())
    and public.has_permission('can_manage_roles_and_permissions')
  );

drop policy if exists role_assignable_roles_delete on public.role_assignable_roles;
create policy role_assignable_roles_delete on public.role_assignable_roles
  for delete using (
    exists (select 1 from public.roles r where r.id = role_assignable_roles.role_id and r.org_id = public.current_org_id())
    and public.has_permission('can_manage_roles_and_permissions')
  );

-- Security definer so it can read profiles/role_assignable_roles without
-- recursing into the RLS policies defined on those same tables -- same
-- reasoning as every other helper in 02-rls-policies.sql.
--
-- Contractors are ungated (Andy: not part of this role hierarchy, stays
-- as it always has been). No assignee at all (unassigned job) is always
-- allowed. A group is assignable if ANY of its members holds an
-- assignable role -- matches assignableTargets.js's own "show it if any
-- member qualifies" rule, so what the picker offers and what the server
-- will actually accept never disagree.
create or replace function public.can_assign_job(
  p_assignee_profile_id uuid,
  p_assignee_group_id uuid,
  p_assignee_contractor_id uuid
) returns boolean
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
declare
  v_my_role_id uuid;
begin
  if p_assignee_contractor_id is not null then
    return true;
  end if;

  if p_assignee_profile_id is null and p_assignee_group_id is null then
    return true;
  end if;

  v_my_role_id := public.current_role_id();
  if v_my_role_id is null then
    return false;
  end if;

  if p_assignee_profile_id is not null then
    return exists (
      select 1
      from public.profiles p
      join public.role_assignable_roles rar on rar.assignable_role_id = p.role_id
      where p.id = p_assignee_profile_id
        and rar.role_id = v_my_role_id
    );
  end if;

  return exists (
    select 1
    from public.group_members gm
    join public.profiles p on p.id = gm.profile_id
    join public.role_assignable_roles rar on rar.assignable_role_id = p.role_id
    where gm.group_id = p_assignee_group_id
      and rar.role_id = v_my_role_id
  );
end;
$$;

-- jobs_insert (02-rls-policies.sql) previously had no assignment
-- restriction at all -- add the same check creation and reallocation now
-- share.
drop policy if exists jobs_insert on public.jobs;
create policy jobs_insert on public.jobs
  for insert with check (
    org_id = public.current_org_id()
    and public.has_site_scope(site_id)
    and created_by = auth.uid()
    and public.can_assign_job(assignee_profile_id, assignee_group_id, assignee_contractor_id)
  );

-- enforce_job_reallocation_permission (02-rls-policies.sql) already
-- required can_reallocate_jobs to change assignee_profile_id/
-- assignee_group_id; now also requires the new assignee to actually be
-- one this role is allowed to assign to. assignee_contractor_id is
-- untouched here, same as before this migration -- contractor
-- reallocation was never gated by this trigger and Andy's decision only
-- covers the role hierarchy, not contractors.
create or replace function public.enforce_job_reallocation_permission()
returns trigger as $$
begin
  if (new.assignee_profile_id is distinct from old.assignee_profile_id
      or new.assignee_group_id is distinct from old.assignee_group_id) then
    if not public.has_permission('can_reallocate_jobs') then
      raise exception 'Reallocating a job requires the can_reallocate_jobs permission';
    end if;
    if not public.can_assign_job(new.assignee_profile_id, new.assignee_group_id, new.assignee_contractor_id) then
      raise exception 'Your role is not set up to assign jobs to that person or group';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Seed only the combinations Andy actually specified -- Gardener and
-- Office are deliberately left unconfigured (no rows = nobody assignable
-- yet) rather than guessed at, since this table governs real permissions
-- and "explicit, no defaults" was the whole point of the design. Configure
-- them from Admin > Job Assignment.
do $$
declare
  v_org_id uuid;
  v_admin uuid;
  v_park_manager uuid;
  v_head_gardener uuid;
  v_gardener uuid;
  v_maintenance uuid;
  v_office uuid;
  v_caravan_prep uuid;
begin
  select id into v_org_id from public.organisations where name = 'Tree Tops Caravan Park Ltd';
  select id into v_admin from public.roles where org_id = v_org_id and name = 'Admin';
  select id into v_park_manager from public.roles where org_id = v_org_id and name = 'Park Manager';
  select id into v_head_gardener from public.roles where org_id = v_org_id and name = 'Head Gardener';
  select id into v_gardener from public.roles where org_id = v_org_id and name = 'Gardener';
  select id into v_maintenance from public.roles where org_id = v_org_id and name = 'Maintenance';
  select id into v_office from public.roles where org_id = v_org_id and name = 'Office';
  select id into v_caravan_prep from public.roles where org_id = v_org_id and name = 'Caravan Prep';

  -- Admin and Park Manager: everyone.
  if v_admin is not null then
    insert into public.role_assignable_roles (role_id, assignable_role_id)
    select v_admin, r.id from public.roles r where r.org_id = v_org_id
    on conflict do nothing;
  end if;

  if v_park_manager is not null then
    insert into public.role_assignable_roles (role_id, assignable_role_id)
    select v_park_manager, r.id from public.roles r where r.org_id = v_org_id
    on conflict do nothing;
  end if;

  -- Maintenance -> Admin, Head Gardener, Park Manager.
  if v_maintenance is not null then
    insert into public.role_assignable_roles (role_id, assignable_role_id)
    select v_maintenance, x.id from unnest(array[v_admin, v_head_gardener, v_park_manager]) as x(id)
    where x.id is not null
    on conflict do nothing;
  end if;

  -- Head Gardener -> Maintenance, Gardener, Office, Admin, Park Manager.
  if v_head_gardener is not null then
    insert into public.role_assignable_roles (role_id, assignable_role_id)
    select v_head_gardener, x.id from unnest(array[v_maintenance, v_gardener, v_office, v_admin, v_park_manager]) as x(id)
    where x.id is not null
    on conflict do nothing;
  end if;

  -- Caravan Prep -> itself, Park Manager, Admin.
  if v_caravan_prep is not null then
    insert into public.role_assignable_roles (role_id, assignable_role_id)
    select v_caravan_prep, x.id from unnest(array[v_caravan_prep, v_park_manager, v_admin]) as x(id)
    where x.id is not null
    on conflict do nothing;
  end if;
end $$;

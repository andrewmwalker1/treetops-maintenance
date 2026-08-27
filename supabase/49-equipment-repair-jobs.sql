-- Tree Tops Maintenance Platform -- reporting a fault auto-creates a repair
-- job, routed to whoever's configured to fix that equipment type.
--
-- Andy: different people/groups/contractors fix different machine types
-- (Dave -> strimmers, Andy -> small tractors, anyone in Maintenance ->
-- blowers), and a fault should turn into a trackable, assignable, notifying
-- job rather than a bare row nobody's pinged about. Rather than build a
-- second parallel "who's fixing this" mechanism, route it through the
-- existing jobs system -- same visibility, notifications, priority, and
-- completion flow every other job already gets for free.
--
-- equipment_type_repair_assignees: one row per equipment type (its default
-- fixer), plus at most one row with equipment_type_id null -- the org-wide
-- fallback used when a type has nothing configured. A row that exists but
-- has all three assignee columns null is treated the same as "no row" (see
-- the lookup in report_equipment_fault below) -- there's no separate way to
-- force a type to stay unassigned yet, deliberately kept simple for v1.

create table if not exists public.equipment_type_repair_assignees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  equipment_type_id uuid references public.equipment_types(id) on delete cascade,
  assignee_profile_id uuid references public.profiles(id) on delete set null,
  assignee_group_id uuid references public.groups(id) on delete set null,
  assignee_contractor_id uuid references public.contractors(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint equipment_type_repair_assignees_one_target check (
    num_nonnulls(assignee_profile_id, assignee_group_id, assignee_contractor_id) <= 1
  )
);

-- Partial unique indexes rather than a plain unique constraint on
-- (org_id, equipment_type_id) -- Postgres treats every NULL as distinct in
-- a unique constraint, which would let multiple "default" (equipment_type_id
-- is null) rows through per org.
create unique index if not exists equipment_type_repair_assignees_type_uidx
  on public.equipment_type_repair_assignees (org_id, equipment_type_id)
  where equipment_type_id is not null;
create unique index if not exists equipment_type_repair_assignees_default_uidx
  on public.equipment_type_repair_assignees (org_id)
  where equipment_type_id is null;

alter table public.equipment_type_repair_assignees enable row level security;

-- Same permission equipment_type_documents (26-equipment-type-documents.sql)
-- uses -- this is equipment-type reference data, gated by whoever already
-- manages equipment types/status, not the broader can_manage_reference_data.
drop policy if exists equipment_type_repair_assignees_select on public.equipment_type_repair_assignees;
create policy equipment_type_repair_assignees_select on public.equipment_type_repair_assignees
  for select using (org_id = public.current_org_id());

drop policy if exists equipment_type_repair_assignees_insert on public.equipment_type_repair_assignees;
create policy equipment_type_repair_assignees_insert on public.equipment_type_repair_assignees
  for insert with check (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'));

drop policy if exists equipment_type_repair_assignees_update on public.equipment_type_repair_assignees;
create policy equipment_type_repair_assignees_update on public.equipment_type_repair_assignees
  for update using (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'));

drop policy if exists equipment_type_repair_assignees_delete on public.equipment_type_repair_assignees;
create policy equipment_type_repair_assignees_delete on public.equipment_type_repair_assignees
  for delete using (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'));

-- Which machine a job is about, if any. Nullable -- most jobs still aren't
-- about a specific piece of equipment.
alter table public.jobs add column if not exists equipment_id uuid references public.equipment(id) on delete set null;
create index if not exists jobs_equipment_id_idx on public.jobs (equipment_id);

-- Traceability back from a fault to the job it spawned (nullable -- a fault
-- report predating this migration, or one where job creation was skipped
-- below because the org had no site/status configured, has none).
alter table public.fault_reports add column if not exists job_id uuid references public.jobs(id) on delete set null;
create index if not exists fault_reports_job_id_idx on public.fault_reports (job_id);

-- Superseded by the job this migration now creates -- the job's own
-- assignee is who's actually responsible for the repair going forward.
-- Column and its data are left in place (harmless, still historically
-- accurate for anything set before this change) but the app stops writing
-- to it.
comment on column public.fault_reports.appointed_person_id is
  'Superseded by fault_reports.job_id -> jobs.assignee_* as of migration 49. Left in place for old rows; no longer written by the app.';

-- report_equipment_fault gains a second return value (the auto-created
-- job's id, if one was created) -- return type changes from a bare uuid to
-- a row, so the old function has to be dropped first (CREATE OR REPLACE
-- can't change a function's return type).
drop function if exists public.report_equipment_fault(uuid, text, uuid);

create function public.report_equipment_fault(
  p_equipment_id uuid,
  p_description text,
  p_close_checkout_id uuid default null
) returns table (fault_report_id uuid, job_id uuid)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_fault_id uuid;
  v_job_id uuid;
  v_org_id uuid;
  v_site_id uuid;
  v_equipment_name text;
  v_equipment_type_id uuid;
  v_status_id uuid;
  v_assignee_profile_id uuid;
  v_assignee_group_id uuid;
  v_assignee_contractor_id uuid;
begin
  if not public.can_see_equipment(p_equipment_id) then
    raise exception 'Not authorized to report a fault for this equipment';
  end if;

  if p_close_checkout_id is not null and not exists (
    select 1 from public.equipment_checkouts
    where id = p_close_checkout_id
      and equipment_id = p_equipment_id
      and profile_id = auth.uid()
      and checked_in_at is null
  ) then
    raise exception 'No matching open checkout for this equipment belonging to you';
  end if;

  insert into public.fault_reports (equipment_id, reported_by, description)
  values (p_equipment_id, auth.uid(), p_description)
  returning id into v_fault_id;

  update public.equipment set status = 'faulty' where id = p_equipment_id;

  if p_close_checkout_id is not null then
    update public.equipment_checkouts
    set checked_in_at = now(), checked_in_by = auth.uid(), checkin_fault_report_id = v_fault_id
    where id = p_close_checkout_id;
  end if;

  -- Auto-create the linked repair job. jobs.site_id is not null (unlike
  -- equipment.site_id, which can be null for personally-held kit), so fall
  -- back to one of the reporter's own scoped sites when the equipment
  -- itself doesn't carry one.
  select e.org_id, e.site_id, e.name, e.equipment_type_id
  into v_org_id, v_site_id, v_equipment_name, v_equipment_type_id
  from public.equipment e
  where e.id = p_equipment_id;

  if v_site_id is null then
    select ss.site_id into v_site_id
    from public.site_scope ss
    where ss.profile_id = auth.uid()
    limit 1;
  end if;

  select id into v_status_id
  from public.job_statuses
  where org_id = v_org_id
  order by sort_order asc
  limit 1;

  -- Type-specific assignee first; if that type has no row, or a row with
  -- nothing actually set, fall back to the org-wide default row
  -- (equipment_type_id is null). Neither configured -> job is created
  -- unassigned rather than guessed at.
  select assignee_profile_id, assignee_group_id, assignee_contractor_id
  into v_assignee_profile_id, v_assignee_group_id, v_assignee_contractor_id
  from public.equipment_type_repair_assignees
  where org_id = v_org_id and equipment_type_id = v_equipment_type_id;

  if v_assignee_profile_id is null and v_assignee_group_id is null and v_assignee_contractor_id is null then
    select assignee_profile_id, assignee_group_id, assignee_contractor_id
    into v_assignee_profile_id, v_assignee_group_id, v_assignee_contractor_id
    from public.equipment_type_repair_assignees
    where org_id = v_org_id and equipment_type_id is null;
  end if;

  -- Only skip job creation if the org genuinely has no site or status
  -- configured yet (shouldn't happen post-seed) -- the fault report and
  -- status flip above still succeed either way.
  if v_site_id is not null and v_status_id is not null then
    insert into public.jobs (
      org_id, site_id, description, priority, status_id, equipment_id,
      assignee_profile_id, assignee_group_id, assignee_contractor_id, created_by
    ) values (
      v_org_id, v_site_id,
      'Repair: ' || coalesce(v_equipment_name, 'equipment') || ' — ' || p_description,
      'high', v_status_id, p_equipment_id,
      v_assignee_profile_id, v_assignee_group_id, v_assignee_contractor_id, auth.uid()
    )
    returning id into v_job_id;

    update public.fault_reports set job_id = v_job_id where id = v_fault_id;
  end if;

  return query select v_fault_id, v_job_id;
end;
$$;

grant execute on function public.report_equipment_fault(uuid, text, uuid) to authenticated;

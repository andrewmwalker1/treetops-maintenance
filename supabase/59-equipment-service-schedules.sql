-- Tree Tops Maintenance Platform -- equipment service schedules
-- Run after 58-equipment-hours-tracking.sql.
--
-- Andy: a service template (e.g. "Iseki SXG324") is defined once --
-- independent of any specific machine -- as a set of tiers (Initial
-- Service at 50 hours, Every 50 Hours, Every 300 Hours, Annual, ...),
-- each with its own checklist and who normally does it (in-house or a
-- contractor like Clwyd Agri). Applying a template to a piece of
-- equipment is what starts tracking it for that machine -- buy a second
-- Iseki, apply the same template, no redefinition needed. When a tier
-- comes due, a job gets generated automatically (checklist + assignee
-- from the tier) and the machine goes to Monitor until that job's done;
-- completing it asks when the next one's due and clears Monitor.

create table if not exists public.service_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  -- Templates attach at the type level -- there's no separate "equipment
  -- model" entity in this schema. Andy: create equipment types at model
  -- granularity (e.g. "Iseki SXG324") where service needs actually
  -- differ, rather than one broad "Tractor" type covering several models.
  equipment_type_id uuid references public.equipment_types(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.service_template_tiers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  template_id uuid not null references public.service_templates(id) on delete cascade,
  name text not null,
  trigger_type text not null check (trigger_type in ('hours', 'date')),
  hours_interval int,
  date_interval_months int,
  -- false = fires once (an initial service) and never again, even once
  -- its own interval has since passed again. true = fires every time its
  -- interval elapses, indefinitely (e.g. "Every 50 Hours").
  is_recurring boolean not null default true,
  sort_order int not null default 0,
  -- Same {label, requiresPhoto} shape as job_types.template_schema --
  -- the one reusable checklist format in this codebase, materialised
  -- into job_subtasks on generation exactly the way NewJob.jsx does for
  -- an ordinary job template.
  checklist jsonb not null default '[]'::jsonb,
  default_assignee_profile_id uuid references public.profiles(id) on delete set null,
  default_assignee_group_id uuid references public.groups(id) on delete set null,
  default_assignee_contractor_id uuid references public.contractors(id) on delete set null,
  constraint service_template_tiers_trigger_shape check (
    (trigger_type = 'hours' and hours_interval is not null and date_interval_months is null)
    or (trigger_type = 'date' and date_interval_months is not null and hours_interval is null)
  ),
  constraint service_template_tiers_one_assignee check (
    num_nonnulls(default_assignee_profile_id, default_assignee_group_id, default_assignee_contractor_id) <= 1
  )
);

-- One row per "this machine follows this template". A machine could in
-- principle have more than one template applied (unusual, not blocked).
create table if not exists public.equipment_service_schedules (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  service_template_id uuid not null references public.service_templates(id) on delete cascade,
  applied_at timestamptz not null default now(),
  unique (equipment_id, service_template_id)
);

-- Per-machine, per-tier tracking -- next_due_* is the actual due point
-- (not "last completed + interval" computed on the fly), because
-- completing the tier's job asks the person directly when the next one's
-- due rather than always trusting a fixed interval ("that could be at
-- 150 hours or a specific date" -- Andy). Set initially when a template
-- is applied (apply_service_template below), advanced each time the
-- tier's job is completed.
create table if not exists public.equipment_service_tier_state (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  tier_id uuid not null references public.service_template_tiers(id) on delete cascade,
  next_due_hours numeric,
  next_due_date date,
  last_completed_at timestamptz,
  last_completed_hours numeric,
  last_completed_by uuid references public.profiles(id) on delete set null,
  unique (equipment_id, tier_id)
);

-- Which tier(s) a generated job actually covers -- a many-to-many join
-- rather than a single column on jobs, since multiple tiers due at once
-- (e.g. the 50/100/300-hour tiers all landing together) become ONE
-- combined job, not several arriving on the same day.
create table if not exists public.job_service_tiers (
  job_id uuid not null references public.jobs(id) on delete cascade,
  tier_id uuid not null references public.service_template_tiers(id) on delete cascade,
  primary key (job_id, tier_id)
);

-- Automatic (cron-generated) monitor-flag events have no real actor --
-- same reasoning as jobs.created_by already being nullable for the
-- recurring-job generator (01-schema.sql's own comment on that column).
alter table public.equipment_monitor_events alter column created_by drop not null;

alter table public.service_templates enable row level security;
alter table public.service_template_tiers enable row level security;
alter table public.equipment_service_schedules enable row level security;
alter table public.equipment_service_tier_state enable row level security;
alter table public.job_service_tiers enable row level security;

drop policy if exists service_templates_select on public.service_templates;
create policy service_templates_select on public.service_templates
  for select using (org_id = public.current_org_id());
drop policy if exists service_templates_insert on public.service_templates;
create policy service_templates_insert on public.service_templates
  for insert with check (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'));
drop policy if exists service_templates_update on public.service_templates;
create policy service_templates_update on public.service_templates
  for update using (org_id = public.current_org_id()) with check (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'));
drop policy if exists service_templates_delete on public.service_templates;
create policy service_templates_delete on public.service_templates
  for delete using (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'));

drop policy if exists service_template_tiers_select on public.service_template_tiers;
create policy service_template_tiers_select on public.service_template_tiers
  for select using (org_id = public.current_org_id());
drop policy if exists service_template_tiers_insert on public.service_template_tiers;
create policy service_template_tiers_insert on public.service_template_tiers
  for insert with check (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'));
drop policy if exists service_template_tiers_update on public.service_template_tiers;
create policy service_template_tiers_update on public.service_template_tiers
  for update using (org_id = public.current_org_id()) with check (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'));
drop policy if exists service_template_tiers_delete on public.service_template_tiers;
create policy service_template_tiers_delete on public.service_template_tiers
  for delete using (org_id = public.current_org_id() and public.has_permission('can_manage_equipment_status'));

drop policy if exists equipment_service_schedules_select on public.equipment_service_schedules;
create policy equipment_service_schedules_select on public.equipment_service_schedules
  for select using (public.can_see_equipment(equipment_id));
drop policy if exists equipment_service_schedules_delete on public.equipment_service_schedules;
create policy equipment_service_schedules_delete on public.equipment_service_schedules
  for delete using (public.can_see_equipment(equipment_id) and public.has_permission('can_manage_equipment_status'));

drop policy if exists equipment_service_tier_state_select on public.equipment_service_tier_state;
create policy equipment_service_tier_state_select on public.equipment_service_tier_state
  for select using (public.can_see_equipment(equipment_id));
-- Client-side write path for job completion (writeJobCompletion,
-- completeJob.js) -- same permission gate as the equipment/monitor-event
-- writes the "available"/"monitor" completion outcomes already do.
drop policy if exists equipment_service_tier_state_update on public.equipment_service_tier_state;
create policy equipment_service_tier_state_update on public.equipment_service_tier_state
  for update using (public.can_see_equipment(equipment_id))
  with check (public.can_see_equipment(equipment_id) and public.has_permission('can_manage_equipment_status'));

drop policy if exists job_service_tiers_select on public.job_service_tiers;
create policy job_service_tiers_select on public.job_service_tiers
  for select using (public.can_see_job(job_id));

-- apply_service_template: links a template to a machine and seeds its
-- initial due points. Starting point is "now" (current hours reading /
-- today), not the template's own history -- correct for a used machine
-- getting hours-tracking retrofitted, which is the real case here.
create or replace function public.apply_service_template(p_equipment_id uuid, p_template_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_equipment record;
  v_tier record;
begin
  if not public.has_permission('can_manage_equipment_status') then
    raise exception 'Not authorized to apply a service template';
  end if;

  select * into v_equipment from public.equipment where id = p_equipment_id;
  if v_equipment.id is null then
    raise exception 'Equipment not found';
  end if;

  insert into public.equipment_service_schedules (equipment_id, service_template_id)
  values (p_equipment_id, p_template_id)
  on conflict (equipment_id, service_template_id) do nothing;

  for v_tier in select * from public.service_template_tiers where template_id = p_template_id loop
    insert into public.equipment_service_tier_state (equipment_id, tier_id, next_due_hours, next_due_date)
    values (
      p_equipment_id,
      v_tier.id,
      case when v_tier.trigger_type = 'hours' then coalesce(v_equipment.last_hours_reading, 0) + v_tier.hours_interval else null end,
      case when v_tier.trigger_type = 'date' then (current_date + (v_tier.date_interval_months || ' months')::interval)::date else null end
    )
    on conflict (equipment_id, tier_id) do nothing;
  end loop;

  perform public.generate_due_service_jobs_for_equipment(p_equipment_id);
end;
$$;

grant execute on function public.apply_service_template(uuid, uuid) to authenticated;

-- The one function that actually decides "is anything due, and if so
-- raise a job for it" -- called from two places: record_equipment_hours
-- (58-equipment-hours-tracking.sql, redefined below) right after a new
-- reading lands, since hours only ever change at checkout; and daily via
-- cron (generate_due_service_jobs below) for date-based tiers, which
-- otherwise might never get re-checked if a machine's hours aren't read
-- again for a while.
create or replace function public.generate_due_service_jobs_for_equipment(p_equipment_id uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_equipment record;
  v_due_tier record;
  v_due_tier_ids uuid[] := '{}';
  v_checklist jsonb := '[]'::jsonb;
  v_names text[] := '{}';
  v_assignee_profile_id uuid;
  v_assignee_group_id uuid;
  v_assignee_contractor_id uuid;
  v_assignee_conflict boolean := false;
  v_first boolean := true;
  v_job_id uuid;
  v_status_id uuid;
  v_item jsonb;
begin
  select * into v_equipment from public.equipment where id = p_equipment_id;
  if v_equipment.id is null then
    return;
  end if;

  for v_due_tier in
    select t.id, t.name, t.checklist, t.default_assignee_profile_id, t.default_assignee_group_id, t.default_assignee_contractor_id
    from public.equipment_service_tier_state s
    join public.service_template_tiers t on t.id = s.tier_id
    where s.equipment_id = p_equipment_id
      and (
        (t.trigger_type = 'hours' and s.next_due_hours is not null and v_equipment.last_hours_reading is not null and v_equipment.last_hours_reading >= s.next_due_hours)
        or (t.trigger_type = 'date' and s.next_due_date is not null and current_date >= s.next_due_date)
      )
      and (t.is_recurring or s.last_completed_at is null)
      -- Don't raise a second job for a tier that already has an open one.
      and not exists (
        select 1
        from public.job_service_tiers jst
        join public.jobs j on j.id = jst.job_id
        join public.job_statuses js on js.id = j.status_id
        where jst.tier_id = t.id and j.equipment_id = p_equipment_id and not js.is_completed
      )
    order by t.sort_order
  loop
    v_due_tier_ids := v_due_tier_ids || v_due_tier.id;
    v_names := v_names || v_due_tier.name;

    for v_item in select * from jsonb_array_elements(coalesce(v_due_tier.checklist, '[]'::jsonb)) loop
      v_checklist := v_checklist || jsonb_build_object(
        'label', v_due_tier.name || ': ' || (v_item ->> 'label'),
        'requiresPhoto', coalesce((v_item ->> 'requiresPhoto')::boolean, false)
      );
    end loop;

    -- Every due tier shares one assignee if they all agree; otherwise the
    -- job's left unassigned (rather than guessing) and the combined
    -- description below names every tier so it's obvious who needs to
    -- route it manually.
    if v_first then
      v_assignee_profile_id := v_due_tier.default_assignee_profile_id;
      v_assignee_group_id := v_due_tier.default_assignee_group_id;
      v_assignee_contractor_id := v_due_tier.default_assignee_contractor_id;
      v_first := false;
    elsif not v_assignee_conflict and (
      v_assignee_profile_id is distinct from v_due_tier.default_assignee_profile_id
      or v_assignee_group_id is distinct from v_due_tier.default_assignee_group_id
      or v_assignee_contractor_id is distinct from v_due_tier.default_assignee_contractor_id
    ) then
      v_assignee_conflict := true;
    end if;
  end loop;

  if array_length(v_due_tier_ids, 1) is null then
    return;
  end if;

  if v_assignee_conflict then
    v_assignee_profile_id := null;
    v_assignee_group_id := null;
    v_assignee_contractor_id := null;
  end if;

  select id into v_status_id from public.job_statuses where org_id = v_equipment.org_id and not is_completed order by sort_order limit 1;

  insert into public.jobs (org_id, site_id, description, status_id, equipment_id, assignee_profile_id, assignee_group_id, assignee_contractor_id)
  values (
    v_equipment.org_id,
    v_equipment.site_id,
    'Service due (' || array_to_string(v_names, ', ') || ') — ' || v_equipment.name,
    v_status_id,
    p_equipment_id,
    v_assignee_profile_id,
    v_assignee_group_id,
    v_assignee_contractor_id
  )
  returning id into v_job_id;

  insert into public.job_subtasks (job_id, label, requires_photo, sort_order)
  select v_job_id, item ->> 'label', coalesce((item ->> 'requiresPhoto')::boolean, false), ord - 1
  from jsonb_array_elements(v_checklist) with ordinality as t(item, ord);

  insert into public.job_service_tiers (job_id, tier_id)
  select v_job_id, x from unnest(v_due_tier_ids) as x;

  update public.equipment
  set status = 'monitor', monitor_note = 'Service due: ' || array_to_string(v_names, ', ')
  where id = p_equipment_id;

  insert into public.equipment_monitor_events (equipment_id, note, event_type, created_by)
  values (p_equipment_id, 'Service due: ' || array_to_string(v_names, ', '), 'flagged', auth.uid());
end;
$$;

-- record_equipment_hours (58-equipment-hours-tracking.sql), redefined to
-- also check for newly-due service tiers right after the reading lands.
create or replace function public.record_equipment_hours(
  p_equipment_id uuid,
  p_checkout_id uuid,
  p_hours_value numeric
) returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_last numeric;
begin
  if not public.can_see_equipment(p_equipment_id) then
    raise exception 'Not authorized to record hours for this equipment';
  end if;

  if p_checkout_id is not null and not exists (
    select 1 from public.equipment_checkouts
    where id = p_checkout_id and equipment_id = p_equipment_id and profile_id = auth.uid()
  ) then
    raise exception 'No matching checkout for this equipment belonging to you';
  end if;

  select last_hours_reading into v_last from public.equipment where id = p_equipment_id;
  if v_last is not null and p_hours_value < v_last then
    raise exception 'New hours reading (%) is less than the last recorded reading (%)', p_hours_value, v_last;
  end if;

  insert into public.equipment_hours_readings (equipment_id, checkout_id, hours_value, recorded_by)
  values (p_equipment_id, p_checkout_id, p_hours_value, auth.uid());

  update public.equipment
  set last_hours_reading = p_hours_value, last_hours_reading_at = now()
  where id = p_equipment_id;

  perform public.generate_due_service_jobs_for_equipment(p_equipment_id);
end;
$$;

-- Daily cron entry point (date-based tiers) -- pure SQL, no Edge
-- Function/pg_net hop needed unlike generate-scheduled-jobs, so this can
-- schedule itself right here rather than needing the manual dashboard
-- step RUNBOOK.md documents for the HTTP-triggered ones.
create or replace function public.generate_due_service_jobs()
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_equipment_id uuid;
begin
  for v_equipment_id in select distinct equipment_id from public.equipment_service_schedules loop
    perform public.generate_due_service_jobs_for_equipment(v_equipment_id);
  end loop;
end;
$$;

select cron.schedule('generate-service-jobs-daily', '0 6 * * *', $$select public.generate_due_service_jobs();$$);

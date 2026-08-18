-- Tree Tops Maintenance Platform -- bring recurring jobs (schedules) up
-- to parity with the one-off New Job form, and add due-date reminders.
-- Run after 30-schedule-pause-resume.sql.
--
-- Andy testing recurring jobs found three gaps: no way to assign a
-- schedule to a person/group, no way to have "no template" (job_type_id
-- was NOT NULL), and no description that carries through to generated
-- jobs (they always used the template's name). Fixing those surfaced a
-- fourth: SchedulesTab was missing priority, location, and activity
-- types, all of which the one-off form already has.

alter table public.schedules
  add column if not exists description text,
  add column if not exists priority public.job_priority not null default 'medium',
  add column if not exists assignee_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists assignee_group_id uuid references public.groups(id) on delete set null,
  add column if not exists pitch_id uuid references public.pitches(id) on delete set null,
  add column if not exists area_id uuid references public.areas(id) on delete set null;

alter table public.schedules drop constraint if exists schedules_single_assignee;
alter table public.schedules
  add constraint schedules_single_assignee check (
    not (assignee_profile_id is not null and assignee_group_id is not null)
  );

-- A recurring job can now stand on its own description with no
-- template/checklist behind it.
alter table public.schedules alter column job_type_id drop not null;

-- Backfill every existing schedule's description from its template's
-- name before making the column required, so nothing is left blank now
-- that the form always requires one going forward.
update public.schedules s
set description = jt.name
from public.job_types jt
where s.job_type_id = jt.id and s.description is null;

alter table public.schedules alter column description set not null;

-- Recurring-job activity types -- same shape as job_type_task_types
-- (09-job-type-activities.sql): the default set of activity types
-- attached to every job this schedule generates.
create table if not exists public.schedule_task_types (
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  task_type_id uuid not null references public.task_types(id) on delete cascade,
  primary key (schedule_id, task_type_id)
);

alter table public.schedule_task_types enable row level security;

drop policy if exists schedule_task_types_select on public.schedule_task_types;
create policy schedule_task_types_select on public.schedule_task_types
  for select using (
    exists (select 1 from public.schedules s where s.id = schedule_task_types.schedule_id and public.has_site_scope(s.site_id))
  );

drop policy if exists schedule_task_types_insert on public.schedule_task_types;
create policy schedule_task_types_insert on public.schedule_task_types
  for insert with check (
    exists (select 1 from public.schedules s where s.id = schedule_task_types.schedule_id and s.org_id = public.current_org_id())
    and public.has_permission('can_manage_reference_data')
  );

drop policy if exists schedule_task_types_delete on public.schedule_task_types;
create policy schedule_task_types_delete on public.schedule_task_types
  for delete using (
    exists (select 1 from public.schedules s where s.id = schedule_task_types.schedule_id and s.org_id = public.current_org_id())
    and public.has_permission('can_manage_reference_data')
  );

-- Due-date push reminders: generate-scheduled-jobs now also nudges a
-- schedule-generated job's assignee on the day it's due if it's still
-- open. This dedup column stops a second cron run on the same day (or
-- a manual re-trigger) from sending it twice.
alter table public.jobs add column if not exists due_reminder_sent_at timestamptz;

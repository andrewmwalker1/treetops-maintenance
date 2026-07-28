-- Tree Tops Maintenance Platform — default activities per job template
-- Run after 08-roles-and-permissions-admin.sql.
--
-- Andy asked for picking a job template on New Job to pre-tick the
-- activity types that template usually needs. This is deliberately a
-- *default list* to pre-fill from, not a reinstatement of the 1:1
-- job_type -> task_type link removed in 06-*.sql: the per-job
-- job_activity_types table remains the actual source of truth and
-- stays freely editable after a template is picked.

create table if not exists public.job_type_task_types (
  job_type_id uuid not null references public.job_types(id) on delete cascade,
  task_type_id uuid not null references public.task_types(id) on delete cascade,
  primary key (job_type_id, task_type_id)
);

alter table public.job_type_task_types enable row level security;

drop policy if exists job_type_task_types_select on public.job_type_task_types;
create policy job_type_task_types_select on public.job_type_task_types
  for select using (
    exists (select 1 from public.job_types jt where jt.id = job_type_task_types.job_type_id and jt.org_id = public.current_org_id())
  );

drop policy if exists job_type_task_types_insert on public.job_type_task_types;
create policy job_type_task_types_insert on public.job_type_task_types
  for insert with check (
    exists (select 1 from public.job_types jt where jt.id = job_type_task_types.job_type_id and jt.org_id = public.current_org_id())
    and public.has_permission('can_manage_reference_data')
  );

drop policy if exists job_type_task_types_delete on public.job_type_task_types;
create policy job_type_task_types_delete on public.job_type_task_types
  for delete using (
    exists (select 1 from public.job_types jt where jt.id = job_type_task_types.job_type_id and jt.org_id = public.current_org_id())
    and public.has_permission('can_manage_reference_data')
  );

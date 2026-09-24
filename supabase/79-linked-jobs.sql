-- Tree Tops Maintenance Platform -- linked jobs (hand-offs, "needed to
-- finish" jobs, and follow-on work). Run after 78-timesheet-week-notes.sql.
-- Idempotent, safe to re-run.
--
-- A job can be linked to the job it came from (parent_job_id) as one of:
--   handoff  -- someone else does one checklist item (parent_subtask_id) of
--               the parent job. Completing the linked job ticks that item;
--               cancelling it (or reopening it) unticks it again.
--   needed   -- extra work needed before the parent job can be finished
--               (e.g. "order materials"). The parent warns on completion
--               while it's still open.
--   followon -- separate work spotted while doing the parent job, linked
--               for reference only (e.g. caravan prep -> "replace awning
--               rail" later). Never warns.
--
-- parent_subtask_id deliberately has NO foreign key: jobs already has a
-- one-to-many relationship to job_subtasks (job_subtasks.job_id), and a
-- second jobs -> job_subtasks FK would make every existing PostgREST
-- `job_subtasks(...)` embed ambiguous (PGRST201). Deleting a checklist item
-- clears it via job_subtasks_clear_linked_job below instead.

alter table public.jobs add column if not exists parent_job_id uuid references public.jobs(id) on delete set null;
alter table public.jobs add column if not exists parent_subtask_id uuid;
alter table public.jobs add column if not exists link_kind text;

alter table public.jobs drop constraint if exists jobs_link_kind_check;
-- Loose on purpose: the parent job or item can be deleted afterwards
-- (FK set null / job_subtasks_clear_linked_job below), leaving the kind in
-- place. The full shape of a NEW link is checked by jobs_validate_link.
alter table public.jobs add constraint jobs_link_kind_check check (
  (link_kind is null or link_kind in ('handoff', 'needed', 'followon'))
  and (parent_subtask_id is null or link_kind = 'handoff')
);

create index if not exists jobs_parent_job_id_idx on public.jobs (parent_job_id) where parent_job_id is not null;
create index if not exists jobs_parent_subtask_id_idx on public.jobs (parent_subtask_id) where parent_subtask_id is not null;

alter type public.job_activity_event_type add value if not exists 'linked_job';

-- ---------------------------------------------------------------------------
-- Visibility. Rebuilt from 56-contractor-employee-job-visibility.sql, plus:
--  * created_by = auth.uid() -- restored. 51-jobs-creator-always-visible.sql
--    added it, but 56 replaced the whole function from the pre-51 version
--    and silently dropped it again, so whoever raised a job for someone
--    else lost sight of it. Linked jobs depend on it (Sam must see the
--    materials job Sam raised for Andy).
--  * the assignee of a linked job can see its parent (the job it came from).
--  * the assignee of a parent job can see the jobs linked to it (so Sam
--    sees "waiting on ..." even when someone else raised the linked job).
-- Both one level only, and both reuse the same "is this job assigned to me
-- (directly, via a group, or via my contractor company)" test.
-- ---------------------------------------------------------------------------
create or replace function public.job_is_assigned_to_me(p_job_id uuid)
returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.jobs j
    where j.id = p_job_id
      and (
        j.assignee_profile_id = auth.uid()
        or (j.assignee_group_id is not null and public.is_in_group(j.assignee_group_id))
        or (
          j.assignee_contractor_id is not null
          and j.assignee_contractor_id = (select p.contractor_id from public.profiles p where p.id = auth.uid())
        )
      )
  );
$$;

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
            or (
              j.assignee_contractor_id is not null
              and j.assignee_contractor_id = (select p.contractor_id from public.profiles p where p.id = auth.uid())
            )
            or (j.assignee_contractor_id is not null and public.has_permission('can_see_contractor_jobs'))
            or public.has_permission('can_see_all_jobs')
            or (j.parent_job_id is not null and public.job_is_assigned_to_me(j.parent_job_id))
            or exists (
              select 1 from public.jobs c
              where c.parent_job_id = j.id and public.job_is_assigned_to_me(c.id)
            )
          )
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Validate the link on insert (and refuse re-pointing it later -- clearing
-- it, as the FK's on delete set null does, is fine).
-- Named to sort after jobs_enforce_* so it runs after them: a hand-off of a
-- photo-required item copies requires_photo onto the new job, which must not
-- then be refused by a caller-permission check meant for manual changes
-- (that check is update-only today, but ordering keeps it safe either way).
-- ---------------------------------------------------------------------------
create or replace function public.jobs_validate_link()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_parent public.jobs%rowtype;
  v_subtask public.job_subtasks%rowtype;
begin
  if tg_op = 'UPDATE' then
    if (new.parent_job_id is distinct from old.parent_job_id and new.parent_job_id is not null)
       or (new.parent_subtask_id is distinct from old.parent_subtask_id and new.parent_subtask_id is not null)
       or (new.link_kind is distinct from old.link_kind) then
      raise exception 'A job''s link to the job it came from can''t be changed after it''s created';
    end if;
    return new;
  end if;

  if new.parent_job_id is null then
    if new.link_kind is not null or new.parent_subtask_id is not null then
      raise exception 'A linked job needs the job it came from';
    end if;
    return new;
  end if;
  if new.link_kind is null then
    raise exception 'A linked job needs a link kind';
  end if;
  if (new.link_kind = 'handoff') <> (new.parent_subtask_id is not null) then
    raise exception 'Only a hand-off is linked to a checklist item, and a hand-off always is';
  end if;

  if new.parent_job_id = new.id then
    raise exception 'A job can''t be linked to itself';
  end if;

  select * into v_parent from public.jobs where id = new.parent_job_id;
  if not found or v_parent.org_id <> new.org_id then
    raise exception 'The job this is linked to doesn''t exist';
  end if;
  -- auth.uid() is null only for service-role/migration writes.
  if auth.uid() is not null and not public.can_see_job(new.parent_job_id) then
    raise exception 'You can''t link to a job you can''t see';
  end if;

  if new.link_kind = 'handoff' then
    select * into v_subtask from public.job_subtasks where id = new.parent_subtask_id;
    if not found or v_subtask.job_id <> new.parent_job_id then
      raise exception 'That checklist item isn''t on the job being handed off from';
    end if;
    if v_subtask.is_checked then
      raise exception 'That checklist item is already done';
    end if;
    if exists (
      select 1 from public.jobs o
      join public.job_statuses s on s.id = o.status_id
      where o.parent_subtask_id = new.parent_subtask_id and not s.is_completed
    ) then
      raise exception 'That checklist item has already been handed off';
    end if;
    -- "Carried over" rather than bypassed: the item needed a photo, so the
    -- job doing it does too (enforced at completion by
    -- enforce_job_completion_photo_requirement, same as any other job).
    if v_subtask.requires_photo then
      new.requires_photo := true;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists jobs_link_validate on public.jobs;
create trigger jobs_link_validate
  before insert or update of parent_job_id, parent_subtask_id, link_kind on public.jobs
  for each row execute function public.jobs_validate_link();

-- ---------------------------------------------------------------------------
-- Checklist-item photo check: skip it for the tick made on a hand-off's
-- behalf (the photo requirement was carried over to -- and enforced on --
-- the linked job instead; see above). The flag is a transaction-local
-- setting only this file's trigger sets; PostgREST doesn't expose
-- set_config, so a client can't set it. Otherwise identical to
-- 32-checklist-item-photo-requirement.sql.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_checklist_item_photo_requirement()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_has_photo boolean;
begin
  if coalesce(current_setting('treetops.linked_job_sync', true), '') = 'on' then
    return new;
  end if;
  if new.is_checked and not old.is_checked and new.requires_photo
     and not public.has_permission('can_check_off_item_without_photo') then
    select exists (select 1 from public.job_photos where job_subtask_id = new.id) into v_has_photo;
    if not v_has_photo then
      raise exception 'This checklist item requires a photo before it can be checked off';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- After a linked job is created or closed/reopened: tick/untick the handed
-- -off item and note it on the parent job's activity log. Done here rather
-- than in the app so it still happens for a job created offline and synced
-- later, and whichever screen closes the job.
-- ---------------------------------------------------------------------------
create or replace function public.jobs_sync_linked_parent()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := coalesce(auth.uid(), new.closed_by, new.created_by);
  v_old_status public.job_statuses%rowtype;
  v_new_status public.job_statuses%rowtype;
  v_outcome text;
begin
  if new.parent_job_id is null or v_actor is null then
    return null;
  end if;

  if tg_op = 'INSERT' then
    insert into public.job_activity (job_id, event_type, actor_profile_id, new_value)
    values (new.parent_job_id, 'linked_job', v_actor,
            jsonb_build_object('outcome', 'created', 'linked_job_id', new.id,
                               'description', new.description, 'link_kind', new.link_kind));
    return null;
  end if;

  if new.status_id is not distinct from old.status_id then
    return null;
  end if;
  select * into v_old_status from public.job_statuses where id = old.status_id;
  select * into v_new_status from public.job_statuses where id = new.status_id;
  if v_old_status.is_completed = v_new_status.is_completed then
    return null;
  end if;

  -- Cancelled is the one closed status that means "not done" (see
  -- job_statuses seed: Open, In Progress, Completed, Cancelled).
  v_outcome := case
    when not v_new_status.is_completed then 'reopened'
    when v_new_status.name = 'Cancelled' then 'cancelled'
    else 'completed'
  end;

  if new.link_kind = 'handoff' and new.parent_subtask_id is not null then
    perform set_config('treetops.linked_job_sync', 'on', true);
    update public.job_subtasks
       set is_checked = (v_outcome = 'completed')
     where id = new.parent_subtask_id
       and is_checked is distinct from (v_outcome = 'completed');
    perform set_config('treetops.linked_job_sync', 'off', true);
  end if;

  insert into public.job_activity (job_id, event_type, actor_profile_id, new_value)
  values (new.parent_job_id, 'linked_job', v_actor,
          jsonb_build_object('outcome', v_outcome, 'linked_job_id', new.id,
                             'description', new.description, 'link_kind', new.link_kind));
  return null;
end;
$$;

drop trigger if exists jobs_sync_linked_parent on public.jobs;
create trigger jobs_sync_linked_parent
  after insert or update of status_id on public.jobs
  for each row execute function public.jobs_sync_linked_parent();

-- Deleting a handed-off checklist item leaves the linked job standing on
-- its own (as the parent job's own deletion does, via the FK above).
create or replace function public.job_subtasks_clear_linked_job()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  update public.jobs set parent_subtask_id = null where parent_subtask_id = old.id;
  return old;
end;
$$;

drop trigger if exists job_subtasks_clear_linked_job on public.job_subtasks;
create trigger job_subtasks_clear_linked_job
  before delete on public.job_subtasks
  for each row execute function public.job_subtasks_clear_linked_job();

-- Tree Tops Maintenance Platform -- block completing a job while any
-- per-checklist-item photo requirement (32-checklist-item-photo-
-- requirement.sql) is still outstanding.
-- Run after 32-checklist-item-photo-requirement.sql.
--
-- Distinct from jobs.requires_photo (19-job-completion-photo-requirement.sql,
-- the whole-job hard flag, bypassable by can_complete_job_without_photo) --
-- this new check has no permission bypass of its own, because the escape
-- valve already exists at the item level: can_check_off_item_without_photo
-- lets someone check an item off without a photo, which clears it from
-- "outstanding" and unblocks completion. Extends the same trigger
-- function from 19-*.sql rather than adding a second trigger, since both
-- checks fire on the same event (status_id transitioning to a completed
-- status) -- one exception wins over the other, order doesn't matter here.

create or replace function public.enforce_job_completion_photo_requirement()
returns trigger as $$
declare
  v_old_completed boolean;
  v_new_completed boolean;
  v_has_photo boolean;
  v_outstanding_count integer;
begin
  select is_completed into v_old_completed from public.job_statuses where id = old.status_id;
  select is_completed into v_new_completed from public.job_statuses where id = new.status_id;

  if v_new_completed and not v_old_completed then
    if new.requires_photo and not public.has_permission('can_complete_job_without_photo') then
      select exists (select 1 from public.job_photos where job_id = new.id) into v_has_photo;
      if not v_has_photo then
        raise exception 'This job requires a photo before it can be completed';
      end if;
    end if;

    select count(*) into v_outstanding_count
    from public.job_subtasks
    where job_id = new.id and requires_photo and not is_checked;
    if v_outstanding_count > 0 then
      raise exception 'This job has % checklist item(s) that still need a photo before it can be completed', v_outstanding_count;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

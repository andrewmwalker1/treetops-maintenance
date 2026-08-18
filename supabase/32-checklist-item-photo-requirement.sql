-- Tree Tops Maintenance Platform -- per-checklist-item photo requirement
-- Run after 31-schedule-fields-and-due-reminders.sql.
--
-- H&S request: some checklist items are safety-critical enough that
-- ticking them off should require photographic evidence, not just "did
-- this job get a photo somewhere" (jobs.requires_photo /
-- job_types.requires_completion_photo -- both whole-job flags, see
-- 19-job-completion-photo-requirement.sql). This is a separate, more
-- granular mechanism: the flag lives on the checklist item itself, and
-- checking it off without a linked photo is blocked unless the caller
-- holds a dedicated override permission.
--
-- Two new permissions, deliberately NOT reusing
-- can_complete_job_without_photo: that one governs "no photo anywhere
-- on the whole job", already granted to roles for ordinary practical
-- reasons unrelated to safety-critical evidence. Sharing it would mean
-- anyone already holding it silently gets to wave through a
-- safety-critical item too, the moment this ships, without Andy ever
-- deciding that on purpose.
insert into public.permissions (key, description) values
  ('can_require_checklist_item_photo', 'Can mark a checklist item as requiring a photo before it can be checked off'),
  ('can_check_off_item_without_photo', 'Can check off a photo-required checklist item without attaching a photo')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, p.key, true
from public.roles r
cross join (values ('can_require_checklist_item_photo'), ('can_check_off_item_without_photo')) as p(key)
where r.name = 'Admin'
  and r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
on conflict do nothing;

alter table public.job_subtasks add column if not exists requires_photo boolean not null default false;

-- Nullable, set on delete null (not cascade) -- if the checklist item
-- itself is later removed, the photo is still real evidence that was
-- taken and shouldn't disappear with it; it just becomes an ordinary
-- unlinked job photo.
alter table public.job_photos add column if not exists job_subtask_id uuid references public.job_subtasks(id) on delete set null;

-- template_schema was a plain array of label strings; existing rows get
-- upgraded to {label, requiresPhoto} objects so every reader can assume
-- one consistent shape going forward instead of branching on either
-- format everywhere. Guarded on the first element still being a string
-- so this is safe to run more than once and never double-wraps.
update public.job_types
set template_schema = (
  select jsonb_agg(jsonb_build_object('label', elem, 'requiresPhoto', false))
  from jsonb_array_elements_text(template_schema) as elem
)
where template_schema is not null
  and jsonb_typeof(template_schema) = 'array'
  and jsonb_typeof(template_schema -> 0) = 'string';

-- Checking an item off (false -> true) needs either a photo already
-- linked to it, or the override permission. Unchecking is never gated.
create or replace function public.enforce_checklist_item_photo_requirement()
returns trigger as $$
declare
  v_has_photo boolean;
begin
  if new.is_checked and not old.is_checked and new.requires_photo
     and not public.has_permission('can_check_off_item_without_photo') then
    select exists (select 1 from public.job_photos where job_subtask_id = new.id) into v_has_photo;
    if not v_has_photo then
      raise exception 'This checklist item requires a photo before it can be checked off';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists job_subtasks_enforce_photo_requirement on public.job_subtasks;
create trigger job_subtasks_enforce_photo_requirement
  before update on public.job_subtasks
  for each row
  when (old.is_checked is distinct from new.is_checked)
  execute function public.enforce_checklist_item_photo_requirement();

-- Setting/clearing requires_photo itself needs can_require_checklist_item_photo
-- -- job_subtasks_insert/update (02-rls-policies.sql) only check
-- can_see_job, so without this an ordinary can_edit_job_checklist holder
-- could mark (or unmark) something safety-critical.
create or replace function public.enforce_checklist_requires_photo_permission()
returns trigger as $$
begin
  if (tg_op = 'INSERT' and new.requires_photo)
     or (tg_op = 'UPDATE' and new.requires_photo is distinct from old.requires_photo) then
    if not public.has_permission('can_require_checklist_item_photo') then
      raise exception 'Marking a checklist item as requiring a photo needs the can_require_checklist_item_photo permission';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists job_subtasks_enforce_requires_photo_permission on public.job_subtasks;
create trigger job_subtasks_enforce_requires_photo_permission
  before insert or update on public.job_subtasks
  for each row execute function public.enforce_checklist_requires_photo_permission();

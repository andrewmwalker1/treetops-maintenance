-- Tree Tops Maintenance Platform -- per-job "photo required" flag
-- Run after 18-equipment-checkout-log-admin.sql.
--
-- Distinct from job_types.requires_completion_photo (a soft, per-job-type
-- confirm-dialog check that only fires when the closer is the assignee --
-- see JobDetail.jsx confirmComplete/handleStatusChange). This is a hard,
-- per-job flag set at creation time, enforced server-side for every
-- completion path (button, dropdown, and the kiosk) via a jobs trigger,
-- not just a client-side confirm() the user can click through.
--
-- Two permissions:
-- - can_require_job_photo: gates the "Require photo" checkbox on the New
--   Job screen (NewJob.jsx), same pattern as can_edit_job_checklist there.
-- - can_complete_job_without_photo: bypasses the hard block below, for
--   roles that need to close out a photo-required job when a photo
--   genuinely can't be taken.

alter table public.jobs add column if not exists requires_photo boolean not null default false;

insert into public.permissions (key, description) values
  ('can_require_job_photo', 'Can mark a job as requiring a photo when creating it'),
  ('can_complete_job_without_photo', 'Can mark a photo-required job complete without a photo attached')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, p.key, true
from public.roles r
cross join (values ('can_require_job_photo'), ('can_complete_job_without_photo')) as p(key)
where r.name = 'Admin'
  and r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
on conflict do nothing;

create or replace function public.enforce_job_completion_photo_requirement()
returns trigger as $$
declare
  v_old_completed boolean;
  v_new_completed boolean;
  v_has_photo boolean;
begin
  select is_completed into v_old_completed from public.job_statuses where id = old.status_id;
  select is_completed into v_new_completed from public.job_statuses where id = new.status_id;

  if v_new_completed and not v_old_completed and new.requires_photo
     and not public.has_permission('can_complete_job_without_photo') then
    select exists (select 1 from public.job_photos where job_id = new.id) into v_has_photo;
    if not v_has_photo then
      raise exception 'This job requires a photo before it can be completed';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists jobs_enforce_completion_photo on public.jobs;
create trigger jobs_enforce_completion_photo
  before update on public.jobs
  for each row
  when (old.status_id is distinct from new.status_id)
  execute function public.enforce_job_completion_photo_requirement();

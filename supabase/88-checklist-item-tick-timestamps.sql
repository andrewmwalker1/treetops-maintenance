-- Tree Tops Maintenance Platform -- checklist item tick timestamps
-- Run after 87-remove-stray-handle-new-user.sql.
--
-- Andy (2026-11-15) asked when checklist items on Pn-A07's jobs were
-- ticked, and the answer was "we don't know": job_subtasks only ever held
-- is_checked, with no time or person, and ticking writes nothing to
-- job_activity.
--
-- Adds checked_at / checked_by, stamped by a trigger rather than sent by
-- the client, so they can't be faked and every existing tick path (job
-- detail, kiosk, offline sync flush) gets them without a code change.
-- Unticking clears both -- they always describe the current tick. Items
-- ticked before this ran stay null; there's no history to backfill from.
--
-- Kiosk / key-station sessions sign in as the actual staff member (see
-- 34/46), so auth.uid() is the person who tapped the box there too.

alter table public.job_subtasks add column if not exists checked_at timestamptz;
alter table public.job_subtasks add column if not exists checked_by uuid references public.profiles(id) on delete set null;

create or replace function public.stamp_job_subtask_checked()
returns trigger
language plpgsql
as $$
begin
  if new.is_checked then
    if tg_op = 'INSERT' or not old.is_checked then
      new.checked_at := now();
      new.checked_by := auth.uid();
    else
      -- Still ticked: keep the original stamp whatever the client sent.
      new.checked_at := old.checked_at;
      new.checked_by := old.checked_by;
    end if;
  else
    new.checked_at := null;
    new.checked_by := null;
  end if;
  return new;
end;
$$;

drop trigger if exists job_subtasks_stamp_checked on public.job_subtasks;
create trigger job_subtasks_stamp_checked
  before insert or update on public.job_subtasks
  for each row execute function public.stamp_job_subtask_checked();

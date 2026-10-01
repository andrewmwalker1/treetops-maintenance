-- Minimum number of people an activity needs (e.g. Ladders: 2). Optional --
-- blank means no minimum is set. Shown on any job with that activity type,
-- just under the job's description (job page, kiosk, printed job card).
-- Run after 81-equipment-checklist-versions.sql. Idempotent.

alter table public.task_types
  add column if not exists min_people int;

do $$ begin
  alter table public.task_types
    add constraint task_types_min_people_positive check (min_people is null or min_people >= 1);
exception when duplicate_object then null; end $$;

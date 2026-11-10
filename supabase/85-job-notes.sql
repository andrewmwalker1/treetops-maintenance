-- Free-text notes on a job -- room for more detail than the one-line
-- description carries. Captured on step 1 of the New job wizard and
-- editable afterwards on the job's detail screen.
--
-- Run after 84-explicit-table-grants.sql. Idempotent, safe to re-run.
--
-- No grant block needed: the Data API grants in 84-explicit-table-grants.sql
-- are table-level and already cover public.jobs, so a new column on an
-- existing table inherits them. RLS still decides access, unchanged.

alter table public.jobs add column if not exists notes text;

comment on column public.jobs.notes is
  'Free-text detail for whoever picks the job up -- access, timing, who to speak to. Distinct from description, which is the one-line title shown on job cards.';

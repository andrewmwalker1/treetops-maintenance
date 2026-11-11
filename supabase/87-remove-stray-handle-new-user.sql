-- 87: remove a stray public.handle_new_user() created by mistake.
--
-- On 11 Nov 2026 a CREATE OR REPLACE FUNCTION public.handle_new_user(),
-- meant for the separate village hall / "Websites" project
-- (pnzmyvmidrxpnsyhotst), was run here by accident. It inserts into
-- public.profiles (id, email), which doesn't match this project's profiles
-- table (no email column; org_id and display_name are required). None of
-- this project's migrations ever created a function of that name, and
-- profiles here are created by the manage-users edge function, not by a
-- sign-up trigger.
--
-- This drops it only if no trigger uses it. If one does, it stops with an
-- error and changes nothing, so the original can be restored instead.
-- Idempotent: safe to re-run.

do $$
begin
  if to_regprocedure('public.handle_new_user()') is null then
    raise notice 'public.handle_new_user() does not exist: nothing to do.';
    return;
  end if;

  if exists (select 1 from pg_trigger where tgfoid = 'public.handle_new_user()'::regprocedure) then
    raise exception 'A trigger still uses public.handle_new_user(): NOT dropped. Nothing was changed.';
  end if;

  drop function public.handle_new_user();
  raise notice 'Removed public.handle_new_user(): nothing was using it.';
end
$$;

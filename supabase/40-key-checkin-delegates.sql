-- Tree Tops Maintenance Platform -- key check-in restricted for contractors
-- Run after 39-role-key-reasons.sql.
--
-- Until now, any can_use_key_system holder could check in ANY open key
-- checkout (deliberately, per Andy's original spec: "keys are not always
-- booked back in by the person who booked them out"). Andy wants that
-- narrowed to selected people. Landed here after two more complex
-- attempts (a full directed delegate graph of who-can-act-for-whom, then
-- a dedicated can_checkin_for_others permission) before Andy pointed out
-- reusing the existing `is_contractor` flag (profiles, 01-schema.sql)
-- covers it: anyone NOT flagged as a contractor can check any key in; a
-- contractor can only check in their own. That alone satisfies the
-- worked example (Andy/Nic/Sam/Jayne -- all staff, not contractors -- can
-- act for anyone including Kevin Parry; Kevin -- a contractor -- can't
-- act for anyone else) with no new permission or admin screen to keep in
-- sync, and it extends automatically to any future trusted contractor set
-- up the normal way (Part 3: is_contractor=true + a role holding
-- can_use_key_system) with no separate grant ever needed.
--
-- Supersedes this file's first two attempts in place -- both were applied
-- to the live project minutes ago with nothing built on top of either yet.

delete from public.role_permissions where permission_key = 'can_checkin_for_others';
delete from public.permissions where key = 'can_checkin_for_others';

create or replace function public.current_is_contractor()
returns boolean
language sql security definer stable
set search_path = public, pg_temp
as $$
  select coalesce(is_contractor, false) from public.profiles where id = auth.uid();
$$;

-- Self-check-in always allowed regardless; otherwise requires NOT being a
-- contractor. admin_force_check_in_key (37-key-checkouts-and-contractor-
-- reasons.sql) is untouched -- a separate security-definer RPC, not this
-- policy, for the stuck/lost-key case.
drop policy if exists key_checkouts_update on public.key_checkouts;
create policy key_checkouts_update on public.key_checkouts
  for update using (
    checked_in_at is null
    and (checked_out_by = auth.uid() or not public.current_is_contractor())
    and exists (
      select 1 from public.key_tags kt
      where kt.id = key_checkouts.key_tag_id
        and public.has_site_scope(kt.site_id)
        and public.has_permission('can_use_key_system')
    )
  )
  with check (checked_in_by = auth.uid());

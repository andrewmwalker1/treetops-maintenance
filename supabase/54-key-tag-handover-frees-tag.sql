-- Tree Tops Maintenance Platform -- handover immediately frees the tag
-- Run after 53-equipment-monitor-status.sql.
--
-- Corrects 48-key-tags-handover.sql's own design call: that file
-- deliberately left pitch_id/special_location_id in place after a
-- handover, reasoning that a duplicate key usually still covers the
-- pitch. Andy: that's not how it actually works -- staff confirm the RFID
-- fob has been physically removed from the key *as part of completing the
-- handover itself* (HandoverKey.jsx's required "I've removed the RFID fob"
-- checkbox, already in place before this file), so by the time
-- handover_key_tag runs, the fob is already back in hand. There's no
-- reason to leave the tag sitting in a dead 'handed_over' state requiring
-- a separate manual "Return to pool" click (or a re-scan) before it can go
-- on a different key -- it should come back into the pool automatically,
-- unallocated, in the same action.
--
-- Implemented as a second update in the same transaction, immediately
-- after the existing one, rather than changing what that first update
-- does -- this way log_key_tag_event's existing logic (36-/42-/
-- 48-key-tags-*.sql, untouched here) logs both transitions for free:
-- 'handed_over' (from the first update, pitch_id still intact so the
-- historical from_pitch_id is captured correctly), then 'reinstated' +
-- 'removed' (from this second update, since both status and pitch_id
-- change at once). handed_over_at/to/notes are deliberately NOT cleared
-- by the second update -- unlike the manual reactivation paths in
-- KeyTagsTab.jsx (which clear them because those are undoing a mistake),
-- this handover genuinely happened, so "last handed over to X on date Y"
-- stays on the row as history even though the tag is active and
-- unallocated again.
create or replace function public.handover_key_tag(p_key_tag_id uuid, p_handed_over_to text, p_notes text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_pitch_id uuid;
  v_status text;
begin
  if not public.has_permission('can_manage_keys') then
    raise exception 'Handing over a key requires the can_manage_keys permission';
  end if;

  if p_handed_over_to is null or btrim(p_handed_over_to) = '' then
    raise exception 'Who the key was handed over to is required';
  end if;

  select pitch_id, status into v_pitch_id, v_status from public.key_tags where id = p_key_tag_id;

  if v_status is null then
    raise exception 'No such key tag';
  end if;
  if v_status <> 'active' then
    raise exception 'Only an active key tag can be handed over';
  end if;
  if v_pitch_id is null then
    raise exception 'This tag has no home pitch to hand over -- give it one first';
  end if;

  update public.key_checkouts
  set checked_in_at = now(),
      checked_in_by = auth.uid(),
      notes = case
        when notes is null or notes = '' then 'Auto-closed: key was handed over to its owner.'
        else notes || ' | Auto-closed: key was handed over to its owner.'
      end
  where key_tag_id = p_key_tag_id and checked_in_at is null;

  update public.key_tags
  set status = 'handed_over',
      handed_over_at = now(),
      handed_over_to = btrim(p_handed_over_to),
      handed_over_notes = nullif(btrim(coalesce(p_notes, '')), '')
  where id = p_key_tag_id;

  -- Immediately return the physical tag to the pool -- the fob's removal
  -- was already confirmed before this RPC was ever called.
  update public.key_tags
  set status = 'active',
      pitch_id = null,
      special_location_id = null
  where id = p_key_tag_id;
end;
$$;

-- Tree Tops Maintenance Platform -- keys: handover to the caravan's new owner
-- Run after 47-key-tags-pitch-persists-through-special-location.sql.
--
-- When a caravan sells, one of its keys (from the cupboard or wherever it's
-- currently sitting) is given to the customer as part of the handover and
-- is theirs until they sell in turn -- it never comes back, so it's not a
-- loan (key_checkouts) and must never appear on a "currently out" list.
-- Modelled as a third key_tags status, same shape as 'lost'
-- (42-key-tags-lost-status-and-reasons.sql): pitch_id/special_location_id
-- are deliberately NOT cleared, so "OP-B06 -- HANDED OVER" stays visible in
-- the admin list (which pitch this key was for is exactly what you'd want
-- to look up later), while the tag drops out of every kiosk picker
-- (checkout, relocate, find-a-key) via the same status <> 'active' filter
-- those already use. Andy: there's normally a duplicate key for the same
-- pitch left in the cupboard, so one tag going to 'handed_over' is
-- expected to still leave the pitch with a working key -- the "pitches
-- with no keys" report (KeyReportsTab.jsx) is what surfaces the pitches
-- where that's no longer true.
alter table public.key_tags
  add column if not exists handed_over_at timestamptz,
  add column if not exists handed_over_to text,
  add column if not exists handed_over_notes text;

alter table public.key_tags drop constraint if exists key_tags_status_check;
alter table public.key_tags add constraint key_tags_status_check check (status in ('active', 'lost', 'handed_over'));

alter table public.key_tag_events drop constraint if exists key_tag_events_event_type_check;
alter table public.key_tag_events add constraint key_tag_events_event_type_check
  check (event_type in ('allocated', 'moved', 'removed', 'lost', 'reinstated', 'handed_over'));

-- Extends log_key_tag_event (36-key-tags-schema.sql, extended by
-- 42-key-tags-lost-status-and-reasons.sql) with one more status-change
-- case -- the location-change logic below it is untouched.
create or replace function public.log_key_tag_event()
returns trigger as $$
declare
  v_event_type text;
  v_location_changed boolean;
begin
  if tg_op = 'INSERT' then
    if new.pitch_id is null and new.special_location_id is null then
      return new; -- a spare tag registered with no location yet -- nothing happened
    end if;
    insert into public.key_tag_events (key_tag_id, event_type, to_pitch_id, to_special_location_id, performed_by)
    values (new.id, 'allocated', new.pitch_id, new.special_location_id, auth.uid());
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.key_tag_events (key_tag_id, event_type, from_pitch_id, from_special_location_id, to_pitch_id, to_special_location_id, performed_by)
    values (
      new.id,
      case
        when new.status = 'lost' then 'lost'
        when new.status = 'handed_over' then 'handed_over'
        else 'reinstated'
      end,
      old.pitch_id, old.special_location_id, new.pitch_id, new.special_location_id, auth.uid()
    );
  end if;

  v_location_changed := new.pitch_id is distinct from old.pitch_id or new.special_location_id is distinct from old.special_location_id;
  if not v_location_changed then
    return new;
  end if;

  if new.pitch_id is null and new.special_location_id is null then
    v_event_type := 'removed';
  elsif old.pitch_id is null and old.special_location_id is null then
    v_event_type := 'allocated';
  else
    v_event_type := 'moved';
  end if;

  insert into public.key_tag_events (key_tag_id, event_type, from_pitch_id, from_special_location_id, to_pitch_id, to_special_location_id, performed_by)
  values (new.id, v_event_type, old.pitch_id, old.special_location_id, new.pitch_id, new.special_location_id, auth.uid());
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- One RPC rather than a plain client-side update (unlike Move/Remove/Mark-
-- as-lost, which write key_tags directly under the existing can_manage_keys
-- RLS policy) because a handover has a second side effect that must happen
-- atomically with it: if this tag happens to be out on an open checkout
-- (e.g. a contractor had it and forgot to check it in), that checkout is
-- force-closed here too, mirroring admin_force_check_in_key
-- (37-key-checkouts-and-contractor-reasons.sql) -- otherwise "not currently
-- checked out" wouldn't actually be true the moment the handover completes.
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
end;
$$;

grant execute on function public.handover_key_tag(uuid, text, text) to authenticated;

-- Mirrors handleReinstate's plain client-side update for 'lost' -- no extra
-- side effect to worry about here (nothing was auto-closed on the way in
-- that needs undoing), so this needs no RPC of its own; the existing
-- key_tags_update RLS policy (can_manage_keys) already covers it.

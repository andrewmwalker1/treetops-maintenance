-- Tree Tops Maintenance Platform -- carry handover detail onto the event log
-- Run after 54-key-tag-handover-frees-tag.sql.
--
-- Now that handover_key_tag immediately frees the tag (54-...), the only
-- durable record of "this pitch's key was handed over, and to whom" is
-- key_tag_events -- key_tags.handed_over_to/notes still exist, but they're
-- a single mutable slot on the tag row: if that same physical tag is later
-- reused on a different pitch and handed over again, handed_over_to gets
-- overwritten and the first pitch's history is lost even though its
-- key_tag_events row (with the correct from_pitch_id) still exists.
-- Andy: search results for a pitch (e.g. "OP-E10") should still surface a
-- past handover as the last result even after the tag's moved on --
-- that needs each event to carry its own copy of who/what, not rely on
-- reading it back off the tag.
alter table public.key_tag_events
  add column if not exists handed_over_to text,
  add column if not exists handed_over_notes text;

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
    insert into public.key_tag_events (
      key_tag_id, event_type, from_pitch_id, from_special_location_id, to_pitch_id, to_special_location_id,
      performed_by, handed_over_to, handed_over_notes
    )
    values (
      new.id,
      case
        when new.status = 'lost' then 'lost'
        when new.status = 'handed_over' then 'handed_over'
        else 'reinstated'
      end,
      old.pitch_id, old.special_location_id, new.pitch_id, new.special_location_id, auth.uid(),
      case when new.status = 'handed_over' then new.handed_over_to else null end,
      case when new.status = 'handed_over' then new.handed_over_notes else null end
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

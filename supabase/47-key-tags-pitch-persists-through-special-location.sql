-- Tree Tops Maintenance Platform -- keys: home pitch persists through a special location
-- Run after 46-terminal-session-scoped-login-context.sql.
--
-- key_tags_single_location (36-key-tags-schema.sql) forced pitch_id to null
-- the moment a key moved to a special location (e.g. the caravan-prep
-- ring), so the key's home pitch was lost while it sat there, and moving
-- it back meant re-picking the pitch from scratch. Andy: a key needs to
-- keep its home pitch the whole time it's in a special location, both so
-- the special-location screen shows which pitch each key belongs to, and
-- so it goes straight back to that pitch (not blank) once it returns.
--
-- special_location_id is now an overlay on top of pitch_id, not a
-- replacement for it: pitch_id is the key's home (the peg for that pitch
-- in the main cupboard -- there's no explicit row for "the main cupboard"
-- itself, a key with special_location_id null just lives at its pitch's
-- peg), special_location_id is set only while the key is somewhere else.
-- Clearing special_location_id and leaving pitch_id alone is "moved back
-- to the main cupboard" -- KeyTagsTab's "Remove" action (clears both) is
-- unchanged, for a key genuinely coming off the register.
alter table public.key_tags drop constraint if exists key_tags_single_location;

-- Backfill: keys that already lost their pitch_id under the old
-- constraint (currently sitting in a special location with no pitch)
-- get it restored from their own event history -- key_tag_events
-- recorded from_pitch_id on the move that cleared it, so this is exact,
-- not a guess. Tags that never had a pitch (e.g. a sales-keyring key) have
-- no such event and are correctly left alone -- those still need a pitch
-- picked by hand in KeyTagsTab if one should be attached now.
update public.key_tags kt
set pitch_id = last_pitch.from_pitch_id
from (
  select distinct on (key_tag_id) key_tag_id, from_pitch_id
  from public.key_tag_events
  where from_pitch_id is not null
  order by key_tag_id, created_at desc
) last_pitch
where kt.id = last_pitch.key_tag_id
  and kt.pitch_id is null
  and kt.special_location_id is not null;

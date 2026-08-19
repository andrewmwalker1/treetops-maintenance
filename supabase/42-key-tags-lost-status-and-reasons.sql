-- Tree Tops Maintenance Platform -- key tags: lost status + customer/guest reason presets
-- Run after 41-equipment-checklist-item-shape.sql.
--
-- Part 1: "lost" is a distinct state from "unallocated (spare)". Today
-- removing a tag's location (KeyTagsTab's "Remove") makes it
-- indistinguishable from a genuine spare ready for reuse -- if a physical
-- key is actually lost, nothing stops it being casually reallocated to a
-- new pitch later. Mirrors the equipment_status 'decommissioned' shape
-- (24-equipment-decommission.sql) but simpler: no reason category, and
-- deliberately does NOT clear pitch_id/special_location_id when marking a
-- tag lost, so "Pitch 12 -- LOST" stays visible in the admin list (Andy
-- still needs to know which pitch is missing a key, e.g. to call a
-- locksmith) while the tag drops out of every kiosk picker (checkout,
-- relocate, find-a-key), same as equipmentAvailability.js filtering
-- status = 'in_service'.
alter table public.key_tags
  add column if not exists status text not null default 'active',
  add column if not exists lost_at timestamptz,
  add column if not exists lost_notes text;

do $$ begin
  alter table public.key_tags
    add constraint key_tags_status_check check (status in ('active', 'lost'));
exception when duplicate_object then null; end $$;

-- log_key_tag_event (36-key-tags-schema.sql) only recognised location
-- changes. Extended to also log a lost/reinstated event on a status
-- change, keeping the "every mutation is logged by the trigger, not by
-- the UI remembering to" guarantee intact for the new action.
alter table public.key_tag_events drop constraint if exists key_tag_events_event_type_check;
alter table public.key_tag_events add constraint key_tag_events_event_type_check
  check (event_type in ('allocated', 'moved', 'removed', 'lost', 'reinstated'));

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
    values (new.id, case when new.status = 'lost' then 'lost' else 'reinstated' end, old.pitch_id, old.special_location_id, new.pitch_id, new.special_location_id, auth.uid());
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

-- Part 2: standard reasons for keys issued to a customer or guest, same
-- shape as contractor_reasons/role_key_reasons but not owned by a
-- specific contractor/role row -- customers and guests aren't modelled as
-- their own entities in this app, so kind ('customer'/'guest') is the key
-- instead of a foreign id. Reused by the same generic KeyReasonsModal.jsx
-- via ownerColumn="kind". Always shown alongside the existing free-text
-- reason field, never a replacement for it.
create table if not exists public.key_reason_presets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  kind text not null check (kind in ('customer', 'guest')),
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (org_id, kind, label)
);
create index if not exists key_reason_presets_org_kind_idx on public.key_reason_presets (org_id, kind);

alter table public.key_reason_presets enable row level security;

drop policy if exists key_reason_presets_select on public.key_reason_presets;
create policy key_reason_presets_select on public.key_reason_presets
  for select using (org_id = public.current_org_id());

drop policy if exists key_reason_presets_insert on public.key_reason_presets;
create policy key_reason_presets_insert on public.key_reason_presets
  for insert with check (org_id = public.current_org_id() and public.has_permission('can_manage_keys'));

drop policy if exists key_reason_presets_update on public.key_reason_presets;
create policy key_reason_presets_update on public.key_reason_presets
  for update using (org_id = public.current_org_id() and public.has_permission('can_manage_keys'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_keys'));

drop policy if exists key_reason_presets_delete on public.key_reason_presets;
create policy key_reason_presets_delete on public.key_reason_presets
  for delete using (org_id = public.current_org_id() and public.has_permission('can_manage_keys'));

-- A couple of starter presets so the quick-pick row isn't empty on day
-- one -- easily renamed or deleted from Admin > Key Reasons like any
-- other preset.
insert into public.key_reason_presets (org_id, kind, label, sort_order)
select o.id, v.kind, v.label, v.sort_order
from public.organisations o
cross join (values
  ('customer', 'Access to their own caravan', 0),
  ('customer', 'Meter reading / inspection', 1),
  ('guest', 'Access while the owner is away', 0),
  ('guest', 'Viewing the caravan', 1)
) as v(kind, label, sort_order)
where o.name = 'Tree Tops Caravan Park Ltd'
on conflict do nothing;

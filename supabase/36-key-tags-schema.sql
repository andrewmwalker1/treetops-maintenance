-- Tree Tops Maintenance Platform -- key management, part 1: tag allocation
-- Run after 35-desktop-access-permission.sql.
--
-- First slice of the RFID key-cupboard feature: lets an admin allocate one
-- of the 300 purchased RFID tags to a pitch (or a fixed "special location"
-- like the sales keyring or a staff prep ring), move it, or remove it when
-- a caravan leaves. The actual check-out/check-in flow (key_checkouts) and
-- contractor reason presets land in a later migration alongside the
-- key-station terminal that will use them -- no point shipping schema
-- nothing reads yet.
--
-- key_special_locations exists as its own small admin-managed table
-- (rather than a hardcoded pair of enum values) because Andy specifically
-- wants "Sales keyring" and "Sam's caravan prep ring" today but may add
-- more later -- same reasoning as key_tags allowing MULTIPLE rows per
-- pitch_id (a caravan can have more than one key) rather than a
-- one-to-one pitch<->tag mapping.
--
-- key_tag_events is populated entirely by a trigger, not by any client
-- write -- every allocate/move/remove goes through the same one INSERT or
-- UPDATE on key_tags, so logging it there once (rather than trusting every
-- future call site to also write a log row) is what actually guarantees
-- "every allocate/move/remove is logged," per Andy's spec.

create table if not exists public.key_special_locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now(),
  unique (site_id, label)
);

create table if not exists public.key_tags (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  tag_uid text not null unique,
  pitch_id uuid references public.pitches(id) on delete set null,
  special_location_id uuid references public.key_special_locations(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint key_tags_single_location check (not (pitch_id is not null and special_location_id is not null))
);
create index if not exists key_tags_pitch_idx on public.key_tags (pitch_id);
create index if not exists key_tags_special_location_idx on public.key_tags (special_location_id);

create table if not exists public.key_tag_events (
  id uuid primary key default gen_random_uuid(),
  key_tag_id uuid not null references public.key_tags(id) on delete cascade,
  event_type text not null check (event_type in ('allocated', 'moved', 'removed')),
  from_pitch_id uuid references public.pitches(id) on delete set null,
  from_special_location_id uuid references public.key_special_locations(id) on delete set null,
  to_pitch_id uuid references public.pitches(id) on delete set null,
  to_special_location_id uuid references public.key_special_locations(id) on delete set null,
  performed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists key_tag_events_key_tag_idx on public.key_tag_events (key_tag_id);

create or replace function public.log_key_tag_event()
returns trigger as $$
declare
  v_event_type text;
begin
  if tg_op = 'INSERT' then
    if new.pitch_id is null and new.special_location_id is null then
      return new; -- a spare tag registered with no location yet -- nothing happened
    end if;
    insert into public.key_tag_events (key_tag_id, event_type, to_pitch_id, to_special_location_id, performed_by)
    values (new.id, 'allocated', new.pitch_id, new.special_location_id, auth.uid());
    return new;
  end if;

  if new.pitch_id is not distinct from old.pitch_id and new.special_location_id is not distinct from old.special_location_id then
    return new; -- an unrelated field changed -- location didn't move
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

drop trigger if exists key_tags_log_event on public.key_tags;
create trigger key_tags_log_event
  after insert or update on public.key_tags
  for each row execute function public.log_key_tag_event();

insert into public.permissions (key, description) values
  ('can_manage_keys', 'Can allocate, move, and remove key RFID tags, and view the full key activity log'),
  ('can_use_key_system', 'Can check keys in and out at the key station')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, 'can_manage_keys', true
from public.roles r
where r.name = 'Admin'
  and r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_key, enabled)
select r.id, 'can_use_key_system', true
from public.roles r
where r.org_id = (select id from public.organisations where name = 'Tree Tops Caravan Park Ltd')
on conflict do nothing;

alter table public.key_special_locations enable row level security;

drop policy if exists key_special_locations_select on public.key_special_locations;
create policy key_special_locations_select on public.key_special_locations
  for select using (
    public.has_site_scope(site_id)
    and (public.has_permission('can_use_key_system') or public.has_permission('can_manage_keys'))
  );

drop policy if exists key_special_locations_insert on public.key_special_locations;
create policy key_special_locations_insert on public.key_special_locations
  for insert with check (org_id = public.current_org_id() and public.has_permission('can_manage_keys'));

drop policy if exists key_special_locations_update on public.key_special_locations;
create policy key_special_locations_update on public.key_special_locations
  for update using (org_id = public.current_org_id() and public.has_permission('can_manage_keys'))
  with check (org_id = public.current_org_id() and public.has_permission('can_manage_keys'));

drop policy if exists key_special_locations_delete on public.key_special_locations;
create policy key_special_locations_delete on public.key_special_locations
  for delete using (org_id = public.current_org_id() and public.has_permission('can_manage_keys'));

alter table public.key_tags enable row level security;

drop policy if exists key_tags_select on public.key_tags;
create policy key_tags_select on public.key_tags
  for select using (
    public.has_site_scope(site_id)
    and (public.has_permission('can_use_key_system') or public.has_permission('can_manage_keys'))
  );

drop policy if exists key_tags_insert on public.key_tags;
create policy key_tags_insert on public.key_tags
  for insert with check (
    org_id = public.current_org_id()
    and public.has_site_scope(site_id)
    and public.has_permission('can_manage_keys')
  );

drop policy if exists key_tags_update on public.key_tags;
create policy key_tags_update on public.key_tags
  for update using (
    org_id = public.current_org_id()
    and public.has_site_scope(site_id)
    and public.has_permission('can_manage_keys')
  )
  with check (
    org_id = public.current_org_id()
    and public.has_site_scope(site_id)
    and public.has_permission('can_manage_keys')
  );

alter table public.key_tag_events enable row level security;

-- No insert/update/delete policy: log_key_tag_event() is security definer
-- and writes here regardless of the calling user's own grants -- nothing
-- else should ever write to this table directly.
drop policy if exists key_tag_events_select on public.key_tag_events;
create policy key_tag_events_select on public.key_tag_events
  for select using (
    exists (
      select 1 from public.key_tags kt
      where kt.id = key_tag_events.key_tag_id
        and public.has_site_scope(kt.site_id)
        and public.has_permission('can_manage_keys')
    )
  );

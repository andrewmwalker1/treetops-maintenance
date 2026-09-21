-- Tree Tops Maintenance Platform -- one note per weekly timesheet, replacing
-- the per-day note field. Run after 77-equipment-no-checkout.sql.
-- Idempotent, safe to re-run.
--
-- One row per person per week (Monday). Frozen-week behaviour mirrors
-- timesheet_entries (69-staff-timesheets.sql): once the week is frozen only
-- can_manage_timesheets holders can change it, and each such change is
-- written to timesheet_audit_log as an 'update' with a {week_note: {old, new}}
-- diff so it shows up in the existing override log unchanged.
--
-- timesheet_entries.notes is left in place (the audit log's stored row
-- snapshots reference it) but nothing writes to it any more; any existing
-- day notes are folded into the week note by the backfill at the bottom.

create table if not exists public.timesheet_week_notes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  note text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (profile_id, week_start)
);

create or replace function public.timesheet_week_notes_before_write()
returns trigger as $$
declare
  v_frozen timestamptz;
  v_old_note text := case when tg_op = 'UPDATE' then old.note else null end;
begin
  new.week_start := date_trunc('week', new.week_start)::date;
  new.updated_at := now();
  -- No signed-in user means a migration/service-role write (the backfill
  -- below): keep the supplied values and skip the user-facing checks.
  if auth.uid() is null then
    return new;
  end if;
  new.org_id := public.current_org_id();
  new.updated_by := auth.uid();

  select frozen_at into v_frozen
  from public.timesheet_weeks
  where org_id = new.org_id and week_start = new.week_start;

  if v_frozen is not null then
    if not public.has_permission('can_manage_timesheets') then
      raise exception 'This week is frozen -- ask the office to make this change';
    end if;
    if new.note is distinct from v_old_note then
      insert into public.timesheet_audit_log (org_id, profile_id, week_start, action, field_changes, actor_profile_id)
      values (new.org_id, new.profile_id, new.week_start, 'update',
              jsonb_build_object('week_note', jsonb_build_object('old', v_old_note, 'new', new.note)), auth.uid());
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists timesheet_week_notes_before_write on public.timesheet_week_notes;
create trigger timesheet_week_notes_before_write
  before insert or update on public.timesheet_week_notes
  for each row execute function public.timesheet_week_notes_before_write();

alter table public.timesheet_week_notes enable row level security;

drop policy if exists timesheet_week_notes_select on public.timesheet_week_notes;
create policy timesheet_week_notes_select on public.timesheet_week_notes
  for select using (
    org_id = public.current_org_id()
    and (profile_id = auth.uid() or public.has_permission('can_manage_timesheets'))
  );

drop policy if exists timesheet_week_notes_insert on public.timesheet_week_notes;
create policy timesheet_week_notes_insert on public.timesheet_week_notes
  for insert with check (
    public.profile_can_submit_timesheet(profile_id)
    and (profile_id = auth.uid() or public.has_permission('can_manage_timesheets'))
  );

drop policy if exists timesheet_week_notes_update on public.timesheet_week_notes;
create policy timesheet_week_notes_update on public.timesheet_week_notes
  for update
  using (
    org_id = public.current_org_id()
    and (profile_id = auth.uid() or public.has_permission('can_manage_timesheets'))
  )
  with check (
    org_id = public.current_org_id()
    and (profile_id = auth.uid() or public.has_permission('can_manage_timesheets'))
  );

-- Backfill: fold each week's existing day notes into one week note,
-- prefixed with the day so nothing is lost.
insert into public.timesheet_week_notes (org_id, profile_id, week_start, note)
select org_id, profile_id, entered_week_start,
       string_agg(to_char(work_date, 'Dy DD Mon') || ': ' || btrim(notes), E'\n' order by work_date)
from public.timesheet_entries
where entry_kind = 'daily' and notes is not null and btrim(notes) <> ''
group by org_id, profile_id, entered_week_start
on conflict (profile_id, week_start) do nothing;

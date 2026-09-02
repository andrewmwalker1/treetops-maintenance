-- Tree Tops Maintenance Platform -- seed the real Iseki SXG324 service schedule
-- Run after 59-equipment-service-schedules.sql.
--
-- Andy's real schedule (from the Iseki SXG324 manual), applied to the
-- actual machine on the live site: MO7 (make Iseki, model SXG324,
-- equipment id 03d3df31-91e1-44e1-a6ef-fda377cb3ae7). Not attached to
-- the "Small Tractor" equipment_type -- that type is shared with the
-- Kubota (MO3), which needs a different schedule; if Andy wants a
-- type-level default for hours-tracking that only covers the Iseki, a
-- more specific equipment type would be the right next step (his call,
-- not made here).
--
-- Hardcoded to this specific business's real equipment the same way
-- 05-seed-pitches.sql is -- a fork onboarding via
-- scripts/onboard-new-customer.mjs won't have this equipment id and
-- should skip this file, same as it already skips 05.
do $$
declare
  v_org_id uuid;
  v_mo7_id uuid := '03d3df31-91e1-44e1-a6ef-fda377cb3ae7';
  v_template_id uuid;
begin
  select id into v_org_id from public.organisations where name = 'Tree Tops Caravan Park Ltd';
  if v_org_id is null or not exists (select 1 from public.equipment where id = v_mo7_id) then
    return; -- not Tree Tops' own database, or MO7 no longer exists -- nothing to seed
  end if;

  update public.equipment set tracks_hours = true, hours_required = true where id = v_mo7_id;

  insert into public.service_templates (org_id, name, equipment_type_id)
  select v_org_id, 'Iseki SXG324', null
  where not exists (select 1 from public.service_templates where org_id = v_org_id and name = 'Iseki SXG324')
  returning id into v_template_id;

  if v_template_id is null then
    return; -- already seeded
  end if;

  insert into public.service_template_tiers (org_id, template_id, name, trigger_type, hours_interval, is_recurring, sort_order, checklist) values
  (v_org_id, v_template_id, 'Initial Service (50 Hours)', 'hours', 50, false, 0, '[
    {"label":"Replace engine oil","requiresPhoto":false},
    {"label":"Replace engine oil filter","requiresPhoto":false},
    {"label":"Replace transmission oil","requiresPhoto":false},
    {"label":"Replace 4WD gearbox oil (if fitted)","requiresPhoto":false},
    {"label":"Replace rear axle oil","requiresPhoto":false},
    {"label":"Replace hydraulic oil filter","requiresPhoto":false},
    {"label":"Clean suction filter","requiresPhoto":false},
    {"label":"General inspection & grease-up","requiresPhoto":false}
  ]'::jsonb),
  (v_org_id, v_template_id, 'Every 50 Hours', 'hours', 50, true, 1, '[
    {"label":"Clean air cleaner","requiresPhoto":false},
    {"label":"Clean radiator screen","requiresPhoto":false},
    {"label":"Grease all nipples","requiresPhoto":false},
    {"label":"General inspection (bolts, safety switches, electrical apparatus)","requiresPhoto":false}
  ]'::jsonb),
  (v_org_id, v_template_id, 'Every 100 Hours', 'hours', 100, true, 2, '[
    {"label":"Inspect rubber pipes (hoses)","requiresPhoto":false}
  ]'::jsonb),
  (v_org_id, v_template_id, 'Every 150 Hours', 'hours', 150, true, 3, '[
    {"label":"Replace engine oil","requiresPhoto":false}
  ]'::jsonb),
  (v_org_id, v_template_id, 'Every 200 Hours', 'hours', 200, true, 4, '[
    {"label":"Clean suction filter","requiresPhoto":false}
  ]'::jsonb),
  (v_org_id, v_template_id, 'Every 300 Hours', 'hours', 300, true, 5, '[
    {"label":"Replace engine oil filter","requiresPhoto":false},
    {"label":"Replace transmission oil","requiresPhoto":false},
    {"label":"Replace 4WD gearbox oil","requiresPhoto":false},
    {"label":"Replace rear axle oil","requiresPhoto":false},
    {"label":"Replace hydraulic oil filter","requiresPhoto":false},
    {"label":"Replace fuel strainer","requiresPhoto":false},
    {"label":"Check steering system & ball joints","requiresPhoto":false},
    {"label":"Check toe-in","requiresPhoto":false},
    {"label":"Check wheel bolt torque","requiresPhoto":false}
  ]'::jsonb);

  -- Coolant's own ~2-year interval is folded into this annual checklist
  -- as a note rather than a separately tracked tier, per Andy.
  insert into public.service_template_tiers (org_id, template_id, name, trigger_type, date_interval_months, is_recurring, sort_order, checklist) values
  (v_org_id, v_template_id, 'Annual Service', 'date', 12, true, 6, '[
    {"label":"Replace air cleaner element","requiresPhoto":false},
    {"label":"Replace fuel strainer (if not already done at 300 hrs)","requiresPhoto":false},
    {"label":"Replace radiator coolant -- every 2 years, check if due this visit","requiresPhoto":false}
  ]'::jsonb);

  -- Equivalent of apply_service_template (59-equipment-service-schedules.sql)
  -- done inline -- that RPC checks has_permission() against auth.uid(),
  -- which is null in a plain migration run, so it can't be called
  -- directly here.
  insert into public.equipment_service_schedules (equipment_id, service_template_id)
  values (v_mo7_id, v_template_id)
  on conflict (equipment_id, service_template_id) do nothing;

  insert into public.equipment_service_tier_state (equipment_id, tier_id, next_due_hours, next_due_date)
  select
    v_mo7_id,
    t.id,
    case when t.trigger_type = 'hours' then coalesce((select last_hours_reading from public.equipment where id = v_mo7_id), 0) + t.hours_interval else null end,
    case when t.trigger_type = 'date' then (current_date + (t.date_interval_months || ' months')::interval)::date else null end
  from public.service_template_tiers t
  where t.template_id = v_template_id
  on conflict (equipment_id, tier_id) do nothing;

  -- No due tiers yet at seed time (MO7 has no hours reading on file, and
  -- the annual tier's next due is a year out) -- nothing to generate.
end $$;

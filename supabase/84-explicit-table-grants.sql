-- 84: Explicit Data API grants on every public table.
--
-- From 30 Oct 2026 Supabase no longer grants anon/authenticated/
-- service_role access to new tables in public automatically. The live
-- tables keep the grants they already have, so running this there
-- changes nothing — it exists so a rebuild from these files (fresh
-- project, branch) ends up with the same access as live. RLS is still
-- the gate on who sees or changes what.
--
-- terminal_sessions is deliberately left out: 46 revokes all access to
-- it so only the auth hook (supabase_auth_admin) can read it.
--
-- Any new table from here on needs the same grant in the file that
-- creates it.

grant select, insert, update, delete on public.activity_type_documents to anon, authenticated, service_role;
grant select, insert, update, delete on public.admin_access_log to anon, authenticated, service_role;
grant select, insert, update, delete on public.areas to anon, authenticated, service_role;
grant select, insert, update, delete on public.common_fault_descriptions to anon, authenticated, service_role;
grant select, insert, update, delete on public.contractor_documents to anon, authenticated, service_role;
grant select, insert, update, delete on public.contractor_reasons to anon, authenticated, service_role;
grant select, insert, update, delete on public.contractors to anon, authenticated, service_role;
grant select, insert, update, delete on public.equipment to anon, authenticated, service_role;
grant select, insert, update, delete on public.equipment_checkouts to anon, authenticated, service_role;
grant select, insert, update, delete on public.equipment_checks to anon, authenticated, service_role;
grant select, insert, update, delete on public.equipment_documents to anon, authenticated, service_role;
grant select, insert, update, delete on public.equipment_hours_readings to anon, authenticated, service_role;
grant select, insert, update, delete on public.equipment_monitor_events to anon, authenticated, service_role;
grant select, insert, update, delete on public.equipment_service_schedules to anon, authenticated, service_role;
grant select, insert, update, delete on public.equipment_service_tier_state to anon, authenticated, service_role;
grant select, insert, update, delete on public.equipment_type_checklist_versions to anon, authenticated, service_role;
grant select, insert, update, delete on public.equipment_type_documents to anon, authenticated, service_role;
grant select, insert, update, delete on public.equipment_type_repair_assignees to anon, authenticated, service_role;
grant select, insert, update, delete on public.equipment_types to anon, authenticated, service_role;
grant select, insert, update, delete on public.export_logs to anon, authenticated, service_role;
grant select, insert, update, delete on public.fault_photos to anon, authenticated, service_role;
grant select, insert, update, delete on public.fault_reports to anon, authenticated, service_role;
grant select, insert, update, delete on public.group_members to anon, authenticated, service_role;
grant select, insert, update, delete on public.groups to anon, authenticated, service_role;
grant select, insert, update, delete on public.holiday_bank_holiday_overrides to anon, authenticated, service_role;
grant select, insert, update, delete on public.holiday_bank_holidays to anon, authenticated, service_role;
grant select, insert, update, delete on public.holiday_request_days to anon, authenticated, service_role;
grant select, insert, update, delete on public.holiday_requests to anon, authenticated, service_role;
grant select, insert, update, delete on public.holiday_settings to anon, authenticated, service_role;
grant select, insert, update, delete on public.job_activity to anon, authenticated, service_role;
grant select, insert, update, delete on public.job_activity_types to anon, authenticated, service_role;
grant select, insert, update, delete on public.job_photos to anon, authenticated, service_role;
grant select, insert, update, delete on public.job_service_tiers to anon, authenticated, service_role;
grant select, insert, update, delete on public.job_statuses to anon, authenticated, service_role;
grant select, insert, update, delete on public.job_subtasks to anon, authenticated, service_role;
grant select, insert, update, delete on public.job_type_task_types to anon, authenticated, service_role;
grant select, insert, update, delete on public.job_types to anon, authenticated, service_role;
grant select, insert, update, delete on public.jobs to anon, authenticated, service_role;
grant select, insert, update, delete on public.key_checkouts to anon, authenticated, service_role;
grant select, insert, update, delete on public.key_reason_presets to anon, authenticated, service_role;
grant select, insert, update, delete on public.key_special_locations to anon, authenticated, service_role;
grant select, insert, update, delete on public.key_tag_events to anon, authenticated, service_role;
grant select, insert, update, delete on public.key_tags to anon, authenticated, service_role;
grant select, insert, update, delete on public.license_agreement_area_seasons to anon, authenticated, service_role;
grant select, insert, update, delete on public.license_agreement_drafts to anon, authenticated, service_role;
grant select, insert, update, delete on public.license_agreement_pitch_fees to anon, authenticated, service_role;
grant select, insert, update, delete on public.license_agreement_settings to anon, authenticated, service_role;
grant select, insert, update, delete on public.license_agreement_standard_instructions to anon, authenticated, service_role;
grant select, insert, update, delete on public.meter_import_batches to anon, authenticated, service_role;
grant select, insert, update, delete on public.meter_import_duplicate_groups to anon, authenticated, service_role;
grant select, insert, update, delete on public.meter_reading_settings to anon, authenticated, service_role;
grant select, insert, update, delete on public.meter_readings to anon, authenticated, service_role;
grant select, insert, update, delete on public.meters to anon, authenticated, service_role;
grant select, insert, update, delete on public.notifications to anon, authenticated, service_role;
grant select, insert, update, delete on public.office_hub_dashboard_items to anon, authenticated, service_role;
grant select, insert, update, delete on public.office_hub_doc_categories to anon, authenticated, service_role;
grant select, insert, update, delete on public.office_hub_documents to anon, authenticated, service_role;
grant select, insert, update, delete on public.office_hub_link_categories to anon, authenticated, service_role;
grant select, insert, update, delete on public.office_hub_links to anon, authenticated, service_role;
grant select, insert, update, delete on public.organisations to anon, authenticated, service_role;
grant select, insert, update, delete on public.permissions to anon, authenticated, service_role;
grant select, insert, update, delete on public.pitches to anon, authenticated, service_role;
grant select, insert, update, delete on public.platform_admins to anon, authenticated, service_role;
grant select, insert, update, delete on public.profile_machine_competencies to anon, authenticated, service_role;
grant select, insert, update, delete on public.profiles to anon, authenticated, service_role;
grant select, insert, update, delete on public.push_subscriptions to anon, authenticated, service_role;
grant select, insert, update, delete on public.ra_ms_documents to anon, authenticated, service_role;
grant select, insert, update, delete on public.repair_records to anon, authenticated, service_role;
grant select, insert, update, delete on public.rfid_login_attempts to anon, authenticated, service_role;
grant select, insert, update, delete on public.rfid_tags to anon, authenticated, service_role;
grant select, insert, update, delete on public.role_assignable_roles to anon, authenticated, service_role;
grant select, insert, update, delete on public.role_key_reasons to anon, authenticated, service_role;
grant select, insert, update, delete on public.role_permissions to anon, authenticated, service_role;
grant select, insert, update, delete on public.role_visibility to anon, authenticated, service_role;
grant select, insert, update, delete on public.roles to anon, authenticated, service_role;
grant select, insert, update, delete on public.schedule_task_types to anon, authenticated, service_role;
grant select, insert, update, delete on public.schedules to anon, authenticated, service_role;
grant select, insert, update, delete on public.service_template_tiers to anon, authenticated, service_role;
grant select, insert, update, delete on public.service_templates to anon, authenticated, service_role;
grant select, insert, update, delete on public.site_scope to anon, authenticated, service_role;
grant select, insert, update, delete on public.sites to anon, authenticated, service_role;
grant select, insert, update, delete on public.staff_time_profiles to anon, authenticated, service_role;
grant select, insert, update, delete on public.task_types to anon, authenticated, service_role;
grant select, insert, update, delete on public.terminology_templates to anon, authenticated, service_role;
grant select, insert, update, delete on public.timesheet_audit_log to anon, authenticated, service_role;
grant select, insert, update, delete on public.timesheet_entries to anon, authenticated, service_role;
grant select, insert, update, delete on public.timesheet_person_order to anon, authenticated, service_role;
grant select, insert, update, delete on public.timesheet_week_notes to anon, authenticated, service_role;
grant select, insert, update, delete on public.timesheet_weeks to anon, authenticated, service_role;
grant select, insert, update, delete on public.training_videos to anon, authenticated, service_role;

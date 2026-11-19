# Graph Report - treetops-maintenance  (2026-11-19)

## Corpus Check
- 301 files · ~237,473 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: .css 4, (none) 3, .example 1)

## Summary
- 2158 nodes · 6980 edges · 123 communities (85 shown, 38 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 190 edges (avg confidence: 0.85)
- Token cost: 401,249 input · 0 output

## Graph Freshness
- Built from commit: `cd82b404`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PageHeader
- App Shell & Routing
- TeamHolidayCalendar.jsx
- License Agreement Calculations
- OfficeHub.jsx
- public.profiles
- Select
- TimesheetsGrid.jsx
- Ponytail Skills & Sage Tool
- EmptyState
- Gallery.jsx
- public.job_subtasks
- Job Detail Page
- Data model
- Supabase Consolidation & Roles
- jobs table
- deploy.yml
- Search Picker & Key Tags Admin
- public.report_equipment_fault
- App.jsx
- StaffTimeProfilesTab.jsx
- Holiday Accrual Schema
- Pitches, Meters & Key Tags Schema
- ApprovalsInbox.jsx
- Jobs List & Printing
- Meter Scanning & Cache
- Claude Code Instructions
- Runtime Dependencies
- EquipmentTypesTab.jsx
- public.generate_due_service_jobs_for_equipment
- SchedulesTab
- NewJob
- notifyJobAssigned
- useAuth
- public.profiles
- Permission keys
- License Agreement Settings
- Equipment Types & Competencies Schema
- holidayQueries.js
- public.equipment
- TimesheetsGrid.jsx
- Equipment Documents
- public.key_checkouts
- Layout.jsx
- ContractorDocumentsModal.jsx
- role_visibility
- Customer Onboarding Script
- public.enforce_job_completion_photo_requirement
- HTML Entry & PWA Shell
- devDependencies
- profiles table
- check-styles.mjs
- Push Notification Functions
- Meter CSV Import
- main.jsx
- UsersTab
- Machine Competencies
- Equipment Doc Reminders Fn
- public.jobs
- GroupsTab
- Contractor Doc Reminders Fn
- Contractor Job Email Fn
- Runbook
- Manage Users Fn
- Scheduled Jobs Generator Fn
- Meter CSV Export
- public.timesheet_entries
- UI Redesign Plan
- Security plan (review of 17 Nov 2026)
- Priority Is a Solid Colour Bar, Never an Icon
- vite.config.js
- Textarea
- Build Brief
- main.jsx
- Terminal Session Fn
- RFID Login Fn
- npm Scripts
- SearchPicker
- GitHub Pages deploy pipeline
- Migration src/components/KeyReasonsModal.jsx
- Admiralty visual direction
- seed-users.mjs
- Admin.jsx
- useKeyHandover
- src/ui components
- key_tags table
- Timesheet.jsx

## God Nodes (most connected - your core abstractions)
1. `Button` - 172 edges
2. `Card` - 157 edges
3. `PageHeader()` - 154 edges
4. `useAuth()` - 141 edges
5. `Alert()` - 136 edges
6. `EmptyState()` - 108 edges
7. `react` - 104 edges
8. `colors` - 102 edges
9. `Input` - 98 edges
10. `JobDetail()` - 96 edges

## Surprising Connections (you probably didn't know these)
- `index.html App Entry` --references--> `TT Monogram Apple Touch Icon (cream TT on dark green)`  [EXTRACTED]
  index.html → public/apple-touch-icon.png
- `TT Monogram App Icon 192px (cream TT on dark green)` --conceptually_related_to--> `PWA Manifest (/manifest.webmanifest)`  [INFERRED]
  public/icon-192.png → index.html
- `TT Monogram Maskable App Icon 512px (cream TT on dark green)` --conceptually_related_to--> `PWA Manifest (/manifest.webmanifest)`  [INFERRED]
  public/icon-512-maskable.png → index.html
- `TT Monogram App Icon 512px (cream TT on dark green)` --conceptually_related_to--> `PWA Manifest (/manifest.webmanifest)`  [INFERRED]
  public/icon-512.png → index.html
- `==CORE== Pure Logic Block (shared with tests)` --semantically_similar_to--> `One Runnable Check Rule`  [INFERRED] [semantically similar]
  public/tools/campmanager-to-sage.html → .claude/skills/ponytail/SKILL.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **GitHub Pages SPA Deep-link Flow** — public_404_github_pages_spa_fallback, index_spa_redirect_restore, public_404_kiosk_magic_link_redirect [EXTRACTED 1.00]
- **Platform abstraction boundary modules** — src_platform_notifications, src_platform_syncqueue, src_platform_camera [EXTRACTED 1.00]
- **Ponytail Skill Suite** — _claude_skills_ponytail_skill_ponytail_skill, _claude_skills_ponytail_review_skill_ponytail_review_skill, _claude_skills_ponytail_audit_skill_ponytail_audit_skill, _claude_skills_ponytail_debt_skill_ponytail_debt_skill, _claude_skills_ponytail_gain_skill_ponytail_gain_skill, _claude_skills_ponytail_help_skill_ponytail_help_skill [EXTRACTED 1.00]
- **RFID terminal sign-in and login_context flow** — src_kiosk_kiosksignin, src_components_rfidscanlistener, supabase_functions_rfid_login, supabase_functions_clear_login_context, src_app [EXTRACTED 1.00]
- **Single filtered-jobs query reused across surfaces** — src_lib_jobsquery, src_pages_jobslist, src_pages_dashboard, src_kiosk_kioskjobs, src_lib_csvexport [EXTRACTED 1.00]
- **Six-Phase UI Redesign Programme** — ui_redesign_plan_phase_1_foundation, ui_redesign_plan_phase_2_ui_primitives, ui_redesign_plan_phase_3_navigation_rebuild, ui_redesign_plan_phase_4_screen_pass, ui_redesign_plan_phase_5_polish, ui_redesign_plan_phase_6_guardrails [EXTRACTED 1.00]
- **Token Layer (tokens.css, base.css, theme.js)** — src_styles_tokens, src_styles_base, src_lib_theme, ui_redesign_plan_design_tokens [EXTRACTED 1.00]
- **CampManager CSV to Sage CSV Pipeline** — public_tools_campmanager_to_sage_parsecsv, public_tools_campmanager_to_sage_detectkind, public_tools_campmanager_to_sage_buildexport, public_tools_campmanager_to_sage_tosagecsv, public_tools_campmanager_to_sage_downloadblob [INFERRED 0.85]
- **Per-App Namespace Isolation in One Supabase Project** — supabase_consolidation_plan_schema_per_app, supabase_consolidation_plan_edge_function_prefixing, supabase_consolidation_plan_secret_prefixing, supabase_consolidation_plan_db_schema_client_option, supabase_consolidation_plan_accept_content_profile_headers [INFERRED 0.85]

## Communities (123 total, 38 thin omitted)

### Community 0 - "PageHeader"
Cohesion: 0.09
Nodes (42): react, searchStyle, typeLabel, AuthContext, supabase, loadTerminology(), checkboxSize, colors (+34 more)

### Community 1 - "App Shell & Routing"
Cohesion: 0.16
Nodes (36): react-router-dom, formatKeyLocation(), KeySelector(), locationLabel(), KeyStationActivityLog(), KeyStationApp(), KeyStationCheckIn(), KeyStationCheckOut() (+28 more)

### Community 2 - "TeamHolidayCalendar.jsx"
Cohesion: 0.27
Nodes (18): getTeamHolidayCalendar(), BookingCalendar(), isNonWorkingDay(), isSelectable(), DAY_HEADERS, addMonths(), firstOfMonth(), formatMonthLabel() (+10 more)

### Community 3 - "License Agreement Calculations"
Cohesion: 0.07
Nodes (65): applyStandardInstructionTokens(), autoCorrectTitlePairing(), buildMergeData(), computeCaravanAmount(), computeMonthsToCharge(), computePitchFeeProrataAmount(), DEFAULT_AREA_SEASON_MAP, derivePeopleFromRow() (+57 more)

### Community 4 - "OfficeHub.jsx"
Cohesion: 0.06
Nodes (52): Office Hub tile palette, RfidScanListener(), dialArcPath(), polarPoint(), StatDial(), KeyStationMenu(), getLatestChecklistVersions(), downloadCsv() (+44 more)

### Community 5 - "public.profiles"
Cohesion: 0.08
Nodes (29): SQL run order, public.equipment, public.equipment_checks, public.fault_reports, public.platform_admins, public.profiles, public.repair_records, public.site_scope (+21 more)

### Community 6 - "Select"
Cohesion: 0.07
Nodes (31): getHolidaySettings(), upsertHolidaySettings(), queryKeyCheckouts(), queryTimesheetAuditLog(), EquipmentCheckoutLogTab(), formatDateTime(), HolidaySettingsTab(), handleSave() (+23 more)

### Community 7 - "TimesheetsGrid.jsx"
Cohesion: 0.21
Nodes (24): getFixedHoursProfiles(), getRecentDailyEntries(), getWeekEntries(), getWeekEntriesForProfiles(), getWeekFreezeStatus(), getWeekNote(), insertAdjustment(), saveWeekNote() (+16 more)

### Community 8 - "Ponytail Skills & Sage Tool"
Cohesion: 0.07
Nodes (44): Ponytail Audit Skill, Ponytail Debt Ledger, Ponytail Debt Skill, Benchmark Median Scoreboard, Ponytail Gain Skill, Default Mode Config (PONYTAIL_DEFAULT_MODE / config.json), Ponytail Help Skill, Finding Tags (delete/stdlib/native/yagni/shrink) (+36 more)

### Community 9 - "EmptyState"
Cohesion: 0.14
Nodes (30): EquipmentLabel(), equipmentMakeModel(), buttonVariants, SafetyDocumentLink(), KioskApp(), KioskCheckIn(), KioskCheckOut(), KioskSafety() (+22 more)

### Community 10 - "Gallery.jsx"
Cohesion: 0.12
Nodes (44): Gallery, KioskMenu(), useTimesheetExcluded(), MeterReadingHome(), DEMO_ACTIVITY_TYPES, Gallery(), Row(), SIDEBAR_SPECIMEN_LINKS (+36 more)

### Community 11 - "public.job_subtasks"
Cohesion: 0.13
Nodes (16): public.job_photos, public.job_subtasks, job_subtasks_enforce_edit, public.activity_type_documents, public.can_see_document(), public.enforce_job_subtask_edit_permission(), public.ra_ms_documents, public.equipment_type_documents (+8 more)

### Community 12 - "Job Detail Page"
Cohesion: 0.06
Nodes (32): handleAddPhoto(), handleReportFault(), assigneeName(), JobDetail(), allSectionNames(), changeSubtaskSection(), checklistAsTemplateSchema(), editSubtaskLabelLocal() (+24 more)

### Community 13 - "Data model"
Cohesion: 0.16
Nodes (25): activity_type_documents table, common_fault_descriptions table, Data model, equipment table, equipment_checkouts table, equipment_checks table, equipment_type_checklist_versions table, equipment_type_documents table (+17 more)

### Community 14 - "Supabase Consolidation & Roles"
Cohesion: 0.06
Nodes (32): public.custom_access_token_hook(), public.terminal_sessions, Supabase Consolidation Plan, Accept-Profile / Content-Profile Headers, Auth Hooks Are Project-Wide, Auth Identity / UID Reconciliation, AZURE-SQL-MIGRATION-PLAN.md, Cloud Session Egress Block to Supabase (+24 more)

### Community 15 - "jobs table"
Cohesion: 0.17
Nodes (23): contractor_documents table, contractor_reasons table, contractors table, can_see_job(), delete_job, enforce_checklist_item_photo_requirement, enforce_checklist_requires_photo_permission, enforce_job_completion_photo_requirement (+15 more)

### Community 16 - "deploy.yml"
Cohesion: 0.06
Nodes (37): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+29 more)

### Community 17 - "Search Picker & Key Tags Admin"
Cohesion: 0.18
Nodes (19): highlightMatch(), KeyTagsTab(), handleAddLocation(), handleAssign(), handleMarkLost(), handleMove(), handleReinstate(), handleRemove() (+11 more)

### Community 18 - "public.report_equipment_fault"
Cohesion: 0.14
Nodes (12): public.group_members, public.groups, public.is_in_group(), public.can_assign_job(), public.role_assignable_roles, equipment_type_repair_assignees_default_uidx, equipment_type_repair_assignees_type_uidx, fault_reports_job_id_idx (+4 more)

### Community 19 - "App.jsx"
Cohesion: 0.10
Nodes (20): App(), AppShell(), DownloadMeters, LazyRoute(), MeterLabels, MeterProgress, MeterSettings, KeysGate() (+12 more)

### Community 20 - "StaffTimeProfilesTab.jsx"
Cohesion: 0.14
Nodes (21): DAY_KEYS, formatDays(), formatHours(), patternDayHours(), workingDayHours(), getHolidayStatus(), getProfilesForTimeProfileAdmin(), getStaffTimeProfile() (+13 more)

### Community 21 - "Holiday Accrual Schema"
Cohesion: 0.10
Nodes (23): holiday_bank_holiday_overrides_sync, holiday_bank_holidays_after_insert, public.apply_bank_holiday_for_profile(), public.approve_holiday_request(), public.decline_holiday_request(), public.holiday_accrual_ratio(), public.holiday_bank_holiday_overrides, public.holiday_bank_holidays (+15 more)

### Community 22 - "Pitches, Meters & Key Tags Schema"
Cohesion: 0.12
Nodes (26): public.pitches, public.sites, key_tag_events_key_tag_idx, key_tags_log_event, key_tags_pitch_idx, key_tags_special_location_idx, public.key_special_locations, public.key_tag_events (+18 more)

### Community 23 - "ApprovalsInbox.jsx"
Cohesion: 0.15
Nodes (17): approveHolidayRequest(), declineHolidayRequest(), getMyHolidayRequests(), getPendingApprovals(), withdrawHolidayRequest(), ApprovalCard(), ApprovalsInbox(), handleApprove() (+9 more)

### Community 24 - "Jobs List & Printing"
Cohesion: 0.09
Nodes (27): PrintableJobCard(), PrintRow(), printSectionHeading, SignOffField(), PrintableJobsChecklist(), tdStyle, thStyle, openJob() (+19 more)

### Community 25 - "Meter Scanning & Cache"
Cohesion: 0.15
Nodes (26): ScanMeter, getCurrentLocation(), fetchActiveMeters(), fetchOutstandingMeters(), fetchProgress(), findTodaysReadingForMeter(), refreshMetersCache(), resolveMeterByQrCode() (+18 more)

### Community 26 - "Claude Code Instructions"
Cohesion: 0.13
Nodes (8): graphify skill instructions, graphify, Claude Code Instructions, Shared Supabase project ozhwgrzlpvfdemmogmav, SUPABASE-CONSOLIDATION-PLAN.md, Deleted project qkbpsqlrzygcairtidye, SUPABASE-CONSOLIDATION-PLAN.md, Supabase project ozhwgrzlpvfdemmogmav

### Community 27 - "Runtime Dependencies"
Cohesion: 0.10
Nodes (27): dependencies, @dnd-kit/core@^6.3.1, @dnd-kit/sortable@^10.0.0, @dnd-kit/utilities@^3.2.2, docxtemplater@^3.69.3, html5-qrcode@^2.3.8, pizzip@^3.2.0, qrcode@^1.5.4 (+19 more)

### Community 28 - "EquipmentTypesTab.jsx"
Cohesion: 0.07
Nodes (37): assigneeKindAndIdFromRow(), assigneeLabel(), AssigneePicker(), fieldStyle, checklistVersionSavedLine(), ChecklistVersionView(), DocumentPicker(), getChecklistVersionsByIds() (+29 more)

### Community 29 - "public.generate_due_service_jobs_for_equipment"
Cohesion: 0.32
Nodes (9): public.apply_service_template(), public.equipment_service_schedules, public.equipment_service_tier_state, public.generate_due_service_jobs(), public.generate_due_service_jobs_for_equipment(), public.job_service_tiers, public.record_equipment_hours(), public.service_template_tiers (+1 more)

### Community 30 - "SchedulesTab"
Cohesion: 0.21
Nodes (9): buildRule(), describeRule(), parseRule(), SchedulesTab(), editSchedule(), handleDelete(), handleSave(), handleToggleActive() (+1 more)

### Community 31 - "NewJob"
Cohesion: 0.11
Nodes (20): ActivityTypePicker(), getAssignableTargets(), notifyJobAssigned(), cacheKey(), fetchFresh(), loadNewJobReferenceData(), readCache(), handleReportIssue() (+12 more)

### Community 32 - "notifyJobAssigned"
Cohesion: 0.12
Nodes (23): handleComplete(), today(), resolveLinkedEquipment(), writeJobCompletion(), resolveAssigneeRecipientIds(), resolveContractorEmployeeIds(), resolveGroupMemberIds(), isBlockingLink() (+15 more)

### Community 33 - "useAuth"
Cohesion: 0.09
Nodes (22): JobCard(), useViewAsCandidates(), ViewAsPicker(), JobRow(), KioskJobs(), useAuth(), formatDueDate(), useViewAsJobFilter() (+14 more)

### Community 34 - "public.profiles"
Cohesion: 0.14
Nodes (17): public.organisations, key_reason_presets_org_kind_idx, public.key_reason_presets, public.log_key_tag_event(), public.office_hub_dashboard_items, public.office_hub_doc_categories, public.office_hub_documents, public.office_hub_link_categories (+9 more)

### Community 35 - "Permission keys"
Cohesion: 0.11
Nodes (18): admin_force_check_in, can_check_off_item_without_photo, can_complete_job_without_photo, can_delete_jobs, can_edit_job_checklist, can_export_jobs, can_manage_contractors, can_manage_equipment_status (+10 more)

### Community 36 - "License Agreement Settings"
Cohesion: 0.14
Nodes (14): LicenseAgreementSettingsTab(), handlePitchFeesUpload(), handleTemplateUpload(), refresh(), validateXmlBrowser(), parseMoneyString(), parsePitchBandsCsv(), assertCount() (+6 more)

### Community 37 - "Equipment Types & Competencies Schema"
Cohesion: 0.15
Nodes (13): public.equipment_types, equipment_checkouts_set_checklist_version, equipment_types_record_checklist_version, public.equipment_type_checklist_versions, public.record_equipment_checklist_version(), public.set_equipment_checkout_checklist_version(), equipment_checkouts_set_competency_warning, profile_machine_competencies_current_unique (+5 more)

### Community 38 - "holidayQueries.js"
Cohesion: 0.29
Nodes (15): addBankHoliday(), addBankHolidayOverride(), deleteBankHoliday(), getBankHolidayOverrides(), getBankHolidays(), removeBankHolidayOverride(), BankHolidaysTab(), handleAdd() (+7 more)

### Community 39 - "public.equipment"
Cohesion: 0.17
Nodes (17): common_fault_descriptions_type_idx, equipment_checkouts_enforce_immutable, equipment_checkouts_equipment_idx, equipment_checkouts_open_unique, equipment_checkouts_profile_idx, public.admin_force_check_in(), public.common_fault_descriptions, public.enforce_equipment_checkout_immutable_fields() (+9 more)

### Community 40 - "TimesheetsGrid.jsx"
Cohesion: 0.19
Nodes (9): freezeWeek(), getSubmittableProfiles(), getWeekNotesForProfiles(), movePersonOrder(), unfreezeWeek(), TimesheetsGrid(), handleFreeze(), handleMove() (+1 more)

### Community 41 - "Equipment Documents"
Cohesion: 0.20
Nodes (13): EquipmentDocumentsModal(), handleAdd(), handleDelete(), refresh(), EquipmentTab(), handleDecommission(), handleForceCheckIn(), handleSave() (+5 more)

### Community 42 - "public.key_checkouts"
Cohesion: 0.20
Nodes (16): public.contractors, contractor_documents_contractor_idx, contractor_documents_pending_reminder_idx, contractor_documents_reset_reminder, public.can_manage_contractor_document(), public.contractor_documents, public.reset_contractor_document_reminder(), contractor_reasons_contractor_idx (+8 more)

### Community 43 - "Layout.jsx"
Cohesion: 0.08
Nodes (49): AccountMenu(), handleLayoutToggle(), initials(), Layout(), handleDndToggle(), handleEnablePush(), handleOnline(), refreshStatus() (+41 more)

### Community 44 - "ContractorDocumentsModal.jsx"
Cohesion: 0.16
Nodes (16): ContractorDocumentsModal(), handleAdd(), handleDelete(), refresh(), daysUntil(), DocumentRow(), formatDate(), ContractorsTab() (+8 more)

### Community 45 - "role_visibility"
Cohesion: 0.08
Nodes (21): admin_access_log, Backup/DR tier, Data model, equipment_type_repair_assignees fallback, inviteUserByEmail auth flow, Job lifecycle logic, Open questions, Organisation boundary (+13 more)

### Community 46 - "Customer Onboarding Script"
Cohesion: 0.17
Nodes (11): papaparse@^5.7.0, papaparse, __dirname, escapeSqlLiteral(), listSqlFilesInOrder(), main(), prompt(), promptList() (+3 more)

### Community 47 - "public.enforce_job_completion_photo_requirement"
Cohesion: 0.20
Nodes (10): public.job_statuses, jobs_enforce_reopen, public.enforce_job_reopen_permission(), public.forbid_role_delete_if_in_use(), roles_forbid_delete_if_in_use, jobs_enforce_completion_photo, public.enforce_job_completion_photo_requirement(), jobs_enforce_details_edit (+2 more)

### Community 48 - "HTML Entry & PWA Shell"
Cohesion: 0.19
Nodes (14): Minimal Pre-paint Reset, PWA Manifest (/manifest.webmanifest), index.html App Entry, SPA Redirect Restore Script, theme-color #142840 (synced with --c-moss-dark), GitHub Pages SPA 404 Fallback, RFID Kiosk Magic-link Redirect (/kiosk), TT Monogram Apple Touch Icon (cream TT on dark green) (+6 more)

### Community 49 - "devDependencies"
Cohesion: 0.16
Nodes (13): devDependencies, pg@^8.13.1, supabase@^2.111.0, workbox-core@^7.3.0, workbox-precaching@^7.3.0, workbox-routing@^7.3.0, workbox-strategies@^7.3.0, pg (+5 more)

### Community 50 - "profiles table"
Cohesion: 0.09
Nodes (20): areas table, export_logs table, forbid_role_delete_if_in_use, has_permission(), has_site_scope(), is_in_group(), job_is_assigned_to_me(), list_org_users (+12 more)

### Community 51 - "check-styles.mjs"
Cohesion: 0.26
Nodes (11): changedJsxFiles(), endOfOpenTag(), EXCLUDED, findViolations(), git(), lineOf(), main(), resolveBase() (+3 more)

### Community 52 - "Push Notification Functions"
Cohesion: 0.17
Nodes (4): corsHeaders, supabase, corsHeaders, supabase

### Community 53 - "Meter CSV Import"
Cohesion: 0.29
Nodes (13): UploadMeters, csvRowsToImportRows(), fetchDuplicateGroups(), fetchMeterCandidatesForGroup(), importMeterCsvFiles(), parseCsvFile(), resolveDuplicateGroup(), toIsoDate() (+5 more)

### Community 54 - "main.jsx"
Cohesion: 0.29
Nodes (4): src/styles/base.css, Global :focus-visible Ring, No Stylesheet Finding (1,425 inline styles), Phase 1 - CSS Foundation and Token Layer

### Community 55 - "UsersTab"
Cohesion: 0.33
Nodes (6): UsersTab(), handleDeactivate(), handleInvite(), handleReactivate(), handleSaveEdit(), refresh()

### Community 56 - "Machine Competencies"
Cohesion: 0.40
Nodes (7): getCurrentCompetencies(), saveCompetencies(), MachineCompetenciesTab(), competenciesFor(), handleSave(), openPerson(), refresh()

### Community 57 - "Equipment Doc Reminders Fn"
Cohesion: 0.22
Nodes (4): officeGroupEmails(), officeGroupId(), resend, supabase

### Community 58 - "public.jobs"
Cohesion: 0.05
Nodes (47): job_activity_forbid_delete, job_activity_job_idx, jobs_assignee_group_idx, jobs_assignee_profile_idx, jobs_org_site_idx, jobs_status_idx, notifications_recipient_idx, public.admin_access_log (+39 more)

### Community 59 - "GroupsTab"
Cohesion: 0.38
Nodes (4): GroupsTab(), handleDelete(), handleSave(), refresh()

### Community 61 - "Contractor Job Email Fn"
Cohesion: 0.22
Nodes (3): corsHeaders, resend, supabaseAdmin

### Community 62 - "Runbook"
Cohesion: 0.17
Nodes (16): Runbook, .env client variables, Resend, VAPID keys, What's NOT done yet, clear-login-context Edge Function, contractor-document-reminders Edge Function, equipment-document-reminders Edge Function (+8 more)

### Community 63 - "Manage Users Fn"
Cohesion: 0.25
Nodes (3): corsHeaders, resend, supabaseAdmin

### Community 64 - "Scheduled Jobs Generator Fn"
Cohesion: 0.32
Nodes (4): pushToRecipients(), resolveRecipients(), sendDueTodayReminders(), supabase

### Community 65 - "Meter CSV Export"
Cohesion: 0.39
Nodes (7): buildExportRows(), COLUMNS, downloadCsv(), exportMeterReadingsCsvs(), quoted(), toDdMmYyyy(), handleExport()

### Community 66 - "public.timesheet_entries"
Cohesion: 0.09
Nodes (27): public.freeze_timesheet_week(), public.timesheet_audit_log, public.timesheet_entries, public.timesheet_entries_before_delete(), public.timesheet_entries_before_insert(), public.timesheet_entries_before_update(), public.timesheet_person_order, public.timesheet_weeks (+19 more)

### Community 67 - "UI Redesign Plan"
Cohesion: 0.32
Nodes (8): UI Redesign Plan, Admin Tabs as Real Routes (/admin/:tab), Admiralty Navy Palette, Decisions D1-D6, Five Navigation Idioms Problem, Mobile Bottom Tab Bar, Palette Drift (Field Journal vs Admiralty), Phase 3 - Navigation and Chrome Rebuild

### Community 68 - "Security plan (review of 17 Nov 2026)"
Cohesion: 0.22
Nodes (8): 1. Fob sign-in can be used from anywhere (serious), 2. Bank-holiday helpers callable by any user (medium), 3. Push notices accept anything (lower), 4. Cron functions callable with the public key (low), 5. Housekeeping (low), Doing it, Security plan (review of 17 Nov 2026), What's already in good shape (checked 17 Nov 2026)

### Community 69 - "Priority Is a Solid Colour Bar, Never an Icon"
Cohesion: 0.40
Nodes (3): Overdue Pill, Phase 5 - Polish, Redesign Constraints (must not break)

### Community 70 - "vite.config.js"
Cohesion: 0.17
Nodes (8): vite@^5.2.0, vite-plugin-pwa@^0.20.5, @vitejs/plugin-react@^4.2.1, vite, vite-plugin-pwa, @vitejs/plugin-react, BUILD_LABEL, { version }

### Community 71 - "Textarea"
Cohesion: 0.08
Nodes (25): ChecklistBuilder(), PhotoThumb(), CommonFaultDescriptionsTab(), addFault(), moveFault(), refreshFaults(), removeFault(), sortIndicator() (+17 more)

### Community 72 - "Build Brief"
Cohesion: 0.11
Nodes (17): Build Brief, Aeroplane mode offline test, Branding overrides, CSV export with export_logs, Suggested build order, Supabase backend, Tree Tops Caravan Park Ltd, Tree Tops seed data (+9 more)

### Community 73 - "main.jsx"
Cohesion: 0.28
Nodes (7): src/styles/tokens.css, Checkbox Size Tiers (--checkbox-size-sm/md/kiosk), Container Width Scale (--width-sm..2xl), Design Tokens (type, spacing, radius, elevation, motion, control-h), Px Tokenizing Sweep, --scrollbox-max-h Token, Touch Target Sizing (44px minimum)

### Community 74 - "Terminal Session Fn"
Cohesion: 0.33
Nodes (3): ALLOWED_CONTEXTS, corsHeaders, supabaseAdmin

### Community 75 - "RFID Login Fn"
Cohesion: 0.33
Nodes (3): ALLOWED_CONTEXTS, corsHeaders, supabaseAdmin

### Community 76 - "npm Scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, onboard, preview

### Community 77 - "SearchPicker"
Cohesion: 0.40
Nodes (4): highlightMatch(), SearchPicker(), handleKeyDown(), selectItem()

### Community 78 - "GitHub Pages deploy pipeline"
Cohesion: 0.20
Nodes (6): GitHub Pages deploy pipeline, index.html, public/404.html, pg_stat_activity diagnostic, GitHub Pages hosting, Tech stack

### Community 114 - "Admiralty visual direction"
Cohesion: 0.20
Nodes (6): Admiralty visual direction, Field Journal palette, Typography (Lora, Work Sans, IBM Plex Mono), src/kiosk/kioskTheme.js, Field Journal design system, ActionGrid / ActionList (unified hub pages)

### Community 115 - "seed-users.mjs"
Cohesion: 0.29
Nodes (4): @supabase/supabase-js@^2.45.4, @supabase/supabase-js, SEED_USERS, supabase

### Community 117 - "Admin.jsx"
Cohesion: 0.06
Nodes (32): Admin(), ALL_TABS, GROUPS, JobAssignmentTab(), refresh(), toggle(), JobTemplatesTab(), handleDelete() (+24 more)

### Community 118 - "useKeyHandover"
Cohesion: 0.50
Nodes (3): useKeyHandover(), backToSelect(), refresh()

### Community 119 - "src/ui components"
Cohesion: 0.25
Nodes (6): src/ui components, Empty-State Sweep, Permission Matrix Sticky Column / Card View, Phase 2 - UI Primitives, Phase 4 - Screen-by-Screen Pass, /ui-gallery Dev Route

### Community 121 - "key_tags table"
Cohesion: 0.29
Nodes (8): admin_force_check_in_key, log_key_tag_event, key_checkouts table, key_special_locations table, key_tag_events table, key_tags table, can_manage_keys, pitches table

### Community 125 - "Timesheet.jsx"
Cohesion: 0.20
Nodes (16): DayRow(), KioskTimesheet(), WeekNote(), AddCorrectionForm(), CardTitle(), DayRow(), Timesheet(), WeekNote() (+8 more)

## Ambiguous Edges - Review These
- `Pro plan + Micro compute` → `GitHub Pages deploy pipeline`  [AMBIGUOUS]
  RUNBOOK.md · relation: conceptually_related_to

## Knowledge Gaps
- **54 isolated node(s):** `StaffTimeProfilesTab`, `theme.js Rewritten to Read Tokens (hinge)`, `Typography (Lora, Work Sans, IBM Plex Mono)`, `Empty-State Sweep`, `Permission Matrix Sticky Column / Card View` (+49 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 509 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **38 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Runbook` connect `Runbook` to `public.profiles`, `Build Brief`, `GitHub Pages deploy pipeline`, `seed-users.mjs`, `Claude Code Instructions`?**
  _High betweenness centrality (0.176) - this node is a cross-community bridge._
- **What connects `StaffTimeProfilesTab`, `theme.js Rewritten to Read Tokens (hinge)`, `Typography (Lora, Work Sans, IBM Plex Mono)` to the rest of the system?**
  _54 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PageHeader` be split into smaller, more focused modules?**
  _Cohesion score 0.09355787222667736 - nodes in this community are weakly interconnected._
- **Why does `SQL run order` connect `public.profiles` to `public.jobs`, `role_visibility`, `Runbook`?**
  _High betweenness centrality (0.171) - this node is a cross-community bridge._
- **Should `License Agreement Calculations` be split into smaller, more focused modules?**
  _Cohesion score 0.06664198445020363 - nodes in this community are weakly interconnected._
- **Why does `send-contractor-job-email Edge Function` connect `Runbook` to `notifyJobAssigned`, `Permission keys`, `jobs table`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Pro plan + Micro compute` and `GitHub Pages deploy pipeline`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
# Graph Report - treetops-maintenance  (2026-11-18)

## Corpus Check
- 296 files · ~233,166 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: .css 4, (none) 3, .example 1)

## Summary
- 2120 nodes · 6943 edges · 125 communities (88 shown, 37 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 190 edges (avg confidence: 0.85)
- Token cost: 401,249 input · 0 output

## Graph Freshness
- Built from commit: `731dc98c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PageHeader
- App Shell & Routing
- Holidays & Bank Holidays
- License Agreement Calculations
- OfficeHub.jsx
- icons.jsx
- EquipmentDetail.jsx
- Staff Timesheets UI
- Ponytail Skills & Sage Tool
- EmptyState
- Gallery.jsx
- 01-schema.sql
- Job Detail Page
- Data model
- Supabase Consolidation & Roles
- jobs table
- Deploy Workflow
- Search Picker & Key Tags Admin
- KeyStationMenu.jsx
- App.jsx
- EquipmentCheckoutLogTab.jsx
- Holiday Accrual Schema
- Pitches, Meters & Key Tags Schema
- syncQueue.js
- Jobs List & Printing
- Meter Scanning & Cache
- Runbook
- Runtime Dependencies
- Assignee Picker & Templates
- Job Photos & Subtasks Schema
- public.equipment
- New Job Form
- JobDetail.jsx
- Button
- public.profiles
- Input
- License Agreement Settings
- Equipment Types & Competencies Schema
- public.job_subtasks
- public.equipment
- supabaseClient.js
- Equipment Documents
- public.contractors
- Layout.jsx
- ContractorDocumentsModal.jsx
- role_visibility
- Customer Onboarding Script
- newJobReferenceData.js
- HTML Entry & PWA Shell
- Dev Dependencies & Workbox
- RLS Helper Functions
- check-styles.mjs
- Push Notification Functions
- Meter CSV Import
- Claude Code Instructions
- Build & Versioning
- Machine Competencies
- Equipment Doc Reminders Fn
- public.profiles
- Users Admin
- Contractor Doc Reminders Fn
- Contractor Job Email Fn
- public.sites
- Manage Users Fn
- Scheduled Jobs Generator Fn
- Meter CSV Export
- public.timesheet_entries
- UI Redesign Plan
- Security plan (review of 17 Nov 2026)
- Permission keys
- Admin.jsx
- IconButton
- Build Brief
- main.jsx
- Terminal Session Fn
- RFID Login Fn
- npm Scripts
- profiles table
- System Specification
- Migration src/components/KeyReasonsModal.jsx
- Admiralty visual direction
- useEquipmentCheckout
- csvExport.js
- RfidScanListener
- src/ui components
- equipmentCheckoutsQuery.js
- key_tags table
- Job lifecycle logic
- rfid-login Edge Function
- contractor_documents table

## God Nodes (most connected - your core abstractions)
1. `Button` - 187 edges
2. `PageHeader()` - 170 edges
3. `Card` - 169 edges
4. `Alert()` - 152 edges
5. `useAuth()` - 139 edges
6. `EmptyState()` - 112 edges
7. `Input` - 109 edges
8. `react` - 103 edges
9. `colors` - 102 edges
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

## Communities (125 total, 37 thin omitted)

### Community 0 - "PageHeader"
Cohesion: 0.09
Nodes (48): react, KioskApp(), KioskSafety(), AuthContext, useAuth(), checkboxSize, colors, radius (+40 more)

### Community 1 - "App Shell & Routing"
Cohesion: 0.10
Nodes (42): react-router-dom, formatKeyLocation(), KeySelector(), locationLabel(), KeyStationActivityLog(), KeyStationApp(), KeyStationCheckIn(), KeyStationCheckOut() (+34 more)

### Community 2 - "Holidays & Bank Holidays"
Cohesion: 0.06
Nodes (64): addBankHoliday(), addBankHolidayOverride(), approveHolidayRequest(), declineHolidayRequest(), deleteBankHoliday(), getBankHolidayOverrides(), getBankHolidays(), getHolidaySettings() (+56 more)

### Community 3 - "License Agreement Calculations"
Cohesion: 0.07
Nodes (65): applyStandardInstructionTokens(), autoCorrectTitlePairing(), buildMergeData(), computeCaravanAmount(), computeMonthsToCharge(), computePitchFeeProrataAmount(), DEFAULT_AREA_SEASON_MAP, derivePeopleFromRow() (+57 more)

### Community 4 - "OfficeHub.jsx"
Cohesion: 0.10
Nodes (24): Office Hub tile palette, countMachinesCheckedOut(), TILE_COLORS, TILE_ICONS, tileColorValue(), ApprovalsInbox, BrowseList(), BrowseTab() (+16 more)

### Community 5 - "icons.jsx"
Cohesion: 0.19
Nodes (20): MeterReadingHome(), IconCamera(), IconCheck(), IconChevronDown(), IconEdit(), IconFilter(), IconFolder(), IconGallery() (+12 more)

### Community 6 - "EquipmentDetail.jsx"
Cohesion: 0.16
Nodes (8): ariaSort(), EquipmentDetail(), formatDateTime(), HISTORY_STATUS, HISTORY_STATUS_CHIPS, oneMonthAgoISODate(), Section(), statusLabels

### Community 7 - "Staff Timesheets UI"
Cohesion: 0.13
Nodes (45): getFixedHoursProfiles(), freezeWeek(), getRecentDailyEntries(), getSubmittableProfiles(), getWeekEntries(), getWeekEntriesForProfiles(), getWeekFreezeStatus(), getWeekNote() (+37 more)

### Community 8 - "Ponytail Skills & Sage Tool"
Cohesion: 0.07
Nodes (44): Ponytail Audit Skill, Ponytail Debt Ledger, Ponytail Debt Skill, Benchmark Median Scoreboard, Ponytail Gain Skill, Default Mode Config (PONYTAIL_DEFAULT_MODE / config.json), Ponytail Help Skill, Finding Tags (delete/stdlib/native/yagni/shrink) (+36 more)

### Community 9 - "EmptyState"
Cohesion: 0.32
Nodes (14): EquipmentLabel(), equipmentMakeModel(), buttonVariants, SafetyDocumentLink(), KioskCheckIn(), KioskCheckOut(), ReportIssueForm(), handleCheckOut() (+6 more)

### Community 10 - "Gallery.jsx"
Cohesion: 0.14
Nodes (31): Gallery, ActivityTypePicker(), SyncStatus(), STEPS, DEMO_ACTIVITY_TYPES, Gallery(), Row(), SIDEBAR_SPECIMEN_LINKS (+23 more)

### Community 11 - "01-schema.sql"
Cohesion: 0.08
Nodes (35): job_activity_forbid_delete, job_activity_job_idx, jobs_assignee_group_idx, jobs_assignee_profile_idx, jobs_org_site_idx, jobs_status_idx, notifications_recipient_idx, public.admin_access_log (+27 more)

### Community 12 - "Job Detail Page"
Cohesion: 0.06
Nodes (36): newLinkedJobPath(), handleReportFault(), assigneeName(), JobDetail(), allSectionNames(), changeSubtaskSection(), checklistAsTemplateSchema(), confirmComplete() (+28 more)

### Community 13 - "Data model"
Cohesion: 0.18
Nodes (22): activity_type_documents table, common_fault_descriptions table, Data model, equipment table, equipment_checkouts table, equipment_checks table, equipment_type_checklist_versions table, equipment_type_documents table (+14 more)

### Community 14 - "Supabase Consolidation & Roles"
Cohesion: 0.06
Nodes (32): public.custom_access_token_hook(), public.terminal_sessions, Supabase Consolidation Plan, Accept-Profile / Content-Profile Headers, Auth Hooks Are Project-Wide, Auth Identity / UID Reconciliation, AZURE-SQL-MIGRATION-PLAN.md, Cloud Session Egress Block to Supabase (+24 more)

### Community 15 - "jobs table"
Cohesion: 0.21
Nodes (20): can_see_job(), delete_job, enforce_checklist_item_photo_requirement, enforce_checklist_requires_photo_permission, enforce_job_completion_photo_requirement, enforce_job_reallocation_permission, enforce_job_reopen_permission, enforce_job_subtask_edit_permission (+12 more)

### Community 16 - "Deploy Workflow"
Cohesion: 0.06
Nodes (37): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+29 more)

### Community 17 - "Search Picker & Key Tags Admin"
Cohesion: 0.08
Nodes (32): highlightMatch(), SearchPicker(), handleKeyDown(), selectItem(), highlightMatch(), KeyTagsTab(), handleAddLocation(), handleAssign() (+24 more)

### Community 18 - "KeyStationMenu.jsx"
Cohesion: 0.26
Nodes (13): dialArcPath(), polarPoint(), StatDial(), KeyStationMenu(), queryEquipmentSignals(), KEY_GROUPS, keyIssuedToLabel(), keyLocationLabel() (+5 more)

### Community 19 - "App.jsx"
Cohesion: 0.14
Nodes (15): AppShell(), DownloadMeters, LazyRoute(), MeterLabels, MeterProgress, MeterSettings, UploadMeters, KeysGate() (+7 more)

### Community 20 - "EquipmentCheckoutLogTab.jsx"
Cohesion: 0.10
Nodes (18): ChecklistBuilder(), checklistVersionSavedLine(), ChecklistVersionView(), exportEquipmentCheckoutsCsv(), EquipmentCheckoutLogTab(), handleExport(), sortIndicator(), EVENT_TYPE (+10 more)

### Community 21 - "Holiday Accrual Schema"
Cohesion: 0.10
Nodes (22): holiday_bank_holiday_overrides_sync, holiday_bank_holidays_after_insert, public.apply_bank_holiday_for_profile(), public.approve_holiday_request(), public.decline_holiday_request(), public.holiday_accrual_ratio(), public.holiday_bank_holiday_overrides, public.holiday_bank_holidays (+14 more)

### Community 22 - "Pitches, Meters & Key Tags Schema"
Cohesion: 0.10
Nodes (25): public.pitches, key_tag_events_key_tag_idx, key_tags_log_event, key_tags_pitch_idx, key_tags_special_location_idx, public.key_special_locations, public.key_tag_events, public.key_tags (+17 more)

### Community 23 - "syncQueue.js"
Cohesion: 0.25
Nodes (14): handleOnline(), refreshStatus(), flushQueue(), flushReadingQueue(), flushStore(), getQueueStatus(), getReadingQueueStatus(), openDB() (+6 more)

### Community 24 - "Jobs List & Printing"
Cohesion: 0.12
Nodes (24): PrintableJobsChecklist(), tdStyle, thStyle, openJob(), exportSelectedJobsCsv(), loadJobForPrint(), openPrintWindow(), writeAndPrintJobBundles() (+16 more)

### Community 25 - "Meter Scanning & Cache"
Cohesion: 0.16
Nodes (25): ScanMeter, getCurrentLocation(), fetchActiveMeters(), fetchOutstandingMeters(), fetchProgress(), findTodaysReadingForMeter(), refreshMetersCache(), resolveMeterByQrCode() (+17 more)

### Community 26 - "Runbook"
Cohesion: 0.12
Nodes (20): Runbook, .env client variables, pg_stat_activity diagnostic, Resend, VAPID keys, What's NOT done yet, SEED_USERS, supabase (+12 more)

### Community 27 - "Runtime Dependencies"
Cohesion: 0.09
Nodes (29): dependencies, @dnd-kit/core@^6.3.1, @dnd-kit/sortable@^10.0.0, @dnd-kit/utilities@^3.2.2, docxtemplater@^3.69.3, html5-qrcode@^2.3.8, pizzip@^3.2.0, qrcode@^1.5.4 (+21 more)

### Community 28 - "Assignee Picker & Templates"
Cohesion: 0.11
Nodes (23): assigneeKindAndIdFromRow(), assigneeLabel(), AssigneePicker(), fieldStyle, getChecklistVersionsForType(), EquipmentTypesTab(), editType(), handleDelete() (+15 more)

### Community 29 - "Job Photos & Subtasks Schema"
Cohesion: 0.20
Nodes (10): public.job_statuses, jobs_enforce_reopen, public.enforce_job_reopen_permission(), public.forbid_role_delete_if_in_use(), roles_forbid_delete_if_in_use, jobs_enforce_completion_photo, public.enforce_job_completion_photo_requirement(), jobs_enforce_details_edit (+2 more)

### Community 30 - "public.equipment"
Cohesion: 0.26
Nodes (10): public.equipment_monitor_events, public.apply_service_template(), public.equipment_service_schedules, public.equipment_service_tier_state, public.generate_due_service_jobs(), public.generate_due_service_jobs_for_equipment(), public.job_service_tiers, public.record_equipment_hours() (+2 more)

### Community 31 - "New Job Form"
Cohesion: 0.20
Nodes (5): NewJob(), goToStep(), handleContinueFromWhat(), handleSubmit(), uploadPhotoForJob()

### Community 32 - "JobDetail.jsx"
Cohesion: 0.11
Nodes (26): JobCard(), JobRow(), KioskJobs(), handleAddPhoto(), handleComplete(), today(), formatDueDate(), isBlockingLink() (+18 more)

### Community 33 - "Button"
Cohesion: 0.15
Nodes (16): DocumentPicker(), searchStyle, typeLabel, queryKeyCheckouts(), ActivityTypesTab(), handleDelete(), handleSave(), refresh() (+8 more)

### Community 34 - "public.profiles"
Cohesion: 0.16
Nodes (15): public.organisations, public.office_hub_dashboard_items, public.office_hub_doc_categories, public.office_hub_documents, public.office_hub_link_categories, public.office_hub_links, public.license_agreement_area_seasons, public.license_agreement_drafts (+7 more)

### Community 35 - "Input"
Cohesion: 0.07
Nodes (30): DayRow(), KioskTimesheet(), WeekNote(), queryTimesheetAuditLog(), HolidaySettingsTab(), MONTH_NAMES, ATTACHMENT_TYPES, blankCategory (+22 more)

### Community 36 - "License Agreement Settings"
Cohesion: 0.14
Nodes (14): LicenseAgreementSettingsTab(), handlePitchFeesUpload(), handleTemplateUpload(), refresh(), validateXmlBrowser(), parseMoneyString(), parsePitchBandsCsv(), assertCount() (+6 more)

### Community 37 - "Equipment Types & Competencies Schema"
Cohesion: 0.15
Nodes (13): public.equipment_types, equipment_checkouts_set_checklist_version, equipment_types_record_checklist_version, public.equipment_type_checklist_versions, public.record_equipment_checklist_version(), public.set_equipment_checkout_checklist_version(), equipment_checkouts_set_competency_warning, profile_machine_competencies_current_unique (+5 more)

### Community 38 - "public.job_subtasks"
Cohesion: 0.13
Nodes (16): public.job_photos, public.job_subtasks, job_subtasks_enforce_edit, public.activity_type_documents, public.can_see_document(), public.enforce_job_subtask_edit_permission(), public.ra_ms_documents, public.equipment_type_documents (+8 more)

### Community 39 - "public.equipment"
Cohesion: 0.07
Nodes (35): public.equipment, public.equipment_checks, public.fault_photos, public.fault_reports, public.repair_records, common_fault_descriptions_type_idx, equipment_checkouts_enforce_immutable, equipment_checkouts_equipment_idx (+27 more)

### Community 40 - "supabaseClient.js"
Cohesion: 0.15
Nodes (13): resolveLinkedEquipment(), writeJobCompletion(), notifyJobAssigned(), resolveAssigneeRecipientIds(), resolveContractorEmployeeIds(), resolveGroupMemberIds(), notifyLinkedJobClosed(), supabase (+5 more)

### Community 41 - "Equipment Documents"
Cohesion: 0.15
Nodes (19): daysUntil(), DocumentRow(), EquipmentDocumentsModal(), handleAdd(), handleDelete(), refresh(), formatDate(), blank (+11 more)

### Community 42 - "public.contractors"
Cohesion: 0.24
Nodes (9): jobs_assignee_contractor_idx, public.can_see_job(), public.contractors, contractor_documents_contractor_idx, contractor_documents_pending_reminder_idx, contractor_documents_reset_reminder, public.can_manage_contractor_document(), public.contractor_documents (+1 more)

### Community 43 - "Layout.jsx"
Cohesion: 0.13
Nodes (29): AccountMenu(), handleLayoutToggle(), initials(), Layout(), handleDndToggle(), handleEnablePush(), readSidebarCollapsed(), Sidebar() (+21 more)

### Community 44 - "ContractorDocumentsModal.jsx"
Cohesion: 0.17
Nodes (16): ContractorDocumentsModal(), handleAdd(), handleDelete(), refresh(), daysUntil(), DocumentRow(), formatDate(), ContractorsTab() (+8 more)

### Community 45 - "role_visibility"
Cohesion: 0.14
Nodes (11): admin_access_log, Backup/DR tier, Data model, equipment_type_repair_assignees fallback, inviteUserByEmail auth flow, Open questions, Organisation boundary, role_visibility (+3 more)

### Community 46 - "Customer Onboarding Script"
Cohesion: 0.17
Nodes (11): papaparse@^5.7.0, papaparse, __dirname, escapeSqlLiteral(), listSqlFilesInOrder(), main(), prompt(), promptList() (+3 more)

### Community 47 - "newJobReferenceData.js"
Cohesion: 0.52
Nodes (5): getAssignableTargets(), cacheKey(), fetchFresh(), loadNewJobReferenceData(), readCache()

### Community 48 - "HTML Entry & PWA Shell"
Cohesion: 0.19
Nodes (14): Minimal Pre-paint Reset, PWA Manifest (/manifest.webmanifest), index.html App Entry, SPA Redirect Restore Script, theme-color #142840 (synced with --c-moss-dark), GitHub Pages SPA 404 Fallback, RFID Kiosk Magic-link Redirect (/kiosk), TT Monogram Apple Touch Icon (cream TT on dark green) (+6 more)

### Community 49 - "Dev Dependencies & Workbox"
Cohesion: 0.14
Nodes (15): devDependencies, pg@^8.13.1, supabase@^2.111.0, vite@^5.2.0, workbox-core@^7.3.0, workbox-precaching@^7.3.0, workbox-routing@^7.3.0, workbox-strategies@^7.3.0 (+7 more)

### Community 50 - "RLS Helper Functions"
Cohesion: 0.10
Nodes (14): admin_access_log table, has_permission(), is_in_group(), is_platform_admin(), job_is_assigned_to_me(), role_can_see_role(), group_members table, groups table (+6 more)

### Community 51 - "check-styles.mjs"
Cohesion: 0.14
Nodes (18): changedJsxFiles(), endOfOpenTag(), EXCLUDED, findViolations(), git(), lineOf(), main(), resolveBase() (+10 more)

### Community 52 - "Push Notification Functions"
Cohesion: 0.17
Nodes (4): corsHeaders, supabase, corsHeaders, supabase

### Community 53 - "Meter CSV Import"
Cohesion: 0.28
Nodes (12): csvRowsToImportRows(), fetchDuplicateGroups(), fetchMeterCandidatesForGroup(), importMeterCsvFiles(), parseCsvFile(), resolveDuplicateGroup(), toIsoDate(), DuplicateGroupCard() (+4 more)

### Community 54 - "Claude Code Instructions"
Cohesion: 0.15
Nodes (8): graphify skill instructions, graphify, Claude Code Instructions, Shared Supabase project ozhwgrzlpvfdemmogmav, SUPABASE-CONSOLIDATION-PLAN.md, Deleted project qkbpsqlrzygcairtidye, SUPABASE-CONSOLIDATION-PLAN.md, Supabase project ozhwgrzlpvfdemmogmav

### Community 55 - "Build & Versioning"
Cohesion: 0.20
Nodes (6): vite-plugin-pwa@^0.20.5, @vitejs/plugin-react@^4.2.1, vite-plugin-pwa, @vitejs/plugin-react, BUILD_LABEL, { version }

### Community 56 - "Machine Competencies"
Cohesion: 0.43
Nodes (7): getCurrentCompetencies(), saveCompetencies(), MachineCompetenciesTab(), competenciesFor(), handleSave(), openPerson(), refresh()

### Community 57 - "Equipment Doc Reminders Fn"
Cohesion: 0.22
Nodes (4): officeGroupEmails(), officeGroupId(), resend, supabase

### Community 58 - "public.profiles"
Cohesion: 0.07
Nodes (33): SQL run order, public.group_members, public.groups, public.permissions, public.platform_admins, public.profiles, public.role_permissions, public.role_visibility (+25 more)

### Community 59 - "Users Admin"
Cohesion: 0.33
Nodes (6): UsersTab(), handleDeactivate(), handleInvite(), handleReactivate(), handleSaveEdit(), refresh()

### Community 61 - "Contractor Job Email Fn"
Cohesion: 0.22
Nodes (3): corsHeaders, resend, supabaseAdmin

### Community 62 - "public.sites"
Cohesion: 0.29
Nodes (13): public.sites, meter_readings_meter_id_idx, meter_readings_pending_export_idx, meters_qr_code_current_key, public.can_see_meter(), public.import_meters(), public.mark_readings_exported(), public.meter_import_batches (+5 more)

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
Cohesion: 0.15
Nodes (20): public.freeze_timesheet_week(), public.timesheet_audit_log, public.timesheet_entries, public.timesheet_entries_before_delete(), public.timesheet_entries_before_insert(), public.timesheet_entries_before_update(), public.timesheet_weeks, public.unfreeze_timesheet_week() (+12 more)

### Community 67 - "UI Redesign Plan"
Cohesion: 0.15
Nodes (13): UI Redesign Plan, Admin Tabs as Real Routes (/admin/:tab), Admiralty Navy Palette, Decisions D1-D6, Five Navigation Idioms Problem, Mobile Bottom Tab Bar, No Stylesheet Finding (1,425 inline styles), Overdue Pill (+5 more)

### Community 68 - "Security plan (review of 17 Nov 2026)"
Cohesion: 0.22
Nodes (8): 1. Fob sign-in can be used from anywhere (serious), 2. Bank-holiday helpers callable by any user (medium), 3. Push notices accept anything (lower), 4. Cron functions callable with the public key (low), 5. Housekeeping (low), Doing it, Security plan (review of 17 Nov 2026), What's already in good shape (checked 17 Nov 2026)

### Community 69 - "Permission keys"
Cohesion: 0.12
Nodes (17): admin_force_check_in, can_check_off_item_without_photo, can_complete_job_without_photo, can_delete_jobs, can_edit_job_checklist, can_export_jobs, can_manage_equipment_status, can_manage_machine_competencies (+9 more)

### Community 70 - "Admin.jsx"
Cohesion: 0.09
Nodes (23): Admin(), ALL_TABS, GROUPS, GroupsTab(), handleDelete(), handleSave(), refresh(), JobAssignmentTab() (+15 more)

### Community 71 - "IconButton"
Cohesion: 0.12
Nodes (22): PhotoThumb(), PrintableJobCard(), PrintRow(), printSectionHeading, SignOffField(), useMediaQuery(), CommonFaultDescriptionsTab(), addFault() (+14 more)

### Community 72 - "Build Brief"
Cohesion: 0.15
Nodes (8): Build Brief, Branding overrides, CSV export with export_logs, Supabase backend, Tree Tops Caravan Park Ltd, Tree Tops seed data, treetops-maintenance.jsx prototype, downscaleImage()

### Community 73 - "main.jsx"
Cohesion: 0.14
Nodes (10): App(), AuthProvider(), consumePendingTerminalLogin(), loadOfflineProfileCache(), loadStoredViewingAs(), saveOfflineProfileCache(), storedSessionWhileOffline(), loadTerminology() (+2 more)

### Community 74 - "Terminal Session Fn"
Cohesion: 0.33
Nodes (3): ALLOWED_CONTEXTS, corsHeaders, supabaseAdmin

### Community 75 - "RFID Login Fn"
Cohesion: 0.33
Nodes (3): ALLOWED_CONTEXTS, corsHeaders, supabaseAdmin

### Community 76 - "npm Scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, onboard, preview

### Community 77 - "profiles table"
Cohesion: 0.19
Nodes (13): manage-users Edge Function, areas table, export_logs table, forbid_role_delete_if_in_use, has_site_scope(), list_org_users, organisations table, can_manage_users (+5 more)

### Community 78 - "System Specification"
Cohesion: 0.18
Nodes (11): Aeroplane mode offline test, Suggested build order, GitHub Pages deploy pipeline, index.html, public/404.html, System Specification, GitHub Pages hosting, Key station (+3 more)

### Community 114 - "Admiralty visual direction"
Cohesion: 0.20
Nodes (6): Admiralty visual direction, Field Journal palette, Typography (Lora, Work Sans, IBM Plex Mono), src/kiosk/kioskTheme.js, Field Journal design system, ActionGrid / ActionList (unified hub pages)

### Community 115 - "useEquipmentCheckout"
Cohesion: 0.40
Nodes (7): getLatestChecklistVersions(), getAvailableUnits(), getEquipmentTypeAvailabilityCounts(), getCompetentTypeIds(), useEquipmentCheckout(), backToCategories(), openCategory()

### Community 117 - "csvExport.js"
Cohesion: 0.36
Nodes (8): downloadCsv(), exportJobsCsv(), JOBS_CSV_COLUMNS, jobsToCsvRows(), toCsvValue(), queryJobs(), Dashboard(), handleExport()

### Community 118 - "RfidScanListener"
Cohesion: 0.33
Nodes (3): RfidScanListener(), KeyStationSignIn(), KioskSignIn()

### Community 119 - "src/ui components"
Cohesion: 0.25
Nodes (6): src/ui components, Empty-State Sweep, Permission Matrix Sticky Column / Card View, Phase 2 - UI Primitives, Phase 4 - Screen-by-Screen Pass, /ui-gallery Dev Route

### Community 120 - "equipmentCheckoutsQuery.js"
Cohesion: 0.54
Nodes (6): getChecklistVersionsByIds(), applyCommonFilters(), queryCheckoutEvents(), queryEquipmentHistory(), queryFaultEvents(), queryRepairEvents()

### Community 121 - "key_tags table"
Cohesion: 0.29
Nodes (8): admin_force_check_in_key, log_key_tag_event, key_checkouts table, key_special_locations table, key_tag_events table, key_tags table, can_manage_keys, pitches table

### Community 122 - "Job lifecycle logic"
Cohesion: 0.33
Nodes (4): Job lifecycle logic, Reallocation, RRULE, Scheduling Edge Function

### Community 123 - "rfid-login Edge Function"
Cohesion: 0.40
Nodes (5): clear-login-context Edge Function, rfid-login Edge Function, can_access_desktop, rfid_login_attempts table, rfid_tags table

### Community 124 - "contractor_documents table"
Cohesion: 0.67
Nodes (3): contractor_documents table, contractor_reasons table, contractors table

## Ambiguous Edges - Review These
- `GitHub Pages deploy pipeline` → `Pro plan + Micro compute`  [AMBIGUOUS]
  RUNBOOK.md · relation: conceptually_related_to

## Knowledge Gaps
- **53 isolated node(s):** `theme.js Rewritten to Read Tokens (hinge)`, `role_key_reasons table`, `Auth Identity / UID Reconciliation`, `Cloud Session Egress Block to Supabase`, `Freeze Window and Cutover` (+48 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 495 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **37 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Runbook` connect `Runbook` to `Build Brief`, `profiles table`, `System Specification`, `Claude Code Instructions`, `public.profiles`, `rfid-login Edge Function`?**
  _High betweenness centrality (0.204) - this node is a cross-community bridge._
- **What connects `theme.js Rewritten to Read Tokens (hinge)`, `role_key_reasons table`, `Auth Identity / UID Reconciliation` to the rest of the system?**
  _53 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PageHeader` be split into smaller, more focused modules?**
  _Cohesion score 0.09467040673211781 - nodes in this community are weakly interconnected._
- **Why does `SQL run order` connect `public.profiles` to `Runbook`, `01-schema.sql`, `role_visibility`?**
  _High betweenness centrality (0.197) - this node is a cross-community bridge._
- **Should `App Shell & Routing` be split into smaller, more focused modules?**
  _Cohesion score 0.10140350877192983 - nodes in this community are weakly interconnected._
- **Why does `send-contractor-job-email Edge Function` connect `Runbook` to `JobDetail.jsx`, `jobs table`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `GitHub Pages deploy pipeline` and `Pro plan + Micro compute`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
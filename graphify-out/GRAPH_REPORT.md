# Graph Report - treetops-maintenance  (2026-11-18)

## Corpus Check
- 298 files · ~234,435 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: .css 4, (none) 3, .example 1)

## Summary
- 2141 nodes · 6927 edges · 128 communities (90 shown, 38 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 190 edges (avg confidence: 0.85)
- Token cost: 401,249 input · 0 output

## Graph Freshness
- Built from commit: `e8691cce`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PageHeader
- App Shell & Routing
- TeamHolidayCalendar.jsx
- License Agreement Calculations
- OfficeHub.jsx
- TimesheetsGrid.jsx
- Select
- Staff Timesheets UI
- Ponytail Skills & Sage Tool
- EmptyState
- JobDetail.jsx
- public.jobs
- Job Detail Page
- Data model
- Supabase Consolidation & Roles
- jobs table
- Deploy Workflow
- Search Picker & Key Tags Admin
- StaffTimeProfilesTab.jsx
- App.jsx
- EquipmentCheckoutLogTab
- Holiday Accrual Schema
- Pitches, Meters & Key Tags Schema
- syncQueue.js
- Jobs List & Printing
- Meter Scanning & Cache
- Runbook
- Runtime Dependencies
- Assignee Picker & Templates
- public.report_equipment_fault
- holidayQueries.js
- New Job Form
- JobCard.jsx
- ActivityTypesTab
- public.profiles
- OfficeHubTab.jsx
- License Agreement Settings
- Equipment Types & Competencies Schema
- KioskJobs
- public.equipment
- notifyJobAssigned
- Equipment Documents
- public.contractors
- Layout.jsx
- ContractorDocumentsModal.jsx
- role_visibility
- Customer Onboarding Script
- MyRequests.jsx
- HTML Entry & PWA Shell
- Dev Dependencies & Workbox
- RLS Helper Functions
- check-styles.mjs
- Push Notification Functions
- Meter CSV Import
- Claude Code Instructions
- PhotoThumb
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
- ApprovalsInbox.jsx
- GroupsTab
- RolesPermissionsTab
- Build Brief
- main.jsx
- Terminal Session Fn
- RFID Login Fn
- npm Scripts
- BookingReview.jsx
- System Specification
- Migration src/components/KeyReasonsModal.jsx
- Admiralty visual direction
- seed-users.mjs
- JobTemplatesTab
- useKeyCheckin
- src/ui components
- useKeyCheckout
- key_tags table
- useKeyForceCheckIn
- useKeyHandover
- useKeyRelocate
- SafetyLibraryTab
- loadJobForPrint.js

## God Nodes (most connected - your core abstractions)
1. `Button` - 176 edges
2. `Card` - 165 edges
3. `PageHeader()` - 160 edges
4. `Alert()` - 142 edges
5. `useAuth()` - 141 edges
6. `EmptyState()` - 112 edges
7. `react` - 104 edges
8. `colors` - 102 edges
9. `Input` - 102 edges
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

## Communities (128 total, 38 thin omitted)

### Community 0 - "PageHeader"
Cohesion: 0.08
Nodes (56): react, ActivityTypePicker(), checklistVersionSavedLine(), ChecklistVersionView(), DocumentPicker(), searchStyle, typeLabel, AuthContext (+48 more)

### Community 1 - "App Shell & Routing"
Cohesion: 0.15
Nodes (42): react-router-dom, formatKeyLocation(), KeySelector(), locationLabel(), KeyStationActivityLog(), KeyStationApp(), KeyStationCheckIn(), KeyStationCheckOut() (+34 more)

### Community 2 - "TeamHolidayCalendar.jsx"
Cohesion: 0.27
Nodes (18): getTeamHolidayCalendar(), BookingCalendar(), isNonWorkingDay(), isSelectable(), DAY_HEADERS, addMonths(), firstOfMonth(), formatMonthLabel() (+10 more)

### Community 3 - "License Agreement Calculations"
Cohesion: 0.06
Nodes (70): applyStandardInstructionTokens(), autoCorrectTitlePairing(), buildMergeData(), computeCaravanAmount(), computeMonthsToCharge(), computePitchFeeProrataAmount(), DEFAULT_AREA_SEASON_MAP, derivePeopleFromRow() (+62 more)

### Community 4 - "OfficeHub.jsx"
Cohesion: 0.09
Nodes (34): RfidScanListener(), dialArcPath(), polarPoint(), StatDial(), KeyStationMenu(), countMachinesCheckedOut(), queryEquipmentSignals(), queryJobs() (+26 more)

### Community 5 - "TimesheetsGrid.jsx"
Cohesion: 0.14
Nodes (24): freezeWeek(), getSubmittableProfiles(), getWeekNotesForProfiles(), movePersonOrder(), unfreezeWeek(), AddCorrectionForm(), CardTitle(), DayRow() (+16 more)

### Community 6 - "Select"
Cohesion: 0.07
Nodes (30): queryKeyCheckouts(), queryTimesheetAuditLog(), JobAssignmentTab(), refresh(), toggle(), formatDateTime(), issuedToLabel(), KeyActivityLogTab() (+22 more)

### Community 7 - "Staff Timesheets UI"
Cohesion: 0.22
Nodes (22): getFixedHoursProfiles(), getRecentDailyEntries(), getWeekEntries(), getWeekEntriesForProfiles(), getWeekFreezeStatus(), getWeekNote(), insertAdjustment(), saveWeekNote() (+14 more)

### Community 8 - "Ponytail Skills & Sage Tool"
Cohesion: 0.07
Nodes (44): Ponytail Audit Skill, Ponytail Debt Ledger, Ponytail Debt Skill, Benchmark Median Scoreboard, Ponytail Gain Skill, Default Mode Config (PONYTAIL_DEFAULT_MODE / config.json), Ponytail Help Skill, Finding Tags (delete/stdlib/native/yagni/shrink) (+36 more)

### Community 9 - "EmptyState"
Cohesion: 0.16
Nodes (25): EquipmentLabel(), equipmentMakeModel(), buttonVariants, SafetyDocumentLink(), KioskApp(), KioskCheckIn(), KioskCheckOut(), KioskSafety() (+17 more)

### Community 10 - "JobDetail.jsx"
Cohesion: 0.11
Nodes (51): Gallery, KioskMenu(), useTimesheetExcluded(), MobileNav(), CONTRACTOR_EMAIL_SIGNATURE, LINKED_ACTIVITY_VERB, PRIORITIES, MeterReadingHome() (+43 more)

### Community 11 - "public.jobs"
Cohesion: 0.08
Nodes (27): public.job_photos, public.job_subtasks, public.jobs, public.delete_job(), jobs_assignee_contractor_idx, public.can_see_job(), job_subtasks_enforce_photo_requirement, job_subtasks_enforce_requires_photo_permission (+19 more)

### Community 12 - "Job Detail Page"
Cohesion: 0.07
Nodes (27): assigneeName(), buildDefaultContractorEmailBody(), JobDetail(), allSectionNames(), changeSubtaskSection(), checklistAsTemplateSchema(), confirmComplete(), editSubtaskLabelLocal() (+19 more)

### Community 13 - "Data model"
Cohesion: 0.10
Nodes (38): activity_type_documents table, areas table, common_fault_descriptions table, Data model, equipment table, equipment_checkouts table, equipment_checks table, equipment_type_checklist_versions table (+30 more)

### Community 14 - "Supabase Consolidation & Roles"
Cohesion: 0.06
Nodes (32): public.custom_access_token_hook(), public.terminal_sessions, Supabase Consolidation Plan, Accept-Profile / Content-Profile Headers, Auth Hooks Are Project-Wide, Auth Identity / UID Reconciliation, AZURE-SQL-MIGRATION-PLAN.md, Cloud Session Egress Block to Supabase (+24 more)

### Community 15 - "jobs table"
Cohesion: 0.09
Nodes (39): admin_force_check_in, can_see_job(), delete_job, enforce_checklist_item_photo_requirement, enforce_checklist_requires_photo_permission, enforce_job_completion_photo_requirement, enforce_job_reallocation_permission, enforce_job_reopen_permission (+31 more)

### Community 16 - "Deploy Workflow"
Cohesion: 0.06
Nodes (37): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+29 more)

### Community 17 - "Search Picker & Key Tags Admin"
Cohesion: 0.08
Nodes (32): highlightMatch(), SearchPicker(), handleKeyDown(), selectItem(), highlightMatch(), KeyTagsTab(), handleAddLocation(), handleAssign() (+24 more)

### Community 18 - "StaffTimeProfilesTab.jsx"
Cohesion: 0.12
Nodes (11): DayRow(), KioskTimesheet(), WeekNote(), getProfilesForTimeProfileAdmin(), upsertStaffTimeProfile(), DAYS, DEFAULT_PATTERN, entitlementHours() (+3 more)

### Community 19 - "App.jsx"
Cohesion: 0.08
Nodes (29): App(), AppShell(), DownloadMeters, LazyRoute(), MeterLabels, MeterProgress, MeterSettings, KeysGate() (+21 more)

### Community 20 - "EquipmentCheckoutLogTab"
Cohesion: 0.15
Nodes (18): getChecklistVersionsByIds(), downloadCsv(), exportEquipmentCheckoutsCsv(), exportJobsCsv(), exportSelectedJobsCsv(), JOBS_CSV_COLUMNS, jobsToCsvRows(), toCsvValue() (+10 more)

### Community 21 - "Holiday Accrual Schema"
Cohesion: 0.09
Nodes (25): holiday_bank_holiday_overrides_sync, holiday_bank_holidays_after_insert, public.apply_bank_holiday_for_profile(), public.approve_holiday_request(), public.decline_holiday_request(), public.holiday_accrual_ratio(), public.holiday_accrued_hours(), public.holiday_bank_holiday_overrides (+17 more)

### Community 22 - "Pitches, Meters & Key Tags Schema"
Cohesion: 0.11
Nodes (24): key_tag_events_key_tag_idx, key_tags_log_event, key_tags_pitch_idx, key_tags_special_location_idx, public.key_special_locations, public.key_tag_events, public.key_tags, public.log_key_tag_event() (+16 more)

### Community 23 - "syncQueue.js"
Cohesion: 0.15
Nodes (22): Layout(), handleDndToggle(), handleEnablePush(), handleOnline(), refreshStatus(), readSidebarCollapsed(), ViewAsBanner(), setDNDEnabled() (+14 more)

### Community 24 - "Jobs List & Printing"
Cohesion: 0.13
Nodes (17): PrintableJobsChecklist(), tdStyle, thStyle, openPrintWindow(), writeAndPrintJobBundles(), writeAndPrintJobsChecklist(), handlePrint(), initialFilters() (+9 more)

### Community 25 - "Meter Scanning & Cache"
Cohesion: 0.15
Nodes (26): ScanMeter, getCurrentLocation(), fetchActiveMeters(), fetchOutstandingMeters(), fetchProgress(), findTodaysReadingForMeter(), refreshMetersCache(), resolveMeterByQrCode() (+18 more)

### Community 26 - "Runbook"
Cohesion: 0.12
Nodes (23): Aeroplane mode offline test, Runbook, .env client variables, Resend, VAPID keys, What's NOT done yet, clear-login-context Edge Function, contractor-document-reminders Edge Function (+15 more)

### Community 27 - "Runtime Dependencies"
Cohesion: 0.09
Nodes (29): dependencies, @dnd-kit/core@^6.3.1, @dnd-kit/sortable@^10.0.0, @dnd-kit/utilities@^3.2.2, docxtemplater@^3.69.3, html5-qrcode@^2.3.8, papaparse@^5.7.0, pizzip@^3.2.0 (+21 more)

### Community 28 - "Assignee Picker & Templates"
Cohesion: 0.11
Nodes (23): assigneeKindAndIdFromRow(), assigneeLabel(), AssigneePicker(), fieldStyle, getChecklistVersionsForType(), EquipmentTypesTab(), editType(), handleDelete() (+15 more)

### Community 29 - "public.report_equipment_fault"
Cohesion: 0.09
Nodes (21): public.job_statuses, jobs_enforce_reopen, public.enforce_job_reopen_permission(), public.forbid_role_delete_if_in_use(), roles_forbid_delete_if_in_use, jobs_enforce_completion_photo, public.enforce_job_completion_photo_requirement(), jobs_enforce_details_edit (+13 more)

### Community 30 - "holidayQueries.js"
Cohesion: 0.20
Nodes (19): addBankHoliday(), addBankHolidayOverride(), deleteBankHoliday(), getBankHolidayOverrides(), getBankHolidays(), getHolidaySettings(), getHolidayStatus(), getStaffTimeProfile() (+11 more)

### Community 31 - "New Job Form"
Cohesion: 0.15
Nodes (10): getAssignableTargets(), cacheKey(), fetchFresh(), loadNewJobReferenceData(), readCache(), NewJob(), goToStep(), handleContinueFromWhat() (+2 more)

### Community 32 - "JobCard.jsx"
Cohesion: 0.20
Nodes (14): JobCard(), JobRow(), resolveLinkedEquipment(), writeJobCompletion(), formatDueDate(), isBlockingLink(), newLinkedJobPath(), notifyLinkedJobClosed() (+6 more)

### Community 33 - "ActivityTypesTab"
Cohesion: 0.47
Nodes (4): ActivityTypesTab(), handleDelete(), handleSave(), refresh()

### Community 34 - "public.profiles"
Cohesion: 0.09
Nodes (28): public.job_types, public.organisations, public.schedules, public.task_types, public.training_videos, job_subtasks_enforce_edit, public.activity_type_documents, public.can_see_document() (+20 more)

### Community 35 - "OfficeHubTab.jsx"
Cohesion: 0.06
Nodes (31): Office Hub tile palette, ChecklistBuilder(), TILE_COLORS, TILE_ICONS, tileColorValue(), CommonFaultDescriptionsTab(), addFault(), moveFault() (+23 more)

### Community 36 - "License Agreement Settings"
Cohesion: 0.14
Nodes (14): LicenseAgreementSettingsTab(), handlePitchFeesUpload(), handleTemplateUpload(), refresh(), validateXmlBrowser(), parseMoneyString(), parsePitchBandsCsv(), assertCount() (+6 more)

### Community 37 - "Equipment Types & Competencies Schema"
Cohesion: 0.15
Nodes (13): public.equipment_types, equipment_checkouts_set_checklist_version, equipment_types_record_checklist_version, public.equipment_type_checklist_versions, public.record_equipment_checklist_version(), public.set_equipment_checkout_checklist_version(), equipment_checkouts_set_competency_warning, profile_machine_competencies_current_unique (+5 more)

### Community 38 - "KioskJobs"
Cohesion: 0.18
Nodes (11): KioskJobs(), handleAddPhoto(), handleComplete(), openJob(), today(), loadJobForPrint(), handleAddPhoto(), handleChecklistPhotoCapture() (+3 more)

### Community 39 - "public.equipment"
Cohesion: 0.11
Nodes (26): public.equipment, public.equipment_checks, common_fault_descriptions_type_idx, equipment_checkouts_enforce_immutable, equipment_checkouts_equipment_idx, equipment_checkouts_open_unique, equipment_checkouts_profile_idx, public.admin_force_check_in() (+18 more)

### Community 40 - "notifyJobAssigned"
Cohesion: 0.18
Nodes (10): notifyJobAssigned(), resolveAssigneeRecipientIds(), resolveContractorEmployeeIds(), resolveGroupMemberIds(), useEquipmentCheckin(), handleReportIssue(), handleReportIssue(), handleReportFault() (+2 more)

### Community 41 - "Equipment Documents"
Cohesion: 0.15
Nodes (16): daysUntil(), DocumentRow(), EquipmentDocumentsModal(), handleAdd(), handleDelete(), refresh(), formatDate(), EquipmentTab() (+8 more)

### Community 42 - "public.contractors"
Cohesion: 0.24
Nodes (11): public.contractors, contractor_documents_contractor_idx, contractor_documents_pending_reminder_idx, contractor_documents_reset_reminder, public.can_manage_contractor_document(), public.contractor_documents, public.reset_contractor_document_reminder(), equipment_type_repair_assignees_default_uidx (+3 more)

### Community 43 - "Layout.jsx"
Cohesion: 0.14
Nodes (20): AccountMenu(), handleLayoutToggle(), initials(), Sidebar(), SyncStatus(), ViewAsPicker(), BUILD_LABEL, detectIsMobile() (+12 more)

### Community 44 - "ContractorDocumentsModal.jsx"
Cohesion: 0.17
Nodes (15): ContractorDocumentsModal(), handleAdd(), handleDelete(), refresh(), daysUntil(), DocumentRow(), formatDate(), ContractorsTab() (+7 more)

### Community 45 - "role_visibility"
Cohesion: 0.15
Nodes (11): Backup/DR tier, equipment_type_repair_assignees fallback, Open questions, role_visibility, Andy, role_visibility pending confirmation, SQL run order, role_can_see_role() (+3 more)

### Community 46 - "Customer Onboarding Script"
Cohesion: 0.20
Nodes (9): __dirname, escapeSqlLiteral(), listSqlFilesInOrder(), main(), prompt(), promptList(), runFile(), SKIP_FILES (+1 more)

### Community 47 - "MyRequests.jsx"
Cohesion: 0.31
Nodes (9): getMyHolidayRequests(), withdrawHolidayRequest(), BookHoliday(), handleSubmitted(), MyRequests(), handleWithdraw(), refresh(), RequestCard() (+1 more)

### Community 48 - "HTML Entry & PWA Shell"
Cohesion: 0.19
Nodes (14): Minimal Pre-paint Reset, PWA Manifest (/manifest.webmanifest), index.html App Entry, SPA Redirect Restore Script, theme-color #142840 (synced with --c-moss-dark), GitHub Pages SPA 404 Fallback, RFID Kiosk Magic-link Redirect (/kiosk), TT Monogram Apple Touch Icon (cream TT on dark green) (+6 more)

### Community 49 - "Dev Dependencies & Workbox"
Cohesion: 0.10
Nodes (20): devDependencies, pg@^8.13.1, supabase@^2.111.0, vite@^5.2.0, vite-plugin-pwa@^0.20.5, @vitejs/plugin-react@^4.2.1, workbox-core@^7.3.0, workbox-precaching@^7.3.0 (+12 more)

### Community 50 - "RLS Helper Functions"
Cohesion: 0.13
Nodes (6): admin_access_log, admin_access_log table, has_site_scope(), is_platform_admin(), job_is_assigned_to_me(), platform_admins table

### Community 51 - "check-styles.mjs"
Cohesion: 0.29
Nodes (10): changedJsxFiles(), endOfOpenTag(), EXCLUDED, findViolations(), git(), lineOf(), main(), resolveBase() (+2 more)

### Community 52 - "Push Notification Functions"
Cohesion: 0.17
Nodes (4): corsHeaders, supabase, corsHeaders, supabase

### Community 53 - "Meter CSV Import"
Cohesion: 0.29
Nodes (13): UploadMeters, csvRowsToImportRows(), fetchDuplicateGroups(), fetchMeterCandidatesForGroup(), importMeterCsvFiles(), parseCsvFile(), resolveDuplicateGroup(), toIsoDate() (+5 more)

### Community 54 - "Claude Code Instructions"
Cohesion: 0.15
Nodes (8): graphify skill instructions, graphify, Claude Code Instructions, Shared Supabase project ozhwgrzlpvfdemmogmav, SUPABASE-CONSOLIDATION-PLAN.md, Deleted project qkbpsqlrzygcairtidye, SUPABASE-CONSOLIDATION-PLAN.md, Supabase project ozhwgrzlpvfdemmogmav

### Community 55 - "PhotoThumb"
Cohesion: 0.36
Nodes (8): PhotoThumb(), PrintableJobCard(), PrintRow(), printSectionHeading, SignOffField(), minimumPeopleFor(), minimumPeopleMessage(), minimumPeopleTitle()

### Community 56 - "Machine Competencies"
Cohesion: 0.43
Nodes (7): getCurrentCompetencies(), saveCompetencies(), MachineCompetenciesTab(), competenciesFor(), handleSave(), openPerson(), refresh()

### Community 57 - "Equipment Doc Reminders Fn"
Cohesion: 0.22
Nodes (4): officeGroupEmails(), officeGroupId(), resend, supabase

### Community 58 - "public.profiles"
Cohesion: 0.06
Nodes (48): job_activity_forbid_delete, job_activity_job_idx, jobs_assignee_group_idx, jobs_assignee_profile_idx, jobs_org_site_idx, jobs_status_idx, notifications_recipient_idx, public.admin_access_log (+40 more)

### Community 59 - "Users Admin"
Cohesion: 0.33
Nodes (6): UsersTab(), handleDeactivate(), handleInvite(), handleReactivate(), handleSaveEdit(), refresh()

### Community 61 - "Contractor Job Email Fn"
Cohesion: 0.22
Nodes (3): corsHeaders, resend, supabaseAdmin

### Community 62 - "public.sites"
Cohesion: 0.25
Nodes (15): public.areas, public.pitches, public.sites, meter_readings_meter_id_idx, meter_readings_pending_export_idx, meters_qr_code_current_key, public.can_see_meter(), public.import_meters() (+7 more)

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
Cohesion: 0.19
Nodes (17): public.freeze_timesheet_week(), public.timesheet_audit_log, public.timesheet_entries, public.timesheet_entries_before_delete(), public.timesheet_entries_before_insert(), public.timesheet_entries_before_update(), public.timesheet_weeks, public.unfreeze_timesheet_week() (+9 more)

### Community 67 - "UI Redesign Plan"
Cohesion: 0.18
Nodes (11): UI Redesign Plan, Admin Tabs as Real Routes (/admin/:tab), Admiralty Navy Palette, Decisions D1-D6, Five Navigation Idioms Problem, Mobile Bottom Tab Bar, Overdue Pill, Palette Drift (Field Journal vs Admiralty) (+3 more)

### Community 68 - "Security plan (review of 17 Nov 2026)"
Cohesion: 0.22
Nodes (8): 1. Fob sign-in can be used from anywhere (serious), 2. Bank-holiday helpers callable by any user (medium), 3. Push notices accept anything (lower), 4. Cron functions callable with the public key (low), 5. Housekeeping (low), Doing it, Security plan (review of 17 Nov 2026), What's already in good shape (checked 17 Nov 2026)

### Community 69 - "ApprovalsInbox.jsx"
Cohesion: 0.47
Nodes (8): approveHolidayRequest(), declineHolidayRequest(), getPendingApprovals(), ApprovalCard(), ApprovalsInbox(), handleApprove(), handleDecline(), refresh()

### Community 70 - "GroupsTab"
Cohesion: 0.38
Nodes (4): GroupsTab(), handleDelete(), handleSave(), refresh()

### Community 71 - "RolesPermissionsTab"
Cohesion: 0.26
Nodes (11): useMediaQuery(), RolesPermissionsTab(), addRole(), deleteRole(), refresh(), saveRename(), toggle(), RoleVisibilityTab() (+3 more)

### Community 72 - "Build Brief"
Cohesion: 0.09
Nodes (18): Build Brief, Branding overrides, CSV export with export_logs, Data model, inviteUserByEmail auth flow, Job lifecycle logic, Organisation boundary, Reallocation (+10 more)

### Community 73 - "main.jsx"
Cohesion: 0.15
Nodes (11): src/styles/base.css, src/styles/tokens.css, Checkbox Size Tiers (--checkbox-size-sm/md/kiosk), Container Width Scale (--width-sm..2xl), Design Tokens (type, spacing, radius, elevation, motion, control-h), Global :focus-visible Ring, No Stylesheet Finding (1,425 inline styles), Phase 1 - CSS Foundation and Token Layer (+3 more)

### Community 74 - "Terminal Session Fn"
Cohesion: 0.33
Nodes (3): ALLOWED_CONTEXTS, corsHeaders, supabaseAdmin

### Community 75 - "RFID Login Fn"
Cohesion: 0.33
Nodes (3): ALLOWED_CONTEXTS, corsHeaders, supabaseAdmin

### Community 76 - "npm Scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, onboard, preview

### Community 77 - "BookingReview.jsx"
Cohesion: 0.39
Nodes (6): submitHolidayRequest(), BookingReview(), handleSubmit(), defaultDailyHours(), ReviewRow(), WEEKDAYS

### Community 78 - "System Specification"
Cohesion: 0.11
Nodes (14): GitHub Pages deploy pipeline, index.html, public/404.html, pg_stat_activity diagnostic, downscaleImage(), flush-dnd-notifications Edge Function, send-notice-push Edge Function, System Specification (+6 more)

### Community 114 - "Admiralty visual direction"
Cohesion: 0.20
Nodes (6): Admiralty visual direction, Field Journal palette, Typography (Lora, Work Sans, IBM Plex Mono), src/kiosk/kioskTheme.js, Field Journal design system, ActionGrid / ActionList (unified hub pages)

### Community 115 - "seed-users.mjs"
Cohesion: 0.29
Nodes (4): @supabase/supabase-js@^2.45.4, @supabase/supabase-js, SEED_USERS, supabase

### Community 117 - "JobTemplatesTab"
Cohesion: 0.47
Nodes (4): JobTemplatesTab(), handleDelete(), handleSave(), refresh()

### Community 118 - "useKeyCheckin"
Cohesion: 0.50
Nodes (3): useKeyCheckin(), backToSelect(), refresh()

### Community 119 - "src/ui components"
Cohesion: 0.25
Nodes (6): src/ui components, Empty-State Sweep, Permission Matrix Sticky Column / Card View, Phase 2 - UI Primitives, Phase 4 - Screen-by-Screen Pass, /ui-gallery Dev Route

### Community 120 - "useKeyCheckout"
Cohesion: 0.50
Nodes (3): useKeyCheckout(), backToSelect(), refresh()

### Community 121 - "key_tags table"
Cohesion: 0.33
Nodes (7): admin_force_check_in_key, log_key_tag_event, key_checkouts table, key_special_locations table, key_tag_events table, key_tags table, can_manage_keys

### Community 122 - "useKeyForceCheckIn"
Cohesion: 0.50
Nodes (3): useKeyForceCheckIn(), backToSelect(), refresh()

### Community 123 - "useKeyHandover"
Cohesion: 0.50
Nodes (3): useKeyHandover(), backToSelect(), refresh()

### Community 124 - "useKeyRelocate"
Cohesion: 0.50
Nodes (3): useKeyRelocate(), backToSelect(), refresh()

### Community 125 - "SafetyLibraryTab"
Cohesion: 0.60
Nodes (4): SafetyLibraryTab(), handleDelete(), handleSave(), refresh()

### Community 126 - "loadJobForPrint.js"
Cohesion: 0.50
Nodes (3): JOB_SELECT, PHOTO_COLUMNS, SUBTASK_COLUMNS

## Ambiguous Edges - Review These
- `Pro plan + Micro compute` → `GitHub Pages deploy pipeline`  [AMBIGUOUS]
  RUNBOOK.md · relation: conceptually_related_to

## Knowledge Gaps
- **54 isolated node(s):** `StaffTimeProfilesTab`, `theme.js Rewritten to Read Tokens (hinge)`, `Typography (Lora, Work Sans, IBM Plex Mono)`, `Empty-State Sweep`, `Permission Matrix Sticky Column / Card View` (+49 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 505 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **38 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Runbook` connect `Runbook` to `Build Brief`, `role_visibility`, `System Specification`, `seed-users.mjs`, `Claude Code Instructions`?**
  _High betweenness centrality (0.193) - this node is a cross-community bridge._
- **What connects `StaffTimeProfilesTab`, `theme.js Rewritten to Read Tokens (hinge)`, `Typography (Lora, Work Sans, IBM Plex Mono)` to the rest of the system?**
  _54 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PageHeader` be split into smaller, more focused modules?**
  _Cohesion score 0.08321048321048322 - nodes in this community are weakly interconnected._
- **Why does `SQL run order` connect `role_visibility` to `Runbook`, `public.profiles`?**
  _High betweenness centrality (0.186) - this node is a cross-community bridge._
- **Should `App Shell & Routing` be split into smaller, more focused modules?**
  _Cohesion score 0.14705882352941177 - nodes in this community are weakly interconnected._
- **Why does `useAuth()` connect `PageHeader` to `App Shell & Routing`, `License Agreement Calculations`, `OfficeHub.jsx`, `TimesheetsGrid.jsx`, `Select`, `Staff Timesheets UI`, `EmptyState`, `JobDetail.jsx`, `Job Detail Page`, `Search Picker & Key Tags Admin`, `StaffTimeProfilesTab.jsx`, `App.jsx`, `EquipmentCheckoutLogTab`, `syncQueue.js`, `Jobs List & Printing`, `Meter Scanning & Cache`, `Assignee Picker & Templates`, `holidayQueries.js`, `New Job Form`, `ActivityTypesTab`, `OfficeHubTab.jsx`, `License Agreement Settings`, `KioskJobs`, `notifyJobAssigned`, `Equipment Documents`, `Layout.jsx`, `ContractorDocumentsModal.jsx`, `MyRequests.jsx`, `Meter CSV Import`, `Machine Competencies`, `Users Admin`, `GroupsTab`, `RolesPermissionsTab`, `JobTemplatesTab`, `useKeyCheckin`, `useKeyCheckout`, `useKeyForceCheckIn`, `useKeyHandover`, `useKeyRelocate`, `SafetyLibraryTab`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `Pro plan + Micro compute` and `GitHub Pages deploy pipeline`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
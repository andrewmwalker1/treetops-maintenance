# Graph Report - treetops-maintenance  (2026-11-19)

## Corpus Check
- 300 files · ~236,981 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: .css 4, (none) 3, .example 1)

## Summary
- 2156 nodes · 6975 edges · 121 communities (82 shown, 39 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 190 edges (avg confidence: 0.85)
- Token cost: 401,249 input · 0 output

## Graph Freshness
- Built from commit: `e9218818`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PageHeader
- App Shell & Routing
- TeamHolidayCalendar.jsx
- License Agreement Calculations
- OfficeHub.jsx
- JobDetail.jsx
- Select
- TimesheetsGrid.jsx
- Ponytail Skills & Sage Tool
- EmptyState
- Gallery.jsx
- public.jobs
- Job Detail Page
- Data model
- Supabase Consolidation & Roles
- jobs table
- deploy.yml
- Search Picker & Key Tags Admin
- manage-users Edge Function
- useAuth
- StaffTimeProfilesTab.jsx
- Holiday Accrual Schema
- Pitches, Meters & Key Tags Schema
- ApprovalsInbox.jsx
- Jobs List & Printing
- Meter Scanning & Cache
- Runbook
- Runtime Dependencies
- EquipmentTypesTab.jsx
- public.equipment
- SchedulesTab.jsx
- NewJob
- notifyJobAssigned
- Card
- public.profiles
- OfficeHubTab.jsx
- License Agreement Settings
- Equipment Types & Competencies Schema
- holidayQueries.js
- public.equipment
- syncQueue.js
- Equipment Documents
- public.key_checkouts
- Layout.jsx
- ContractorDocumentsModal.jsx
- role_visibility
- Customer Onboarding Script
- public.enforce_job_completion_photo_requirement
- HTML Entry & PWA Shell
- devDependencies
- RLS Helper Functions
- check-styles.mjs
- Push Notification Functions
- Meter CSV Import
- main.jsx
- UsersTab
- Machine Competencies
- Equipment Doc Reminders Fn
- public.profiles
- Input
- Contractor Doc Reminders Fn
- Contractor Job Email Fn
- rfid-login Edge Function
- Manage Users Fn
- Scheduled Jobs Generator Fn
- Meter CSV Export
- public.timesheet_entries
- UI Redesign Plan
- Security plan (review of 17 Nov 2026)
- Priority Is a Solid Colour Bar, Never an Icon
- IconButton
- Build Brief
- main.jsx
- Terminal Session Fn
- RFID Login Fn
- npm Scripts
- public.role_key_reasons
- GitHub Pages deploy pipeline
- Migration src/components/KeyReasonsModal.jsx
- Admiralty visual direction
- seed-users.mjs
- Admin.jsx
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

## Communities (121 total, 39 thin omitted)

### Community 0 - "PageHeader"
Cohesion: 0.09
Nodes (40): react, searchStyle, typeLabel, AuthContext, AuthProvider(), consumePendingTerminalLogin(), loadOfflineProfileCache(), loadStoredViewingAs() (+32 more)

### Community 1 - "App Shell & Routing"
Cohesion: 0.12
Nodes (37): react-router-dom, formatKeyLocation(), KeySelector(), locationLabel(), KeyStationActivityLog(), KeyStationApp(), KeyStationCheckIn(), KeyStationCheckOut() (+29 more)

### Community 2 - "TeamHolidayCalendar.jsx"
Cohesion: 0.27
Nodes (18): getTeamHolidayCalendar(), BookingCalendar(), isNonWorkingDay(), isSelectable(), DAY_HEADERS, addMonths(), firstOfMonth(), formatMonthLabel() (+10 more)

### Community 3 - "License Agreement Calculations"
Cohesion: 0.07
Nodes (65): applyStandardInstructionTokens(), autoCorrectTitlePairing(), buildMergeData(), computeCaravanAmount(), computeMonthsToCharge(), computePitchFeeProrataAmount(), DEFAULT_AREA_SEASON_MAP, derivePeopleFromRow() (+57 more)

### Community 4 - "OfficeHub.jsx"
Cohesion: 0.06
Nodes (50): Office Hub tile palette, RfidScanListener(), dialArcPath(), polarPoint(), StatDial(), KeyStationMenu(), getLatestChecklistVersions(), downloadCsv() (+42 more)

### Community 5 - "JobDetail.jsx"
Cohesion: 0.11
Nodes (29): ChecklistBuilder(), JOB_SELECT, PHOTO_COLUMNS, SUBTASK_COLUMNS, sortIndicator(), historySortIndicator(), CONTRACTOR_EMAIL_SIGNATURE, LINKED_ACTIVITY_VERB (+21 more)

### Community 6 - "Select"
Cohesion: 0.09
Nodes (26): exportEquipmentCheckoutsCsv(), queryKeyCheckouts(), queryTimesheetAuditLog(), EquipmentCheckoutLogTab(), handleExport(), EVENT_TYPE, formatDateTime(), STATUS_CHIPS (+18 more)

### Community 7 - "TimesheetsGrid.jsx"
Cohesion: 0.12
Nodes (39): getFixedHoursProfiles(), freezeWeek(), getRecentDailyEntries(), getSubmittableProfiles(), getWeekEntries(), getWeekEntriesForProfiles(), getWeekFreezeStatus(), getWeekNote() (+31 more)

### Community 8 - "Ponytail Skills & Sage Tool"
Cohesion: 0.07
Nodes (44): Ponytail Audit Skill, Ponytail Debt Ledger, Ponytail Debt Skill, Benchmark Median Scoreboard, Ponytail Gain Skill, Default Mode Config (PONYTAIL_DEFAULT_MODE / config.json), Ponytail Help Skill, Finding Tags (delete/stdlib/native/yagni/shrink) (+36 more)

### Community 9 - "EmptyState"
Cohesion: 0.17
Nodes (29): EquipmentLabel(), equipmentMakeModel(), buttonVariants, SafetyDocumentLink(), KioskApp(), KioskCheckIn(), KioskCheckOut(), JobRow() (+21 more)

### Community 10 - "Gallery.jsx"
Cohesion: 0.19
Nodes (24): MeterReadingHome(), DEMO_ACTIVITY_TYPES, Gallery(), Row(), SIDEBAR_SPECIMEN_LINKS, SidebarSpecimen(), IconMeters(), IconPrint() (+16 more)

### Community 11 - "public.jobs"
Cohesion: 0.08
Nodes (27): public.job_photos, public.job_subtasks, public.jobs, public.delete_job(), jobs_assignee_contractor_idx, public.can_see_job(), job_subtasks_enforce_photo_requirement, job_subtasks_enforce_requires_photo_permission (+19 more)

### Community 12 - "Job Detail Page"
Cohesion: 0.06
Nodes (33): handleAddPhoto(), assigneeName(), buildDefaultContractorEmailBody(), JobDetail(), allSectionNames(), changeSubtaskSection(), checklistAsTemplateSchema(), confirmComplete() (+25 more)

### Community 13 - "Data model"
Cohesion: 0.09
Nodes (41): activity_type_documents table, areas table, common_fault_descriptions table, Data model, equipment table, equipment_checkouts table, equipment_checks table, equipment_type_checklist_versions table (+33 more)

### Community 14 - "Supabase Consolidation & Roles"
Cohesion: 0.06
Nodes (32): public.custom_access_token_hook(), public.terminal_sessions, Supabase Consolidation Plan, Accept-Profile / Content-Profile Headers, Auth Hooks Are Project-Wide, Auth Identity / UID Reconciliation, AZURE-SQL-MIGRATION-PLAN.md, Cloud Session Egress Block to Supabase (+24 more)

### Community 15 - "jobs table"
Cohesion: 0.10
Nodes (36): admin_force_check_in, can_see_job(), delete_job, enforce_checklist_item_photo_requirement, enforce_checklist_requires_photo_permission, enforce_job_completion_photo_requirement, enforce_job_reallocation_permission, enforce_job_reopen_permission (+28 more)

### Community 16 - "deploy.yml"
Cohesion: 0.06
Nodes (37): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+29 more)

### Community 17 - "Search Picker & Key Tags Admin"
Cohesion: 0.19
Nodes (18): highlightMatch(), KeyTagsTab(), handleAddLocation(), handleAssign(), handleMarkLost(), handleMove(), handleReinstate(), handleRemove() (+10 more)

### Community 18 - "manage-users Edge Function"
Cohesion: 0.50
Nodes (3): manage-users Edge Function, list_org_users, can_manage_users

### Community 19 - "useAuth"
Cohesion: 0.07
Nodes (32): App(), AppShell(), DownloadMeters, Gallery, LazyRoute(), MeterLabels, MeterProgress, MeterSettings (+24 more)

### Community 20 - "StaffTimeProfilesTab.jsx"
Cohesion: 0.14
Nodes (20): DAY_KEYS, formatDays(), formatHours(), patternDayHours(), workingDayHours(), getHolidayStatus(), getProfilesForTimeProfileAdmin(), submitHolidayRequest() (+12 more)

### Community 21 - "Holiday Accrual Schema"
Cohesion: 0.10
Nodes (20): holiday_bank_holiday_overrides_sync, holiday_bank_holidays_after_insert, public.apply_bank_holiday_for_profile(), public.holiday_accrual_ratio(), public.holiday_accrued_hours(), public.holiday_bank_holiday_overrides, public.holiday_bank_holidays, public.holiday_settings (+12 more)

### Community 22 - "Pitches, Meters & Key Tags Schema"
Cohesion: 0.12
Nodes (26): public.pitches, public.sites, key_tag_events_key_tag_idx, key_tags_log_event, key_tags_pitch_idx, key_tags_special_location_idx, public.key_special_locations, public.key_tag_events (+18 more)

### Community 23 - "ApprovalsInbox.jsx"
Cohesion: 0.15
Nodes (18): approveHolidayRequest(), declineHolidayRequest(), getMyHolidayRequests(), getPendingApprovals(), getStaffTimeProfile(), withdrawHolidayRequest(), ApprovalCard(), ApprovalsInbox() (+10 more)

### Community 24 - "Jobs List & Printing"
Cohesion: 0.09
Nodes (27): PrintableJobCard(), PrintRow(), printSectionHeading, SignOffField(), PrintableJobsChecklist(), tdStyle, thStyle, openJob() (+19 more)

### Community 25 - "Meter Scanning & Cache"
Cohesion: 0.15
Nodes (26): ScanMeter, getCurrentLocation(), fetchActiveMeters(), fetchOutstandingMeters(), fetchProgress(), findTodaysReadingForMeter(), refreshMetersCache(), resolveMeterByQrCode() (+18 more)

### Community 26 - "Runbook"
Cohesion: 0.07
Nodes (25): graphify skill instructions, graphify, Aeroplane mode offline test, Suggested build order, Claude Code Instructions, Shared Supabase project ozhwgrzlpvfdemmogmav, SUPABASE-CONSOLIDATION-PLAN.md, Runbook (+17 more)

### Community 27 - "Runtime Dependencies"
Cohesion: 0.09
Nodes (29): dependencies, @dnd-kit/core@^6.3.1, @dnd-kit/sortable@^10.0.0, @dnd-kit/utilities@^3.2.2, docxtemplater@^3.69.3, html5-qrcode@^2.3.8, papaparse@^5.7.0, pizzip@^3.2.0 (+21 more)

### Community 28 - "EquipmentTypesTab.jsx"
Cohesion: 0.09
Nodes (33): assigneeKindAndIdFromRow(), assigneeLabel(), AssigneePicker(), fieldStyle, checklistVersionSavedLine(), ChecklistVersionView(), DocumentPicker(), getChecklistVersionsByIds() (+25 more)

### Community 29 - "public.equipment"
Cohesion: 0.14
Nodes (19): public.equipment, public.job_statuses, public.report_equipment_fault(), public.equipment_monitor_events, public.apply_service_template(), public.equipment_service_schedules, public.equipment_service_tier_state, public.generate_due_service_jobs() (+11 more)

### Community 30 - "SchedulesTab.jsx"
Cohesion: 0.11
Nodes (19): highlightMatch(), SearchPicker(), handleKeyDown(), selectItem(), LocationPicker(), blank, buildRule(), describeRule() (+11 more)

### Community 31 - "NewJob"
Cohesion: 0.13
Nodes (15): ActivityTypePicker(), getAssignableTargets(), cacheKey(), fetchFresh(), loadNewJobReferenceData(), readCache(), NewJob(), goToStep() (+7 more)

### Community 32 - "notifyJobAssigned"
Cohesion: 0.11
Nodes (21): handleComplete(), today(), resolveLinkedEquipment(), writeJobCompletion(), notifyJobAssigned(), resolveAssigneeRecipientIds(), resolveContractorEmployeeIds(), resolveGroupMemberIds() (+13 more)

### Community 33 - "Card"
Cohesion: 0.15
Nodes (11): JobCard(), formatDueDate(), priorityColor, daysUntil(), DocumentRow(), formatDate(), CategoriesPanel(), Section() (+3 more)

### Community 34 - "public.profiles"
Cohesion: 0.08
Nodes (30): public.job_types, public.organisations, public.schedules, public.task_types, public.training_videos, job_subtasks_enforce_edit, public.activity_type_documents, public.can_see_document() (+22 more)

### Community 35 - "OfficeHubTab.jsx"
Cohesion: 0.13
Nodes (10): ATTACHMENT_TYPES, blankCategory, blankDoc, blankLink, DocumentsPanel(), handleFileChosen(), LinksPanel(), OfficeHubTab() (+2 more)

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

### Community 40 - "syncQueue.js"
Cohesion: 0.30
Nodes (14): handleOnline(), refreshStatus(), flushQueue(), flushReadingQueue(), flushStore(), getQueueStatus(), getReadingQueueStatus(), openDB() (+6 more)

### Community 41 - "Equipment Documents"
Cohesion: 0.20
Nodes (13): EquipmentDocumentsModal(), handleAdd(), handleDelete(), refresh(), EquipmentTab(), handleDecommission(), handleForceCheckIn(), handleSave() (+5 more)

### Community 42 - "public.key_checkouts"
Cohesion: 0.15
Nodes (20): public.contractors, contractor_documents_contractor_idx, contractor_documents_pending_reminder_idx, contractor_documents_reset_reminder, public.can_manage_contractor_document(), public.contractor_documents, public.reset_contractor_document_reminder(), contractor_reasons_contractor_idx (+12 more)

### Community 43 - "Layout.jsx"
Cohesion: 0.13
Nodes (28): AccountMenu(), handleLayoutToggle(), initials(), Layout(), handleDndToggle(), readSidebarCollapsed(), Sidebar(), SyncStatus() (+20 more)

### Community 44 - "ContractorDocumentsModal.jsx"
Cohesion: 0.17
Nodes (15): ContractorDocumentsModal(), handleAdd(), handleDelete(), refresh(), daysUntil(), DocumentRow(), formatDate(), ContractorsTab() (+7 more)

### Community 45 - "role_visibility"
Cohesion: 0.08
Nodes (19): Backup/DR tier, Data model, equipment_type_repair_assignees fallback, inviteUserByEmail auth flow, Job lifecycle logic, Open questions, Organisation boundary, Reallocation (+11 more)

### Community 46 - "Customer Onboarding Script"
Cohesion: 0.17
Nodes (11): pg@^8.13.1, pg, __dirname, escapeSqlLiteral(), listSqlFilesInOrder(), main(), prompt(), promptList() (+3 more)

### Community 47 - "public.enforce_job_completion_photo_requirement"
Cohesion: 0.19
Nodes (9): jobs_enforce_reopen, public.enforce_job_reopen_permission(), public.forbid_role_delete_if_in_use(), roles_forbid_delete_if_in_use, jobs_enforce_completion_photo, public.enforce_job_completion_photo_requirement(), jobs_enforce_details_edit, public.enforce_job_details_edit_permission() (+1 more)

### Community 48 - "HTML Entry & PWA Shell"
Cohesion: 0.19
Nodes (14): Minimal Pre-paint Reset, PWA Manifest (/manifest.webmanifest), index.html App Entry, SPA Redirect Restore Script, theme-color #142840 (synced with --c-moss-dark), GitHub Pages SPA 404 Fallback, RFID Kiosk Magic-link Redirect (/kiosk), TT Monogram Apple Touch Icon (cream TT on dark green) (+6 more)

### Community 49 - "devDependencies"
Cohesion: 0.10
Nodes (19): devDependencies, supabase@^2.111.0, vite@^5.2.0, vite-plugin-pwa@^0.20.5, @vitejs/plugin-react@^4.2.1, workbox-core@^7.3.0, workbox-precaching@^7.3.0, workbox-routing@^7.3.0 (+11 more)

### Community 50 - "RLS Helper Functions"
Cohesion: 0.15
Nodes (4): admin_access_log, is_platform_admin(), job_is_assigned_to_me(), platform_admins table

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
Cohesion: 0.43
Nodes (7): getCurrentCompetencies(), saveCompetencies(), MachineCompetenciesTab(), competenciesFor(), handleSave(), openPerson(), refresh()

### Community 57 - "Equipment Doc Reminders Fn"
Cohesion: 0.22
Nodes (4): officeGroupEmails(), officeGroupId(), resend, supabase

### Community 58 - "public.profiles"
Cohesion: 0.06
Nodes (48): job_activity_forbid_delete, job_activity_job_idx, jobs_assignee_group_idx, jobs_assignee_profile_idx, jobs_org_site_idx, jobs_status_idx, notifications_recipient_idx, public.admin_access_log (+40 more)

### Community 59 - "Input"
Cohesion: 0.11
Nodes (21): KeyStationHandover(), getHolidaySettings(), upsertHolidaySettings(), useKeyHandover(), backToSelect(), refresh(), ActivityTypesTab(), handleDelete() (+13 more)

### Community 61 - "Contractor Job Email Fn"
Cohesion: 0.22
Nodes (3): corsHeaders, resend, supabaseAdmin

### Community 62 - "rfid-login Edge Function"
Cohesion: 0.40
Nodes (5): clear-login-context Edge Function, rfid-login Edge Function, can_access_desktop, rfid_login_attempts table, rfid_tags table

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
Nodes (29): public.freeze_timesheet_week(), public.timesheet_audit_log, public.timesheet_entries, public.timesheet_entries_before_delete(), public.timesheet_entries_before_insert(), public.timesheet_entries_before_update(), public.timesheet_person_order, public.timesheet_weeks (+21 more)

### Community 67 - "UI Redesign Plan"
Cohesion: 0.32
Nodes (8): UI Redesign Plan, Admin Tabs as Real Routes (/admin/:tab), Admiralty Navy Palette, Decisions D1-D6, Five Navigation Idioms Problem, Mobile Bottom Tab Bar, Palette Drift (Field Journal vs Admiralty), Phase 3 - Navigation and Chrome Rebuild

### Community 68 - "Security plan (review of 17 Nov 2026)"
Cohesion: 0.22
Nodes (8): 1. Fob sign-in can be used from anywhere (serious), 2. Bank-holiday helpers callable by any user (medium), 3. Push notices accept anything (lower), 4. Cron functions callable with the public key (low), 5. Housekeeping (low), Doing it, Security plan (review of 17 Nov 2026), What's already in good shape (checked 17 Nov 2026)

### Community 69 - "Priority Is a Solid Colour Bar, Never an Icon"
Cohesion: 0.40
Nodes (3): Overdue Pill, Phase 5 - Polish, Redesign Constraints (must not break)

### Community 71 - "IconButton"
Cohesion: 0.12
Nodes (21): PhotoThumb(), CommonFaultDescriptionsTab(), addFault(), moveFault(), refreshFaults(), removeFault(), RolesPermissionsTab(), addRole() (+13 more)

### Community 72 - "Build Brief"
Cohesion: 0.10
Nodes (20): Build Brief, Branding overrides, CSV export with export_logs, Supabase backend, Tree Tops Caravan Park Ltd, Tree Tops seed data, treetops-maintenance.jsx prototype, handleEnablePush() (+12 more)

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

### Community 78 - "GitHub Pages deploy pipeline"
Cohesion: 0.29
Nodes (5): GitHub Pages deploy pipeline, index.html, public/404.html, GitHub Pages hosting, Tech stack

### Community 114 - "Admiralty visual direction"
Cohesion: 0.20
Nodes (6): Admiralty visual direction, Field Journal palette, Typography (Lora, Work Sans, IBM Plex Mono), src/kiosk/kioskTheme.js, Field Journal design system, ActionGrid / ActionList (unified hub pages)

### Community 115 - "seed-users.mjs"
Cohesion: 0.29
Nodes (4): @supabase/supabase-js@^2.45.4, @supabase/supabase-js, SEED_USERS, supabase

### Community 117 - "Admin.jsx"
Cohesion: 0.10
Nodes (21): Admin(), ALL_TABS, GROUPS, JobAssignmentTab(), refresh(), toggle(), JobTemplatesTab(), handleDelete() (+13 more)

### Community 119 - "src/ui components"
Cohesion: 0.25
Nodes (6): src/ui components, Empty-State Sweep, Permission Matrix Sticky Column / Card View, Phase 2 - UI Primitives, Phase 4 - Screen-by-Screen Pass, /ui-gallery Dev Route

### Community 121 - "key_tags table"
Cohesion: 0.29
Nodes (8): admin_force_check_in_key, log_key_tag_event, key_checkouts table, key_special_locations table, key_tag_events table, key_tags table, can_manage_keys, pitches table

### Community 125 - "Timesheet.jsx"
Cohesion: 0.23
Nodes (10): DayRow(), KioskTimesheet(), WeekNote(), AddCorrectionForm(), CardTitle(), DayRow(), Timesheet(), WeekNote() (+2 more)

## Ambiguous Edges - Review These
- `GitHub Pages deploy pipeline` → `Pro plan + Micro compute`  [AMBIGUOUS]
  RUNBOOK.md · relation: conceptually_related_to

## Knowledge Gaps
- **54 isolated node(s):** `StaffTimeProfilesTab`, `theme.js Rewritten to Read Tokens (hinge)`, `Typography (Lora, Work Sans, IBM Plex Mono)`, `Empty-State Sweep`, `Permission Matrix Sticky Column / Card View` (+49 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 508 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **39 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Runbook` connect `Runbook` to `Build Brief`, `role_visibility`, `manage-users Edge Function`, `seed-users.mjs`, `rfid-login Edge Function`?**
  _High betweenness centrality (0.201) - this node is a cross-community bridge._
- **What connects `StaffTimeProfilesTab`, `theme.js Rewritten to Read Tokens (hinge)`, `Typography (Lora, Work Sans, IBM Plex Mono)` to the rest of the system?**
  _54 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PageHeader` be split into smaller, more focused modules?**
  _Cohesion score 0.08879551820728292 - nodes in this community are weakly interconnected._
- **Why does `SQL run order` connect `role_visibility` to `Runbook`, `public.profiles`?**
  _High betweenness centrality (0.189) - this node is a cross-community bridge._
- **Should `App Shell & Routing` be split into smaller, more focused modules?**
  _Cohesion score 0.11841491841491841 - nodes in this community are weakly interconnected._
- **Why does `public.profiles` connect `public.profiles` to `public.profiles`, `public.timesheet_entries`, `Equipment Types & Competencies Schema`, `public.equipment`, `public.key_checkouts`, `public.jobs`, `Supabase Consolidation & Roles`, `public.enforce_job_completion_photo_requirement`, `Holiday Accrual Schema`, `Pitches, Meters & Key Tags Schema`, `public.equipment`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `GitHub Pages deploy pipeline` and `Pro plan + Micro compute`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
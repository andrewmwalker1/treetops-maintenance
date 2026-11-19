# Graph Report - treetops-maintenance  (2026-11-19)

## Corpus Check
- 298 files · ~234,486 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: .css 4, (none) 3, .example 1)

## Summary
- 2124 nodes · 6981 edges · 123 communities (84 shown, 39 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 190 edges (avg confidence: 0.85)
- Token cost: 401,249 input · 0 output

## Graph Freshness
- Built from commit: `dd91c66b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PageHeader
- App Shell & Routing
- holidayQueries.js
- License Agreement Calculations
- OfficeHub.jsx
- KeyStationMenu.jsx
- Select
- TimesheetsGrid.jsx
- Ponytail Skills & Sage Tool
- EmptyState
- JobDetail.jsx
- public.jobs
- Job Detail Page
- Data model
- Supabase Consolidation & Roles
- jobs table
- deploy.yml
- Search Picker & Key Tags Admin
- profiles table
- App.jsx
- csvExport.js
- Holiday Accrual Schema
- Pitches, Meters & Key Tags Schema
- EquipmentCheckoutLogTab.jsx
- Jobs List & Printing
- Meter Scanning & Cache
- Runbook
- Runtime Dependencies
- Assignee Picker & Templates
- public.report_equipment_fault
- equipmentAvailability.js
- NewJob
- JobDetail.jsx
- Card
- public.profiles
- steps
- License Agreement Settings
- Equipment Types & Competencies Schema
- deploy
- public.equipment
- vite.config.js
- Equipment Documents
- public.key_checkouts
- Layout.jsx
- ContractorDocumentsModal.jsx
- role_visibility
- Customer Onboarding Script
- ServiceTemplatesTab
- HTML Entry & PWA Shell
- Dev Dependencies & Workbox
- RLS Helper Functions
- check-styles.mjs
- Push Notification Functions
- Meter CSV Import
- main.jsx
- PhotoThumb
- Machine Competencies
- Equipment Doc Reminders Fn
- public.profiles
- Input
- Contractor Doc Reminders Fn
- Contractor Job Email Fn
- newJobReferenceData.js
- Manage Users Fn
- Scheduled Jobs Generator Fn
- Meter CSV Export
- public.timesheet_entries
- UI Redesign Plan
- Security plan (review of 17 Nov 2026)
- AuthProvider
- with
- RolesPermissionsTab
- Build Brief
- main.jsx
- Terminal Session Fn
- RFID Login Fn
- npm Scripts
- public.role_key_reasons
- System Specification
- Migration src/components/KeyReasonsModal.jsx
- Admiralty visual direction
- seed-users.mjs
- JobTemplatesTab
- src/ui components
- key_tags table
- useKeyForceCheckIn
- Textarea

## God Nodes (most connected - your core abstractions)
1. `Button` - 187 edges
2. `PageHeader()` - 170 edges
3. `Card` - 169 edges
4. `Alert()` - 152 edges
5. `useAuth()` - 141 edges
6. `EmptyState()` - 112 edges
7. `Input` - 109 edges
8. `react` - 104 edges
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

## Communities (123 total, 39 thin omitted)

### Community 0 - "PageHeader"
Cohesion: 0.10
Nodes (42): react, AssigneePicker(), DocumentPicker(), searchStyle, typeLabel, AuthContext, useAuth(), getCompetentTypeIds() (+34 more)

### Community 1 - "App Shell & Routing"
Cohesion: 0.12
Nodes (41): react-router-dom, formatKeyLocation(), KeySelector(), locationLabel(), KeyStationActivityLog(), KeyStationApp(), KeyStationCheckIn(), KeyStationCheckOut() (+33 more)

### Community 2 - "holidayQueries.js"
Cohesion: 0.07
Nodes (64): addBankHoliday(), addBankHolidayOverride(), approveHolidayRequest(), declineHolidayRequest(), deleteBankHoliday(), getBankHolidayOverrides(), getBankHolidays(), getHolidaySettings() (+56 more)

### Community 3 - "License Agreement Calculations"
Cohesion: 0.06
Nodes (70): applyStandardInstructionTokens(), autoCorrectTitlePairing(), buildMergeData(), computeCaravanAmount(), computeMonthsToCharge(), computePitchFeeProrataAmount(), DEFAULT_AREA_SEASON_MAP, derivePeopleFromRow() (+62 more)

### Community 4 - "OfficeHub.jsx"
Cohesion: 0.10
Nodes (25): Office Hub tile palette, countMachinesCheckedOut(), TILE_COLORS, TILE_ICONS, tileColorValue(), ApprovalsInbox, BrowseList(), BrowseTab() (+17 more)

### Community 5 - "KeyStationMenu.jsx"
Cohesion: 0.23
Nodes (16): RfidScanListener(), dialArcPath(), polarPoint(), StatDial(), KeyStationMenu(), queryEquipmentSignals(), KEY_GROUPS, keyIssuedToLabel() (+8 more)

### Community 6 - "Select"
Cohesion: 0.08
Nodes (31): queryKeyCheckouts(), queryTimesheetAuditLog(), JobAssignmentTab(), refresh(), toggle(), formatDateTime(), issuedToLabel(), KeyActivityLogTab() (+23 more)

### Community 7 - "TimesheetsGrid.jsx"
Cohesion: 0.07
Nodes (61): getFixedHoursProfiles(), freezeWeek(), getRecentDailyEntries(), getSubmittableProfiles(), getWeekEntries(), getWeekEntriesForProfiles(), getWeekFreezeStatus(), getWeekNote() (+53 more)

### Community 8 - "Ponytail Skills & Sage Tool"
Cohesion: 0.07
Nodes (44): Ponytail Audit Skill, Ponytail Debt Ledger, Ponytail Debt Skill, Benchmark Median Scoreboard, Ponytail Gain Skill, Default Mode Config (PONYTAIL_DEFAULT_MODE / config.json), Ponytail Help Skill, Finding Tags (delete/stdlib/native/yagni/shrink) (+36 more)

### Community 9 - "EmptyState"
Cohesion: 0.19
Nodes (23): EquipmentLabel(), equipmentMakeModel(), buttonVariants, SafetyDocumentLink(), KioskApp(), KioskCheckIn(), KioskCheckOut(), KioskSafety() (+15 more)

### Community 10 - "JobDetail.jsx"
Cohesion: 0.13
Nodes (41): KioskMenu(), MobileNav(), MeterReadingHome(), DEMO_ACTIVITY_TYPES, Gallery(), Row(), SIDEBAR_SPECIMEN_LINKS, SidebarSpecimen() (+33 more)

### Community 11 - "public.jobs"
Cohesion: 0.08
Nodes (27): public.job_photos, public.job_subtasks, public.jobs, public.delete_job(), jobs_assignee_contractor_idx, public.can_see_job(), job_subtasks_enforce_photo_requirement, job_subtasks_enforce_requires_photo_permission (+19 more)

### Community 12 - "Job Detail Page"
Cohesion: 0.06
Nodes (32): handleReportFault(), assigneeName(), JobDetail(), allSectionNames(), changeSubtaskSection(), checklistAsTemplateSchema(), confirmComplete(), editSubtaskLabelLocal() (+24 more)

### Community 13 - "Data model"
Cohesion: 0.16
Nodes (25): activity_type_documents table, common_fault_descriptions table, contractor_documents table, contractor_reasons table, contractors table, Data model, equipment table, equipment_checkouts table (+17 more)

### Community 14 - "Supabase Consolidation & Roles"
Cohesion: 0.06
Nodes (32): public.custom_access_token_hook(), public.terminal_sessions, Supabase Consolidation Plan, Accept-Profile / Content-Profile Headers, Auth Hooks Are Project-Wide, Auth Identity / UID Reconciliation, AZURE-SQL-MIGRATION-PLAN.md, Cloud Session Egress Block to Supabase (+24 more)

### Community 15 - "jobs table"
Cohesion: 0.10
Nodes (37): admin_force_check_in, can_see_job(), delete_job, enforce_checklist_item_photo_requirement, enforce_checklist_requires_photo_permission, enforce_job_completion_photo_requirement, enforce_job_reallocation_permission, enforce_job_reopen_permission (+29 more)

### Community 16 - "deploy.yml"
Cohesion: 0.15
Nodes (12): concurrency, cancel-in-progress, group, name, on, push, workflow_dispatch, permissions (+4 more)

### Community 17 - "Search Picker & Key Tags Admin"
Cohesion: 0.08
Nodes (32): highlightMatch(), SearchPicker(), handleKeyDown(), selectItem(), highlightMatch(), KeyTagsTab(), handleAddLocation(), handleAssign() (+24 more)

### Community 18 - "profiles table"
Cohesion: 0.17
Nodes (14): manage-users Edge Function, areas table, export_logs table, forbid_role_delete_if_in_use, has_site_scope(), list_org_users, organisations table, can_manage_users (+6 more)

### Community 19 - "App.jsx"
Cohesion: 0.10
Nodes (21): App(), AppShell(), DownloadMeters, Gallery, LazyRoute(), MeterLabels, MeterProgress, MeterSettings (+13 more)

### Community 20 - "csvExport.js"
Cohesion: 0.24
Nodes (11): CSV export with export_logs, downloadCsv(), exportJobsCsv(), exportSelectedJobsCsv(), JOBS_CSV_COLUMNS, jobsToCsvRows(), toCsvValue(), queryJobs() (+3 more)

### Community 21 - "Holiday Accrual Schema"
Cohesion: 0.10
Nodes (22): holiday_bank_holiday_overrides_sync, holiday_bank_holidays_after_insert, public.apply_bank_holiday_for_profile(), public.approve_holiday_request(), public.decline_holiday_request(), public.holiday_accrual_ratio(), public.holiday_bank_holiday_overrides, public.holiday_bank_holidays (+14 more)

### Community 22 - "Pitches, Meters & Key Tags Schema"
Cohesion: 0.12
Nodes (26): public.pitches, public.sites, key_tag_events_key_tag_idx, key_tags_log_event, key_tags_pitch_idx, key_tags_special_location_idx, public.key_special_locations, public.key_tag_events (+18 more)

### Community 23 - "EquipmentCheckoutLogTab.jsx"
Cohesion: 0.23
Nodes (8): checklistVersionSavedLine(), ChecklistVersionView(), exportEquipmentCheckoutsCsv(), EquipmentCheckoutLogTab(), handleExport(), EVENT_TYPE, formatDateTime(), STATUS_CHIPS

### Community 24 - "Jobs List & Printing"
Cohesion: 0.13
Nodes (22): PrintableJobsChecklist(), tdStyle, thStyle, openJob(), loadJobForPrint(), openPrintWindow(), writeAndPrintJobBundles(), writeAndPrintJobsChecklist() (+14 more)

### Community 25 - "Meter Scanning & Cache"
Cohesion: 0.16
Nodes (25): ScanMeter, getCurrentLocation(), fetchActiveMeters(), fetchOutstandingMeters(), fetchProgress(), findTodaysReadingForMeter(), refreshMetersCache(), resolveMeterByQrCode() (+17 more)

### Community 26 - "Runbook"
Cohesion: 0.08
Nodes (29): graphify skill instructions, graphify, Claude Code Instructions, Shared Supabase project ozhwgrzlpvfdemmogmav, SUPABASE-CONSOLIDATION-PLAN.md, Runbook, Deleted project qkbpsqlrzygcairtidye, .env client variables (+21 more)

### Community 27 - "Runtime Dependencies"
Cohesion: 0.10
Nodes (27): dependencies, @dnd-kit/core@^6.3.1, @dnd-kit/sortable@^10.0.0, @dnd-kit/utilities@^3.2.2, docxtemplater@^3.69.3, html5-qrcode@^2.3.8, pizzip@^3.2.0, qrcode@^1.5.4 (+19 more)

### Community 28 - "Assignee Picker & Templates"
Cohesion: 0.18
Nodes (15): assigneeKindAndIdFromRow(), assigneeLabel(), fieldStyle, getChecklistVersionsForType(), EquipmentTypesTab(), editType(), handleDelete(), handleSave() (+7 more)

### Community 29 - "public.report_equipment_fault"
Cohesion: 0.09
Nodes (24): public.job_statuses, jobs_enforce_reopen, public.enforce_job_reopen_permission(), public.forbid_role_delete_if_in_use(), roles_forbid_delete_if_in_use, jobs_enforce_completion_photo, public.enforce_job_completion_photo_requirement(), jobs_enforce_details_edit (+16 more)

### Community 30 - "equipmentAvailability.js"
Cohesion: 0.32
Nodes (9): getChecklistVersionsByIds(), getLatestChecklistVersions(), getEquipmentTypeAvailabilityCounts(), applyCommonFilters(), queryCheckoutEvents(), queryEquipmentHistory(), queryFaultEvents(), queryRepairEvents() (+1 more)

### Community 31 - "NewJob"
Cohesion: 0.10
Nodes (12): ActivityTypePicker(), ChecklistBuilder(), NewJob(), goToStep(), handleContinueFromWhat(), handleSubmit(), uploadPhotoForJob(), IconCamera() (+4 more)

### Community 32 - "JobDetail.jsx"
Cohesion: 0.07
Nodes (38): JobCard(), handleEnablePush(), JobRow(), resolveLinkedEquipment(), writeJobCompletion(), formatDueDate(), notifyJobAssigned(), resolveAssigneeRecipientIds() (+30 more)

### Community 33 - "Card"
Cohesion: 0.11
Nodes (17): ActivityTypesTab(), handleDelete(), handleSave(), refresh(), daysUntil(), DocumentRow(), formatDate(), RfidTagsTab() (+9 more)

### Community 34 - "public.profiles"
Cohesion: 0.08
Nodes (30): public.job_types, public.organisations, public.schedules, public.task_types, public.training_videos, job_subtasks_enforce_edit, public.activity_type_documents, public.can_see_document() (+22 more)

### Community 35 - "steps"
Cohesion: 0.20
Nodes (11): steps, steps, CHECK_STYLES_BASE, VITE_SUPABASE_ANON_KEY, VITE_SUPABASE_URL, VITE_VAPID_PUBLIC_KEY, env, id (+3 more)

### Community 36 - "License Agreement Settings"
Cohesion: 0.14
Nodes (14): LicenseAgreementSettingsTab(), handlePitchFeesUpload(), handleTemplateUpload(), refresh(), validateXmlBrowser(), parseMoneyString(), parsePitchBandsCsv(), assertCount() (+6 more)

### Community 37 - "Equipment Types & Competencies Schema"
Cohesion: 0.15
Nodes (13): public.equipment_types, equipment_checkouts_set_checklist_version, equipment_types_record_checklist_version, public.equipment_type_checklist_versions, public.record_equipment_checklist_version(), public.set_equipment_checkout_checklist_version(), equipment_checkouts_set_competency_warning, profile_machine_competencies_current_unique (+5 more)

### Community 38 - "deploy"
Cohesion: 0.22
Nodes (9): runs-on, environment, needs, runs-on, name, url, jobs, build (+1 more)

### Community 39 - "public.equipment"
Cohesion: 0.11
Nodes (26): public.equipment, public.equipment_checks, common_fault_descriptions_type_idx, equipment_checkouts_enforce_immutable, equipment_checkouts_equipment_idx, equipment_checkouts_open_unique, equipment_checkouts_profile_idx, public.admin_force_check_in() (+18 more)

### Community 40 - "vite.config.js"
Cohesion: 0.22
Nodes (7): vite@^5.2.0, vite-plugin-pwa@^0.20.5, @vitejs/plugin-react@^4.2.1, vite, vite-plugin-pwa, @vitejs/plugin-react, { version }

### Community 41 - "Equipment Documents"
Cohesion: 0.20
Nodes (13): EquipmentDocumentsModal(), handleAdd(), handleDelete(), refresh(), EquipmentTab(), handleDecommission(), handleForceCheckIn(), handleSave() (+5 more)

### Community 42 - "public.key_checkouts"
Cohesion: 0.20
Nodes (16): public.contractors, contractor_documents_contractor_idx, contractor_documents_pending_reminder_idx, contractor_documents_reset_reminder, public.can_manage_contractor_document(), public.contractor_documents, public.reset_contractor_document_reminder(), contractor_reasons_contractor_idx (+8 more)

### Community 43 - "Layout.jsx"
Cohesion: 0.08
Nodes (42): AccountMenu(), handleLayoutToggle(), initials(), Layout(), handleDndToggle(), handleOnline(), refreshStatus(), readSidebarCollapsed() (+34 more)

### Community 44 - "ContractorDocumentsModal.jsx"
Cohesion: 0.17
Nodes (16): ContractorDocumentsModal(), handleAdd(), handleDelete(), refresh(), daysUntil(), DocumentRow(), formatDate(), ContractorsTab() (+8 more)

### Community 45 - "role_visibility"
Cohesion: 0.10
Nodes (16): admin_access_log, Backup/DR tier, equipment_type_repair_assignees fallback, inviteUserByEmail auth flow, Open questions, Organisation boundary, role_visibility, Andy (+8 more)

### Community 46 - "Customer Onboarding Script"
Cohesion: 0.17
Nodes (11): papaparse@^5.7.0, papaparse, __dirname, escapeSqlLiteral(), listSqlFilesInOrder(), main(), prompt(), promptList() (+3 more)

### Community 47 - "ServiceTemplatesTab"
Cohesion: 0.31
Nodes (7): blankTier(), ServiceTemplatesTab(), addTier(), handleDelete(), handleSave(), newTemplate(), refresh()

### Community 48 - "HTML Entry & PWA Shell"
Cohesion: 0.19
Nodes (14): Minimal Pre-paint Reset, PWA Manifest (/manifest.webmanifest), index.html App Entry, SPA Redirect Restore Script, theme-color #142840 (synced with --c-moss-dark), GitHub Pages SPA 404 Fallback, RFID Kiosk Magic-link Redirect (/kiosk), TT Monogram Apple Touch Icon (cream TT on dark green) (+6 more)

### Community 49 - "Dev Dependencies & Workbox"
Cohesion: 0.16
Nodes (13): devDependencies, pg@^8.13.1, supabase@^2.111.0, workbox-core@^7.3.0, workbox-precaching@^7.3.0, workbox-routing@^7.3.0, workbox-strategies@^7.3.0, pg (+5 more)

### Community 50 - "RLS Helper Functions"
Cohesion: 0.14
Nodes (7): has_permission(), is_in_group(), job_is_assigned_to_me(), group_members table, groups table, permissions table, role_permissions table

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

### Community 55 - "PhotoThumb"
Cohesion: 0.20
Nodes (12): PhotoThumb(), PrintableJobCard(), PrintRow(), printSectionHeading, SignOffField(), KioskJobs(), handleAddPhoto(), handleComplete() (+4 more)

### Community 56 - "Machine Competencies"
Cohesion: 0.43
Nodes (7): getCurrentCompetencies(), saveCompetencies(), MachineCompetenciesTab(), competenciesFor(), handleSave(), openPerson(), refresh()

### Community 57 - "Equipment Doc Reminders Fn"
Cohesion: 0.22
Nodes (4): officeGroupEmails(), officeGroupId(), resend, supabase

### Community 58 - "public.profiles"
Cohesion: 0.06
Nodes (47): job_activity_forbid_delete, job_activity_job_idx, jobs_assignee_group_idx, jobs_assignee_profile_idx, jobs_org_site_idx, jobs_status_idx, notifications_recipient_idx, public.admin_access_log (+39 more)

### Community 59 - "Input"
Cohesion: 0.07
Nodes (27): GroupsTab(), handleDelete(), handleSave(), refresh(), HolidaySettingsTab(), MONTH_NAMES, HolidaySettingsTab, StaffTimeProfilesTab (+19 more)

### Community 61 - "Contractor Job Email Fn"
Cohesion: 0.22
Nodes (3): corsHeaders, resend, supabaseAdmin

### Community 62 - "newJobReferenceData.js"
Cohesion: 0.52
Nodes (5): getAssignableTargets(), cacheKey(), fetchFresh(), loadNewJobReferenceData(), readCache()

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
Cohesion: 0.12
Nodes (22): public.freeze_timesheet_week(), public.timesheet_audit_log, public.timesheet_entries, public.timesheet_entries_before_delete(), public.timesheet_entries_before_insert(), public.timesheet_entries_before_update(), public.timesheet_person_order, public.timesheet_weeks (+14 more)

### Community 67 - "UI Redesign Plan"
Cohesion: 0.16
Nodes (12): UI Redesign Plan, ActionGrid / ActionList (unified hub pages), Admin Tabs as Real Routes (/admin/:tab), Admiralty Navy Palette, Decisions D1-D6, Five Navigation Idioms Problem, Mobile Bottom Tab Bar, Overdue Pill (+4 more)

### Community 68 - "Security plan (review of 17 Nov 2026)"
Cohesion: 0.22
Nodes (8): 1. Fob sign-in can be used from anywhere (serious), 2. Bank-holiday helpers callable by any user (medium), 3. Push notices accept anything (lower), 4. Cron functions callable with the public key (low), 5. Housekeeping (low), Doing it, Security plan (review of 17 Nov 2026), What's already in good shape (checked 17 Nov 2026)

### Community 69 - "AuthProvider"
Cohesion: 0.29
Nodes (6): AuthProvider(), consumePendingTerminalLogin(), loadOfflineProfileCache(), loadStoredViewingAs(), saveOfflineProfileCache(), storedSessionWhileOffline()

### Community 70 - "with"
Cohesion: 0.40
Nodes (5): with, cache, fetch-depth, node-version, path

### Community 71 - "RolesPermissionsTab"
Cohesion: 0.48
Nodes (6): RolesPermissionsTab(), addRole(), deleteRole(), refresh(), saveRename(), toggle()

### Community 72 - "Build Brief"
Cohesion: 0.08
Nodes (18): Build Brief, Aeroplane mode offline test, Branding overrides, Data model, Job lifecycle logic, Reallocation, RRULE, Scheduling Edge Function (+10 more)

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

### Community 78 - "System Specification"
Cohesion: 0.15
Nodes (9): GitHub Pages deploy pipeline, index.html, public/404.html, pg_stat_activity diagnostic, System Specification, GitHub Pages hosting, Key station, Kiosk mode (+1 more)

### Community 114 - "Admiralty visual direction"
Cohesion: 0.22
Nodes (5): Admiralty visual direction, Field Journal palette, Typography (Lora, Work Sans, IBM Plex Mono), src/kiosk/kioskTheme.js, Field Journal design system

### Community 115 - "seed-users.mjs"
Cohesion: 0.29
Nodes (4): @supabase/supabase-js@^2.45.4, @supabase/supabase-js, SEED_USERS, supabase

### Community 117 - "JobTemplatesTab"
Cohesion: 0.47
Nodes (4): JobTemplatesTab(), handleDelete(), handleSave(), refresh()

### Community 119 - "src/ui components"
Cohesion: 0.25
Nodes (6): src/ui components, Empty-State Sweep, Permission Matrix Sticky Column / Card View, Phase 2 - UI Primitives, Phase 4 - Screen-by-Screen Pass, /ui-gallery Dev Route

### Community 121 - "key_tags table"
Cohesion: 0.29
Nodes (8): admin_force_check_in_key, log_key_tag_event, key_checkouts table, key_special_locations table, key_tag_events table, key_tags table, can_manage_keys, pitches table

### Community 122 - "useKeyForceCheckIn"
Cohesion: 0.50
Nodes (3): useKeyForceCheckIn(), backToSelect(), refresh()

### Community 125 - "Textarea"
Cohesion: 0.31
Nodes (8): DayRow(), KioskTimesheet(), WeekNote(), SafetyLibraryTab(), handleDelete(), handleSave(), refresh(), Textarea

## Ambiguous Edges - Review These
- `GitHub Pages deploy pipeline` → `Pro plan + Micro compute`  [AMBIGUOUS]
  RUNBOOK.md · relation: conceptually_related_to

## Knowledge Gaps
- **53 isolated node(s):** `theme.js Rewritten to Read Tokens (hinge)`, `Typography (Lora, Work Sans, IBM Plex Mono)`, `Empty-State Sweep`, `Permission Matrix Sticky Column / Card View`, `/ui-gallery Dev Route` (+48 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 496 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **39 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Runbook` connect `Runbook` to `Build Brief`, `role_visibility`, `System Specification`, `profiles table`, `seed-users.mjs`?**
  _High betweenness centrality (0.170) - this node is a cross-community bridge._
- **What connects `theme.js Rewritten to Read Tokens (hinge)`, `Typography (Lora, Work Sans, IBM Plex Mono)`, `Empty-State Sweep` to the rest of the system?**
  _53 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PageHeader` be split into smaller, more focused modules?**
  _Cohesion score 0.09603440038222646 - nodes in this community are weakly interconnected._
- **Why does `SQL run order` connect `role_visibility` to `Runbook`, `public.profiles`?**
  _High betweenness centrality (0.161) - this node is a cross-community bridge._
- **Should `App Shell & Routing` be split into smaller, more focused modules?**
  _Cohesion score 0.12128325508607199 - nodes in this community are weakly interconnected._
- **Why does `public.profiles` connect `public.profiles` to `public.profiles`, `public.timesheet_entries`, `Equipment Types & Competencies Schema`, `public.equipment`, `public.key_checkouts`, `public.jobs`, `Supabase Consolidation & Roles`, `Holiday Accrual Schema`, `Pitches, Meters & Key Tags Schema`, `public.report_equipment_fault`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `GitHub Pages deploy pipeline` and `Pro plan + Micro compute`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
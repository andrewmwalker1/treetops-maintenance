# Graph Report - treetops-maintenance  (2026-11-18)

## Corpus Check
- 295 files · ~232,977 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: .css 4, (none) 3, .example 1)

## Summary
- 2117 nodes · 6938 edges · 117 communities (80 shown, 37 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 190 edges (avg confidence: 0.85)
- Token cost: 401,249 input · 0 output

## Graph Freshness
- Built from commit: `38b03101`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Shared Components & Auth Context
- App Shell & Routing
- Holidays & Bank Holidays
- License Agreement Calculations
- OfficeHub.jsx
- icons.jsx
- EquipmentDetail.jsx
- Staff Timesheets UI
- Ponytail Skills & Sage Tool
- EmptyState
- public.jobs
- 01-schema.sql
- Job Detail Page
- Data Model Spec
- Supabase Consolidation & Roles
- Job Lifecycle Triggers Spec
- Deploy Workflow
- Search Picker & Key Tags Admin
- KeyStationMenu.jsx
- App.jsx
- JobDetail.jsx
- Holiday Accrual Schema
- Pitches, Meters & Key Tags Schema
- syncQueue.js
- Jobs List & Printing
- Meter Scanning & Cache
- Runbook & Secrets
- Runtime Dependencies
- Assignee Picker & Templates
- Job Photos & Subtasks Schema
- public.equipment
- New Job Form
- JobDetail.jsx
- KeyActivityLogTab.jsx
- public.profiles
- Common Faults Admin
- License Agreement Settings
- Equipment Types & Competencies Schema
- public.job_subtasks
- RFID Kiosk Checkout Schema
- SchedulesTab.jsx
- Equipment Documents
- Contractors Schema
- Layout.jsx
- Modal
- Build Brief Core Rules
- Customer Onboarding Script
- newJobReferenceData.js
- HTML Entry & PWA Shell
- Dev Dependencies & Workbox
- RLS Helper Functions
- check-styles.mjs
- Push Notification Functions
- Meter CSV Import
- Visual Direction & Tokens
- Build & Versioning
- Machine Competencies
- Equipment Doc Reminders Fn
- 02-rls-policies.sql
- Users Admin
- Contractor Doc Reminders Fn
- Contractor Job Email Fn
- public.sites
- Manage Users Fn
- Scheduled Jobs Generator Fn
- Meter CSV Export
- public.equipment_type_repair_assignees
- UI Redesign Plan
- Security plan (review of 17 Nov 2026)
- Seed Users Script
- Groups Admin
- Roles & Permissions Admin
- public.equipment_documents
- Job Templates Admin
- Terminal Session Fn
- RFID Login Fn
- npm Scripts
- Key Force Check-in
- useKeyCheckout
- Migration src/components/KeyReasonsModal.jsx
- RfidTagsTab
- SafetyLibraryTab

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

## Communities (117 total, 37 thin omitted)

### Community 0 - "Shared Components & Auth Context"
Cohesion: 0.08
Nodes (48): react, searchStyle, typeLabel, useViewAsCandidates(), ViewAsBanner(), AuthContext, useAuth(), getLatestChecklistVersions() (+40 more)

### Community 1 - "App Shell & Routing"
Cohesion: 0.13
Nodes (45): react-router-dom, formatKeyLocation(), KeySelector(), locationLabel(), KeyStationActivityLog(), KeyStationApp(), KeyStationCheckIn(), KeyStationCheckOut() (+37 more)

### Community 2 - "Holidays & Bank Holidays"
Cohesion: 0.06
Nodes (72): addBankHoliday(), addBankHolidayOverride(), approveHolidayRequest(), declineHolidayRequest(), deleteBankHoliday(), getBankHolidayOverrides(), getBankHolidays(), getHolidaySettings() (+64 more)

### Community 3 - "License Agreement Calculations"
Cohesion: 0.07
Nodes (65): applyStandardInstructionTokens(), autoCorrectTitlePairing(), buildMergeData(), computeCaravanAmount(), computeMonthsToCharge(), computePitchFeeProrataAmount(), DEFAULT_AREA_SEASON_MAP, derivePeopleFromRow() (+57 more)

### Community 4 - "OfficeHub.jsx"
Cohesion: 0.12
Nodes (21): queryTimesheetAuditLog(), ApprovalsInbox, BrowseList(), BrowseTab(), categoryName(), DirectoriesPanel(), LicenseAgreement, loadHubData() (+13 more)

### Community 5 - "icons.jsx"
Cohesion: 0.21
Nodes (17): MobileNav(), IconAlert(), IconCamera(), IconCheck(), IconChevronDown(), IconEdit(), IconFilter(), IconFolder() (+9 more)

### Community 6 - "EquipmentDetail.jsx"
Cohesion: 0.12
Nodes (15): notifyJobAssigned(), handleReportIssue(), handleReportIssue(), ariaSort(), EquipmentDetail(), handleReportFault(), formatDateTime(), HISTORY_STATUS (+7 more)

### Community 7 - "Staff Timesheets UI"
Cohesion: 0.13
Nodes (44): getFixedHoursProfiles(), freezeWeek(), getRecentDailyEntries(), getSubmittableProfiles(), getWeekEntries(), getWeekEntriesForProfiles(), getWeekFreezeStatus(), getWeekNote() (+36 more)

### Community 8 - "Ponytail Skills & Sage Tool"
Cohesion: 0.07
Nodes (44): Ponytail Audit Skill, Ponytail Debt Ledger, Ponytail Debt Skill, Benchmark Median Scoreboard, Ponytail Gain Skill, Default Mode Config (PONYTAIL_DEFAULT_MODE / config.json), Ponytail Help Skill, Finding Tags (delete/stdlib/native/yagni/shrink) (+36 more)

### Community 9 - "EmptyState"
Cohesion: 0.13
Nodes (32): EquipmentLabel(), equipmentMakeModel(), buttonVariants, SafetyDocumentLink(), KioskApp(), KioskCheckIn(), KioskCheckOut(), KioskSafety() (+24 more)

### Community 10 - "public.jobs"
Cohesion: 0.11
Nodes (17): public.jobs, public.delete_job(), jobs_assignee_contractor_idx, public.can_see_job(), jobs_enforce_requires_photo_permission, public.enforce_job_requires_photo_permission(), public.can_see_job(), public.can_see_job() (+9 more)

### Community 11 - "01-schema.sql"
Cohesion: 0.09
Nodes (26): job_activity_forbid_delete, job_activity_job_idx, jobs_assignee_group_idx, jobs_assignee_profile_idx, jobs_org_site_idx, jobs_status_idx, notifications_recipient_idx, public.areas (+18 more)

### Community 12 - "Job Detail Page"
Cohesion: 0.06
Nodes (35): handleAddPhoto(), assigneeName(), buildDefaultContractorEmailBody(), JobDetail(), allSectionNames(), changeSubtaskSection(), checklistAsTemplateSchema(), confirmComplete() (+27 more)

### Community 13 - "Data Model Spec"
Cohesion: 0.09
Nodes (44): manage-users Edge Function, activity_type_documents table, areas table, common_fault_descriptions table, Data model, equipment table, equipment_checkouts table, equipment_checks table (+36 more)

### Community 14 - "Supabase Consolidation & Roles"
Cohesion: 0.06
Nodes (32): public.custom_access_token_hook(), public.terminal_sessions, Supabase Consolidation Plan, Accept-Profile / Content-Profile Headers, Auth Hooks Are Project-Wide, Auth Identity / UID Reconciliation, AZURE-SQL-MIGRATION-PLAN.md, Cloud Session Egress Block to Supabase (+24 more)

### Community 15 - "Job Lifecycle Triggers Spec"
Cohesion: 0.07
Nodes (47): contractor_documents table, contractor_reasons table, contractors table, admin_force_check_in, admin_force_check_in_key, delete_job, enforce_checklist_item_photo_requirement, enforce_checklist_requires_photo_permission (+39 more)

### Community 16 - "Deploy Workflow"
Cohesion: 0.06
Nodes (37): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+29 more)

### Community 17 - "Search Picker & Key Tags Admin"
Cohesion: 0.13
Nodes (23): highlightMatch(), SearchPicker(), handleKeyDown(), selectItem(), highlightMatch(), KeyTagsTab(), handleAddLocation(), handleAssign() (+15 more)

### Community 18 - "KeyStationMenu.jsx"
Cohesion: 0.16
Nodes (21): RfidScanListener(), dialArcPath(), polarPoint(), StatDial(), KeyStationMenu(), KioskSignIn(), exportJobsCsv(), countMachinesCheckedOut() (+13 more)

### Community 19 - "App.jsx"
Cohesion: 0.08
Nodes (25): App(), AppShell(), DownloadMeters, LazyRoute(), MeterLabels, MeterProgress, MeterSettings, KeysGate() (+17 more)

### Community 20 - "JobDetail.jsx"
Cohesion: 0.09
Nodes (25): ChecklistBuilder(), CommonFaultDescriptionsTab(), addFault(), moveFault(), refreshFaults(), removeFault(), sortIndicator(), historySortIndicator() (+17 more)

### Community 21 - "Holiday Accrual Schema"
Cohesion: 0.06
Nodes (42): public.freeze_timesheet_week(), public.timesheet_audit_log, public.timesheet_entries, public.timesheet_entries_before_delete(), public.timesheet_entries_before_insert(), public.timesheet_entries_before_update(), public.timesheet_weeks, public.unfreeze_timesheet_week() (+34 more)

### Community 22 - "Pitches, Meters & Key Tags Schema"
Cohesion: 0.15
Nodes (15): key_tag_events_key_tag_idx, key_tags_log_event, key_tags_pitch_idx, key_tags_special_location_idx, public.key_special_locations, public.key_tag_events, public.key_tags, public.log_key_tag_event() (+7 more)

### Community 23 - "syncQueue.js"
Cohesion: 0.15
Nodes (15): handleOnline(), refreshStatus(), downscaleImage(), flushQueue(), flushReadingQueue(), flushStore(), getQueueStatus(), getReadingQueueStatus() (+7 more)

### Community 24 - "Jobs List & Printing"
Cohesion: 0.11
Nodes (20): PrintableJobsChecklist(), tdStyle, thStyle, openJob(), loadJobForPrint(), openPrintWindow(), writeAndPrintJobBundles(), writeAndPrintJobsChecklist() (+12 more)

### Community 25 - "Meter Scanning & Cache"
Cohesion: 0.15
Nodes (26): ScanMeter, getCurrentLocation(), fetchActiveMeters(), fetchOutstandingMeters(), fetchProgress(), findTodaysReadingForMeter(), refreshMetersCache(), resolveMeterByQrCode() (+18 more)

### Community 26 - "Runbook & Secrets"
Cohesion: 0.08
Nodes (30): Aeroplane mode offline test, Suggested build order, GitHub Pages deploy pipeline, index.html, public/404.html, Runbook, .env client variables, pg_stat_activity diagnostic (+22 more)

### Community 27 - "Runtime Dependencies"
Cohesion: 0.10
Nodes (27): dependencies, @dnd-kit/core@^6.3.1, @dnd-kit/sortable@^10.0.0, @dnd-kit/utilities@^3.2.2, docxtemplater@^3.69.3, html5-qrcode@^2.3.8, pizzip@^3.2.0, qrcode@^1.5.4 (+19 more)

### Community 28 - "Assignee Picker & Templates"
Cohesion: 0.07
Nodes (37): assigneeKindAndIdFromRow(), assigneeLabel(), AssigneePicker(), fieldStyle, checklistVersionSavedLine(), ChecklistVersionView(), DocumentPicker(), getChecklistVersionsByIds() (+29 more)

### Community 29 - "Job Photos & Subtasks Schema"
Cohesion: 0.17
Nodes (11): public.job_photos, jobs_enforce_reopen, public.enforce_job_reopen_permission(), public.forbid_role_delete_if_in_use(), roles_forbid_delete_if_in_use, jobs_enforce_completion_photo, public.enforce_job_completion_photo_requirement(), jobs_enforce_details_edit (+3 more)

### Community 30 - "public.equipment"
Cohesion: 0.18
Nodes (13): public.equipment, public.job_statuses, public.report_equipment_fault(), public.equipment_monitor_events, public.apply_service_template(), public.equipment_service_schedules, public.equipment_service_tier_state, public.generate_due_service_jobs() (+5 more)

### Community 31 - "New Job Form"
Cohesion: 0.17
Nodes (8): ActivityTypePicker(), NewJob(), goToStep(), handleContinueFromWhat(), handleSubmit(), uploadPhotoForJob(), IconPlus(), ModalFooter()

### Community 32 - "JobDetail.jsx"
Cohesion: 0.09
Nodes (35): JobCard(), PhotoThumb(), PrintableJobCard(), PrintRow(), printSectionHeading, SignOffField(), JobRow(), KioskJobs() (+27 more)

### Community 33 - "KeyActivityLogTab.jsx"
Cohesion: 0.36
Nodes (6): queryKeyCheckouts(), formatDateTime(), issuedToLabel(), KeyActivityLogTab(), locationLabel(), STATUS_CHIPS

### Community 34 - "public.profiles"
Cohesion: 0.10
Nodes (26): public.admin_access_log, public.export_logs, public.organisations, public.profiles, public.roles, public.site_scope, public.list_org_users(), public.role_key_reasons (+18 more)

### Community 35 - "Common Faults Admin"
Cohesion: 0.09
Nodes (19): Office Hub tile palette, TILE_COLORS, TILE_ICONS, tileColorValue(), ATTACHMENT_TYPES, blankCategory, blankDoc, blankLink (+11 more)

### Community 36 - "License Agreement Settings"
Cohesion: 0.14
Nodes (14): LicenseAgreementSettingsTab(), handlePitchFeesUpload(), handleTemplateUpload(), refresh(), validateXmlBrowser(), parseMoneyString(), parsePitchBandsCsv(), assertCount() (+6 more)

### Community 37 - "Equipment Types & Competencies Schema"
Cohesion: 0.15
Nodes (13): public.equipment_types, equipment_checkouts_set_checklist_version, equipment_types_record_checklist_version, public.equipment_type_checklist_versions, public.record_equipment_checklist_version(), public.set_equipment_checkout_checklist_version(), equipment_checkouts_set_competency_warning, profile_machine_competencies_current_unique (+5 more)

### Community 38 - "public.job_subtasks"
Cohesion: 0.15
Nodes (14): public.job_subtasks, job_subtasks_enforce_edit, public.activity_type_documents, public.can_see_document(), public.enforce_job_subtask_edit_permission(), public.ra_ms_documents, public.equipment_type_documents, job_subtasks_enforce_photo_requirement (+6 more)

### Community 39 - "RFID Kiosk Checkout Schema"
Cohesion: 0.15
Nodes (19): public.fault_reports, public.repair_records, common_fault_descriptions_type_idx, equipment_checkouts_enforce_immutable, equipment_checkouts_equipment_idx, equipment_checkouts_open_unique, equipment_checkouts_profile_idx, public.admin_force_check_in() (+11 more)

### Community 40 - "SchedulesTab.jsx"
Cohesion: 0.15
Nodes (14): blank, buildRule(), describeRule(), FREQ_BY_NAME, MONTHLY_POSITIONS, NAME_BY_FREQ, parseRule(), SchedulesTab() (+6 more)

### Community 41 - "Equipment Documents"
Cohesion: 0.15
Nodes (16): daysUntil(), DocumentRow(), EquipmentDocumentsModal(), handleAdd(), handleDelete(), refresh(), formatDate(), EquipmentTab() (+8 more)

### Community 42 - "Contractors Schema"
Cohesion: 0.20
Nodes (16): public.contractors, contractor_documents_contractor_idx, contractor_documents_pending_reminder_idx, contractor_documents_reset_reminder, public.can_manage_contractor_document(), public.contractor_documents, public.reset_contractor_document_reminder(), contractor_reasons_contractor_idx (+8 more)

### Community 43 - "Layout.jsx"
Cohesion: 0.09
Nodes (49): Gallery, AccountMenu(), handleLayoutToggle(), initials(), Layout(), handleDndToggle(), handleEnablePush(), readSidebarCollapsed() (+41 more)

### Community 44 - "Modal"
Cohesion: 0.08
Nodes (28): downloadCsv(), exportEquipmentCheckoutsCsv(), exportSelectedJobsCsv(), JOBS_CSV_COLUMNS, jobsToCsvRows(), toCsvValue(), ContractorDocumentsModal(), handleAdd() (+20 more)

### Community 45 - "Build Brief Core Rules"
Cohesion: 0.07
Nodes (26): Build Brief, admin_access_log, Backup/DR tier, Branding overrides, CSV export with export_logs, Data model, equipment_type_repair_assignees fallback, inviteUserByEmail auth flow (+18 more)

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
Cohesion: 0.16
Nodes (13): devDependencies, pg@^8.13.1, supabase@^2.111.0, workbox-core@^7.3.0, workbox-precaching@^7.3.0, workbox-routing@^7.3.0, workbox-strategies@^7.3.0, pg (+5 more)

### Community 50 - "RLS Helper Functions"
Cohesion: 0.22
Nodes (7): can_see_job(), has_permission(), has_site_scope(), is_in_group(), is_platform_admin(), job_is_assigned_to_me(), role_can_see_role()

### Community 51 - "check-styles.mjs"
Cohesion: 0.15
Nodes (17): changedJsxFiles(), endOfOpenTag(), EXCLUDED, findViolations(), git(), lineOf(), main(), resolveBase() (+9 more)

### Community 52 - "Push Notification Functions"
Cohesion: 0.17
Nodes (4): corsHeaders, supabase, corsHeaders, supabase

### Community 53 - "Meter CSV Import"
Cohesion: 0.29
Nodes (13): UploadMeters, csvRowsToImportRows(), fetchDuplicateGroups(), fetchMeterCandidatesForGroup(), importMeterCsvFiles(), parseCsvFile(), resolveDuplicateGroup(), toIsoDate() (+5 more)

### Community 54 - "Visual Direction & Tokens"
Cohesion: 0.07
Nodes (20): graphify skill instructions, graphify, Admiralty visual direction, Field Journal palette, Typography (Lora, Work Sans, IBM Plex Mono), Claude Code Instructions, Shared Supabase project ozhwgrzlpvfdemmogmav, SUPABASE-CONSOLIDATION-PLAN.md (+12 more)

### Community 55 - "Build & Versioning"
Cohesion: 0.22
Nodes (7): vite@^5.2.0, vite-plugin-pwa@^0.20.5, @vitejs/plugin-react@^4.2.1, vite, vite-plugin-pwa, @vitejs/plugin-react, { version }

### Community 56 - "Machine Competencies"
Cohesion: 0.43
Nodes (7): getCurrentCompetencies(), saveCompetencies(), MachineCompetenciesTab(), competenciesFor(), handleSave(), openPerson(), refresh()

### Community 57 - "Equipment Doc Reminders Fn"
Cohesion: 0.22
Nodes (4): officeGroupEmails(), officeGroupId(), resend, supabase

### Community 58 - "02-rls-policies.sql"
Cohesion: 0.13
Nodes (12): SQL run order, public.platform_admins, public.role_visibility, jobs_enforce_reallocation, public.can_see_equipment(), public.can_see_job(), public.current_org_id(), public.current_role_id() (+4 more)

### Community 59 - "Users Admin"
Cohesion: 0.33
Nodes (6): UsersTab(), handleDeactivate(), handleInvite(), handleReactivate(), handleSaveEdit(), refresh()

### Community 61 - "Contractor Job Email Fn"
Cohesion: 0.22
Nodes (3): corsHeaders, resend, supabaseAdmin

### Community 62 - "public.sites"
Cohesion: 0.28
Nodes (14): public.pitches, public.sites, meter_readings_meter_id_idx, meter_readings_pending_export_idx, meters_qr_code_current_key, public.can_see_meter(), public.import_meters(), public.mark_readings_exported() (+6 more)

### Community 63 - "Manage Users Fn"
Cohesion: 0.25
Nodes (3): corsHeaders, resend, supabaseAdmin

### Community 64 - "Scheduled Jobs Generator Fn"
Cohesion: 0.32
Nodes (4): pushToRecipients(), resolveRecipients(), sendDueTodayReminders(), supabase

### Community 65 - "Meter CSV Export"
Cohesion: 0.39
Nodes (7): buildExportRows(), COLUMNS, downloadCsv(), exportMeterReadingsCsvs(), quoted(), toDdMmYyyy(), handleExport()

### Community 66 - "public.equipment_type_repair_assignees"
Cohesion: 0.19
Nodes (11): public.group_members, public.groups, public.is_in_group(), public.can_assign_job(), public.role_assignable_roles, equipment_type_repair_assignees_default_uidx, equipment_type_repair_assignees_type_uidx, fault_reports_job_id_idx (+3 more)

### Community 67 - "UI Redesign Plan"
Cohesion: 0.13
Nodes (15): src/styles/base.css, UI Redesign Plan, Admin Tabs as Real Routes (/admin/:tab), Admiralty Navy Palette, Decisions D1-D6, Five Navigation Idioms Problem, Global :focus-visible Ring, Mobile Bottom Tab Bar (+7 more)

### Community 68 - "Security plan (review of 17 Nov 2026)"
Cohesion: 0.22
Nodes (8): 1. Fob sign-in can be used from anywhere (serious), 2. Bank-holiday helpers callable by any user (medium), 3. Push notices accept anything (lower), 4. Cron functions callable with the public key (low), 5. Housekeeping (low), Doing it, Security plan (review of 17 Nov 2026), What's already in good shape (checked 17 Nov 2026)

### Community 69 - "Seed Users Script"
Cohesion: 0.29
Nodes (4): @supabase/supabase-js@^2.45.4, @supabase/supabase-js, SEED_USERS, supabase

### Community 70 - "Groups Admin"
Cohesion: 0.38
Nodes (4): GroupsTab(), handleDelete(), handleSave(), refresh()

### Community 71 - "Roles & Permissions Admin"
Cohesion: 0.27
Nodes (10): useMediaQuery(), RolesPermissionsTab(), addRole(), deleteRole(), refresh(), saveRename(), toggle(), RoleVisibilityTab() (+2 more)

### Community 72 - "public.equipment_documents"
Cohesion: 0.48
Nodes (6): equipment_documents_equipment_idx, equipment_documents_pending_reminder_idx, equipment_documents_reset_reminder, public.can_manage_equipment_document(), public.equipment_documents, public.reset_equipment_document_reminder()

### Community 73 - "Job Templates Admin"
Cohesion: 0.47
Nodes (4): JobTemplatesTab(), handleDelete(), handleSave(), refresh()

### Community 74 - "Terminal Session Fn"
Cohesion: 0.33
Nodes (3): ALLOWED_CONTEXTS, corsHeaders, supabaseAdmin

### Community 75 - "RFID Login Fn"
Cohesion: 0.33
Nodes (3): ALLOWED_CONTEXTS, corsHeaders, supabaseAdmin

### Community 76 - "npm Scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, onboard, preview

### Community 77 - "Key Force Check-in"
Cohesion: 0.50
Nodes (3): useKeyForceCheckIn(), backToSelect(), refresh()

### Community 78 - "useKeyCheckout"
Cohesion: 0.50
Nodes (3): useKeyCheckout(), backToSelect(), refresh()

### Community 114 - "RfidTagsTab"
Cohesion: 0.60
Nodes (4): RfidTagsTab(), handleAssign(), handleRevoke(), refresh()

### Community 115 - "SafetyLibraryTab"
Cohesion: 0.60
Nodes (4): SafetyLibraryTab(), handleDelete(), handleSave(), refresh()

## Ambiguous Edges - Review These
- `GitHub Pages deploy pipeline` → `Pro plan + Micro compute`  [AMBIGUOUS]
  RUNBOOK.md · relation: conceptually_related_to

## Knowledge Gaps
- **53 isolated node(s):** `theme.js Rewritten to Read Tokens (hinge)`, `role_key_reasons table`, `Auth Identity / UID Reconciliation`, `Cloud Session Egress Block to Supabase`, `Freeze Window and Cutover` (+48 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 494 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **37 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Runbook` connect `Runbook & Secrets` to `Seed Users Script`, `Data Model Spec`, `Build Brief Core Rules`, `Visual Direction & Tokens`, `02-rls-policies.sql`?**
  _High betweenness centrality (0.206) - this node is a cross-community bridge._
- **What connects `theme.js Rewritten to Read Tokens (hinge)`, `role_key_reasons table`, `Auth Identity / UID Reconciliation` to the rest of the system?**
  _53 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Shared Components & Auth Context` be split into smaller, more focused modules?**
  _Cohesion score 0.08427672955974842 - nodes in this community are weakly interconnected._
- **Why does `SQL run order` connect `02-rls-policies.sql` to `Runbook & Secrets`, `01-schema.sql`?**
  _High betweenness centrality (0.193) - this node is a cross-community bridge._
- **Should `App Shell & Routing` be split into smaller, more focused modules?**
  _Cohesion score 0.12747336377473364 - nodes in this community are weakly interconnected._
- **Why does `send-contractor-job-email Edge Function` connect `Runbook & Secrets` to `JobDetail.jsx`, `Job Lifecycle Triggers Spec`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `GitHub Pages deploy pipeline` and `Pro plan + Micro compute`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
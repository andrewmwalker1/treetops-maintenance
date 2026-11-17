# Graph Report - treetops-maintenance  (2026-11-17)

## Corpus Check
- 301 files · ~230,382 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: .css 4, (none) 3, .example 1)

## Summary
- 2098 nodes · 6907 edges · 114 communities (78 shown, 36 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 189 edges (avg confidence: 0.85)
- Token cost: 401,249 input · 0 output

## Community Hubs (Navigation)
- Shared Components & Auth Context
- App Shell & Routing
- Holidays & Bank Holidays
- License Agreement Calculations
- Office Hub & CSV Export
- Layout & UI Primitives
- Checkout & Activity Logs
- Staff Timesheets UI
- Ponytail Skills & Sage Tool
- Equipment Checkout Hooks
- Jobs Schema
- RLS & Permissions Schema
- Job Detail Page
- Data Model Spec
- Supabase Consolidation & Roles
- Job Lifecycle Triggers Spec
- Deploy Workflow
- Search Picker & Key Tags Admin
- Fault Reports & Repairs Schema
- Document Picker & Admin Tabs
- Checklist Builder & Icons
- Holiday Accrual Schema
- Pitches, Meters & Key Tags Schema
- Platform & PWA Architecture
- Jobs List & Printing
- Meter Scanning & Cache
- Runbook & Secrets
- Runtime Dependencies
- Assignee Picker & Templates
- Job Photos & Subtasks Schema
- Timesheets Schema
- New Job Form
- Job Cards & Completion
- Open Items & graphify
- Organisations & Key Reasons
- Common Faults Admin
- License Agreement Settings
- Equipment Types & Competencies Schema
- Kiosk App
- RFID Kiosk Checkout Schema
- Printable Job Card
- Equipment Documents
- Contractors Schema
- Offline Sync Queue
- Contractor Documents Admin
- Build Brief Core Rules
- Customer Onboarding Script
- Equipment Detail Page
- HTML Entry & PWA Shell
- Dev Dependencies & Workbox
- RLS Helper Functions
- Style Checker Script
- Push Notification Functions
- Meter CSV Import
- Visual Direction & Tokens
- Build & Versioning
- Machine Competencies
- Equipment Doc Reminders Fn
- Design Token Rules
- Users Admin
- Contractor Doc Reminders Fn
- Contractor Job Email Fn
- UI Component Library Rule
- Manage Users Fn
- Scheduled Jobs Generator Fn
- Meter CSV Export
- Activity Types & Safety Library
- UI Redesign Plan
- App Bootstrap & Base Styles
- Seed Users Script
- Groups Admin
- Roles & Permissions Admin
- Key Management Spec
- Job Templates Admin
- Terminal Session Fn
- RFID Login Fn
- npm Scripts
- Key Force Check-in
- UI Polish Phase
- Migration src/components/KeyReasonsModal.jsx

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
- `==CORE== Pure Logic Block (shared with tests)` --semantically_similar_to--> `One Runnable Check Rule`  [INFERRED] [semantically similar]
  public/tools/campmanager-to-sage.html → .claude/skills/ponytail/SKILL.md
- `index.html App Entry` --references--> `TT Monogram Apple Touch Icon (cream TT on dark green)`  [EXTRACTED]
  index.html → public/apple-touch-icon.png
- `TT Monogram App Icon 512px (cream TT on dark green)` --conceptually_related_to--> `PWA Manifest (/manifest.webmanifest)`  [INFERRED]
  public/icon-512.png → index.html
- `TT Monogram Maskable App Icon 512px (cream TT on dark green)` --conceptually_related_to--> `PWA Manifest (/manifest.webmanifest)`  [INFERRED]
  public/icon-512-maskable.png → index.html
- `TT Monogram App Icon 192px (cream TT on dark green)` --conceptually_related_to--> `PWA Manifest (/manifest.webmanifest)`  [INFERRED]
  public/icon-192.png → index.html

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Platform abstraction boundary modules** — src_platform_notifications, src_platform_syncqueue, src_platform_camera [EXTRACTED 1.00]
- **Single filtered-jobs query reused across surfaces** — src_lib_jobsquery, src_pages_jobslist, src_pages_dashboard, src_kiosk_kioskjobs, src_lib_csvexport [EXTRACTED 1.00]
- **RFID terminal sign-in and login_context flow** — src_kiosk_kiosksignin, src_components_rfidscanlistener, supabase_functions_rfid_login, supabase_functions_clear_login_context, src_app [EXTRACTED 1.00]
- **Six-Phase UI Redesign Programme** — ui_redesign_plan_phase_1_foundation, ui_redesign_plan_phase_2_ui_primitives, ui_redesign_plan_phase_3_navigation_rebuild, ui_redesign_plan_phase_4_screen_pass, ui_redesign_plan_phase_5_polish, ui_redesign_plan_phase_6_guardrails [EXTRACTED 1.00]
- **Per-App Namespace Isolation in One Supabase Project** — supabase_consolidation_plan_schema_per_app, supabase_consolidation_plan_edge_function_prefixing, supabase_consolidation_plan_secret_prefixing, supabase_consolidation_plan_db_schema_client_option, supabase_consolidation_plan_accept_content_profile_headers [INFERRED 0.85]
- **Token Layer (tokens.css, base.css, theme.js)** — src_styles_tokens, src_styles_base, src_lib_theme, ui_redesign_plan_design_tokens [EXTRACTED 1.00]
- **Ponytail Skill Suite** — _claude_skills_ponytail_skill_ponytail_skill, _claude_skills_ponytail_review_skill_ponytail_review_skill, _claude_skills_ponytail_audit_skill_ponytail_audit_skill, _claude_skills_ponytail_debt_skill_ponytail_debt_skill, _claude_skills_ponytail_gain_skill_ponytail_gain_skill, _claude_skills_ponytail_help_skill_ponytail_help_skill [EXTRACTED 1.00]
- **GitHub Pages SPA Deep-link Flow** — public_404_github_pages_spa_fallback, index_spa_redirect_restore, public_404_kiosk_magic_link_redirect [EXTRACTED 1.00]
- **CampManager CSV to Sage CSV Pipeline** — public_tools_campmanager_to_sage_parsecsv, public_tools_campmanager_to_sage_detectkind, public_tools_campmanager_to_sage_buildexport, public_tools_campmanager_to_sage_tosagecsv, public_tools_campmanager_to_sage_downloadblob [INFERRED 0.85]

## Communities (114 total, 36 thin omitted)

### Community 0 - "Shared Components & Auth Context"
Cohesion: 0.08
Nodes (49): react, useViewAsCandidates(), ViewAsPicker(), AuthContext, AuthProvider(), consumePendingTerminalLogin(), loadStoredViewingAs(), useAuth() (+41 more)

### Community 1 - "App Shell & Routing"
Cohesion: 0.10
Nodes (51): react-router-dom, App(), AppShell(), DownloadMeters, Gallery, LazyRoute(), MeterLabels, MeterProgress (+43 more)

### Community 2 - "Holidays & Bank Holidays"
Cohesion: 0.06
Nodes (69): addBankHoliday(), addBankHolidayOverride(), approveHolidayRequest(), declineHolidayRequest(), deleteBankHoliday(), getBankHolidayOverrides(), getBankHolidays(), getHolidaySettings() (+61 more)

### Community 3 - "License Agreement Calculations"
Cohesion: 0.06
Nodes (70): applyStandardInstructionTokens(), autoCorrectTitlePairing(), buildMergeData(), computeCaravanAmount(), computeMonthsToCharge(), computePitchFeeProrataAmount(), DEFAULT_AREA_SEASON_MAP, derivePeopleFromRow() (+62 more)

### Community 4 - "Office Hub & CSV Export"
Cohesion: 0.06
Nodes (51): CSV export with export_logs, Office Hub tile palette, RfidScanListener(), dialArcPath(), polarPoint(), StatDial(), KeyStationMenu(), downloadCsv() (+43 more)

### Community 5 - "Layout & UI Primitives"
Cohesion: 0.10
Nodes (53): AccountMenu(), handleLayoutToggle(), initials(), Layout(), handleDndToggle(), readSidebarCollapsed(), Sidebar(), SyncStatus() (+45 more)

### Community 6 - "Checkout & Activity Logs"
Cohesion: 0.07
Nodes (40): checklistVersionSavedLine(), ChecklistVersionView(), KeyStationCheckOut(), upsertHolidaySettings(), queryKeyCheckouts(), queryTimesheetAuditLog(), OTHER_CONTRACTOR, useKeyCheckout() (+32 more)

### Community 7 - "Staff Timesheets UI"
Cohesion: 0.12
Nodes (49): DayRow(), KioskTimesheet(), WeekNote(), getFixedHoursProfiles(), freezeWeek(), getRecentDailyEntries(), getSubmittableProfiles(), getWeekEntries() (+41 more)

### Community 8 - "Ponytail Skills & Sage Tool"
Cohesion: 0.07
Nodes (44): Ponytail Audit Skill, Ponytail Debt Ledger, Ponytail Debt Skill, Benchmark Median Scoreboard, Ponytail Gain Skill, Default Mode Config (PONYTAIL_DEFAULT_MODE / config.json), Ponytail Help Skill, Finding Tags (delete/stdlib/native/yagni/shrink) (+36 more)

### Community 9 - "Equipment Checkout Hooks"
Cohesion: 0.11
Nodes (32): EquipmentLabel(), equipmentMakeModel(), buttonVariants, SafetyDocumentLink(), KioskCheckIn(), KioskCheckOut(), ReportIssueForm(), getChecklistVersionsByIds() (+24 more)

### Community 10 - "Jobs Schema"
Cohesion: 0.07
Nodes (38): job_activity_forbid_delete, job_activity_job_idx, jobs_assignee_group_idx, jobs_assignee_profile_idx, jobs_org_site_idx, jobs_status_idx, notifications_recipient_idx, public.admin_access_log (+30 more)

### Community 11 - "RLS & Permissions Schema"
Cohesion: 0.06
Nodes (33): SQL run order, public.group_members, public.groups, public.permissions, public.platform_admins, public.profiles, public.role_permissions, public.role_visibility (+25 more)

### Community 12 - "Job Detail Page"
Cohesion: 0.07
Nodes (29): newLinkedJobPath(), assigneeName(), buildDefaultContractorEmailBody(), JobDetail(), allSectionNames(), changeSubtaskSection(), checklistAsTemplateSchema(), confirmComplete() (+21 more)

### Community 13 - "Data Model Spec"
Cohesion: 0.10
Nodes (40): activity_type_documents table, areas table, common_fault_descriptions table, Data model, equipment table, equipment_checkouts table, equipment_checks table, equipment_type_checklist_versions table (+32 more)

### Community 14 - "Supabase Consolidation & Roles"
Cohesion: 0.06
Nodes (32): public.custom_access_token_hook(), public.terminal_sessions, Supabase Consolidation Plan, Accept-Profile / Content-Profile Headers, Auth Hooks Are Project-Wide, Auth Identity / UID Reconciliation, AZURE-SQL-MIGRATION-PLAN.md, Cloud Session Egress Block to Supabase (+24 more)

### Community 15 - "Job Lifecycle Triggers Spec"
Cohesion: 0.09
Nodes (37): admin_force_check_in, delete_job, enforce_checklist_item_photo_requirement, enforce_checklist_requires_photo_permission, enforce_job_completion_photo_requirement, enforce_job_reallocation_permission, enforce_job_reopen_permission, enforce_job_subtask_edit_permission (+29 more)

### Community 16 - "Deploy Workflow"
Cohesion: 0.06
Nodes (37): runs-on, steps, concurrency, cancel-in-progress, group, environment, needs, runs-on (+29 more)

### Community 17 - "Search Picker & Key Tags Admin"
Cohesion: 0.08
Nodes (31): highlightMatch(), SearchPicker(), handleKeyDown(), selectItem(), highlightMatch(), KeyTagsTab(), handleAddLocation(), handleAssign() (+23 more)

### Community 18 - "Fault Reports & Repairs Schema"
Cohesion: 0.10
Nodes (27): public.equipment, public.fault_photos, public.fault_reports, public.job_statuses, public.repair_records, equipment_type_repair_assignees_default_uidx, equipment_type_repair_assignees_type_uidx, fault_reports_job_id_idx (+19 more)

### Community 19 - "Document Picker & Admin Tabs"
Cohesion: 0.07
Nodes (25): DocumentPicker(), searchStyle, typeLabel, ActivityTypesTab(), handleDelete(), handleSave(), refresh(), ATTACHMENT_TYPES (+17 more)

### Community 20 - "Checklist Builder & Icons"
Cohesion: 0.13
Nodes (26): ChecklistBuilder(), sortIndicator(), historySortIndicator(), CONTRACTOR_EMAIL_SIGNATURE, LINKED_ACTIVITY_VERB, PRIORITIES, IconAlert(), IconArrowDown() (+18 more)

### Community 21 - "Holiday Accrual Schema"
Cohesion: 0.10
Nodes (22): holiday_bank_holiday_overrides_sync, holiday_bank_holidays_after_insert, public.apply_bank_holiday_for_profile(), public.approve_holiday_request(), public.decline_holiday_request(), public.holiday_accrual_ratio(), public.holiday_bank_holiday_overrides, public.holiday_bank_holidays (+14 more)

### Community 22 - "Pitches, Meters & Key Tags Schema"
Cohesion: 0.12
Nodes (26): public.pitches, public.sites, key_tag_events_key_tag_idx, key_tags_log_event, key_tags_pitch_idx, key_tags_special_location_idx, public.key_special_locations, public.key_tag_events (+18 more)

### Community 23 - "Platform & PWA Architecture"
Cohesion: 0.09
Nodes (22): Build Brief, Branding overrides, Supabase backend, Tree Tops Caravan Park Ltd, Tree Tops seed data, treetops-maintenance.jsx prototype, GitHub Pages deploy pipeline, index.html (+14 more)

### Community 24 - "Jobs List & Printing"
Cohesion: 0.11
Nodes (25): PrintableJobsChecklist(), tdStyle, thStyle, openJob(), JOB_SELECT, loadJobForPrint(), PHOTO_COLUMNS, SUBTASK_COLUMNS (+17 more)

### Community 25 - "Meter Scanning & Cache"
Cohesion: 0.16
Nodes (25): ScanMeter, getCurrentLocation(), fetchActiveMeters(), fetchOutstandingMeters(), fetchProgress(), findTodaysReadingForMeter(), refreshMetersCache(), resolveMeterByQrCode() (+17 more)

### Community 26 - "Runbook & Secrets"
Cohesion: 0.11
Nodes (22): Runbook, .env client variables, pg_stat_activity diagnostic, Resend, VAPID keys, clear-login-context Edge Function, contractor-document-reminders Edge Function, equipment-document-reminders Edge Function (+14 more)

### Community 27 - "Runtime Dependencies"
Cohesion: 0.10
Nodes (27): dependencies, @dnd-kit/core@^6.3.1, @dnd-kit/sortable@^10.0.0, @dnd-kit/utilities@^3.2.2, docxtemplater@^3.69.3, html5-qrcode@^2.3.8, pizzip@^3.2.0, qrcode@^1.5.4 (+19 more)

### Community 28 - "Assignee Picker & Templates"
Cohesion: 0.11
Nodes (23): assigneeKindAndIdFromRow(), assigneeLabel(), AssigneePicker(), fieldStyle, getChecklistVersionsForType(), EquipmentTypesTab(), editType(), handleDelete() (+15 more)

### Community 29 - "Job Photos & Subtasks Schema"
Cohesion: 0.10
Nodes (19): public.job_photos, public.job_subtasks, jobs_enforce_reopen, public.enforce_job_reopen_permission(), public.forbid_role_delete_if_in_use(), roles_forbid_delete_if_in_use, jobs_enforce_completion_photo, public.enforce_job_completion_photo_requirement() (+11 more)

### Community 30 - "Timesheets Schema"
Cohesion: 0.15
Nodes (20): public.freeze_timesheet_week(), public.timesheet_audit_log, public.timesheet_entries, public.timesheet_entries_before_delete(), public.timesheet_entries_before_insert(), public.timesheet_entries_before_update(), public.timesheet_weeks, public.unfreeze_timesheet_week() (+12 more)

### Community 31 - "New Job Form"
Cohesion: 0.13
Nodes (12): ActivityTypePicker(), getAssignableTargets(), NewJob(), goToStep(), handleContinueFromWhat(), handleSubmit(), uploadPhotoForJob(), STEPS (+4 more)

### Community 32 - "Job Cards & Completion"
Cohesion: 0.14
Nodes (20): JobCard(), JobRow(), handleComplete(), today(), resolveLinkedEquipment(), writeJobCompletion(), formatDueDate(), resolveAssigneeRecipientIds() (+12 more)

### Community 33 - "Open Items & graphify"
Cohesion: 0.09
Nodes (18): graphify skill instructions, graphify, Aeroplane mode offline test, Backup/DR tier, equipment_type_repair_assignees fallback, Open questions, role_visibility, Suggested build order (+10 more)

### Community 34 - "Organisations & Key Reasons"
Cohesion: 0.13
Nodes (18): public.organisations, key_reason_presets_org_kind_idx, public.key_reason_presets, public.log_key_tag_event(), public.office_hub_dashboard_items, public.office_hub_doc_categories, public.office_hub_documents, public.office_hub_link_categories (+10 more)

### Community 35 - "Common Faults Admin"
Cohesion: 0.11
Nodes (12): CommonFaultDescriptionsTab(), addFault(), moveFault(), refreshFaults(), removeFault(), DocumentsPanel(), handleFileChosen(), LinksPanel() (+4 more)

### Community 36 - "License Agreement Settings"
Cohesion: 0.14
Nodes (14): LicenseAgreementSettingsTab(), handlePitchFeesUpload(), handleTemplateUpload(), refresh(), validateXmlBrowser(), parseMoneyString(), parsePitchBandsCsv(), assertCount() (+6 more)

### Community 37 - "Equipment Types & Competencies Schema"
Cohesion: 0.15
Nodes (13): public.equipment_types, equipment_checkouts_set_checklist_version, equipment_types_record_checklist_version, public.equipment_type_checklist_versions, public.record_equipment_checklist_version(), public.set_equipment_checkout_checklist_version(), equipment_checkouts_set_competency_warning, profile_machine_competencies_current_unique (+5 more)

### Community 38 - "Kiosk App"
Cohesion: 0.18
Nodes (12): KioskApp(), KioskSafety(), fetchHandoverHistory(), summarizeKeyEvent(), useKeyLookup(), ATTENTION_STATUSES, statusColors, statusLabels (+4 more)

### Community 39 - "RFID Kiosk Checkout Schema"
Cohesion: 0.17
Nodes (17): common_fault_descriptions_type_idx, equipment_checkouts_enforce_immutable, equipment_checkouts_equipment_idx, equipment_checkouts_open_unique, equipment_checkouts_profile_idx, public.admin_force_check_in(), public.common_fault_descriptions, public.enforce_equipment_checkout_immutable_fields() (+9 more)

### Community 40 - "Printable Job Card"
Cohesion: 0.16
Nodes (15): PhotoThumb(), PrintableJobCard(), PrintRow(), printSectionHeading, SignOffField(), KioskJobs(), handleAddPhoto(), minimumPeopleFor() (+7 more)

### Community 41 - "Equipment Documents"
Cohesion: 0.16
Nodes (16): daysUntil(), DocumentRow(), EquipmentDocumentsModal(), handleAdd(), handleDelete(), refresh(), formatDate(), EquipmentTab() (+8 more)

### Community 42 - "Contractors Schema"
Cohesion: 0.20
Nodes (16): public.contractors, contractor_documents_contractor_idx, contractor_documents_pending_reminder_idx, contractor_documents_reset_reminder, public.can_manage_contractor_document(), public.contractor_documents, public.reset_contractor_document_reminder(), contractor_reasons_contractor_idx (+8 more)

### Community 43 - "Offline Sync Queue"
Cohesion: 0.25
Nodes (14): handleOnline(), refreshStatus(), flushQueue(), flushReadingQueue(), flushStore(), getQueueStatus(), getReadingQueueStatus(), openDB() (+6 more)

### Community 44 - "Contractor Documents Admin"
Cohesion: 0.18
Nodes (15): ContractorDocumentsModal(), handleAdd(), handleDelete(), refresh(), daysUntil(), DocumentRow(), formatDate(), ContractorsTab() (+7 more)

### Community 45 - "Build Brief Core Rules"
Cohesion: 0.12
Nodes (10): admin_access_log, Data model, inviteUserByEmail auth flow, Job lifecycle logic, Organisation boundary, Reallocation, RRULE, Scheduling Edge Function (+2 more)

### Community 46 - "Customer Onboarding Script"
Cohesion: 0.17
Nodes (11): papaparse@^5.7.0, papaparse, __dirname, escapeSqlLiteral(), listSqlFilesInOrder(), main(), prompt(), promptList() (+3 more)

### Community 47 - "Equipment Detail Page"
Cohesion: 0.16
Nodes (8): ariaSort(), EquipmentDetail(), formatDateTime(), HISTORY_STATUS, HISTORY_STATUS_CHIPS, oneMonthAgoISODate(), Section(), statusLabels

### Community 48 - "HTML Entry & PWA Shell"
Cohesion: 0.19
Nodes (14): Minimal Pre-paint Reset, PWA Manifest (/manifest.webmanifest), index.html App Entry, SPA Redirect Restore Script, theme-color #142840 (synced with --c-moss-dark), GitHub Pages SPA 404 Fallback, RFID Kiosk Magic-link Redirect (/kiosk), TT Monogram Apple Touch Icon (cream TT on dark green) (+6 more)

### Community 49 - "Dev Dependencies & Workbox"
Cohesion: 0.15
Nodes (13): devDependencies, pg@^8.13.1, supabase@^2.111.0, workbox-core@^7.3.0, workbox-precaching@^7.3.0, workbox-routing@^7.3.0, workbox-strategies@^7.3.0, pg (+5 more)

### Community 50 - "RLS Helper Functions"
Cohesion: 0.22
Nodes (7): can_see_job(), has_permission(), has_site_scope(), is_in_group(), is_platform_admin(), job_is_assigned_to_me(), role_can_see_role()

### Community 51 - "Style Checker Script"
Cohesion: 0.26
Nodes (11): changedJsxFiles(), endOfOpenTag(), EXCLUDED, findViolations(), git(), lineOf(), main(), resolveBase() (+3 more)

### Community 52 - "Push Notification Functions"
Cohesion: 0.17
Nodes (4): corsHeaders, supabase, corsHeaders, supabase

### Community 53 - "Meter CSV Import"
Cohesion: 0.28
Nodes (12): csvRowsToImportRows(), fetchDuplicateGroups(), fetchMeterCandidatesForGroup(), importMeterCsvFiles(), parseCsvFile(), resolveDuplicateGroup(), toIsoDate(), DuplicateGroupCard() (+4 more)

### Community 54 - "Visual Direction & Tokens"
Cohesion: 0.20
Nodes (6): Admiralty visual direction, Field Journal palette, Typography (Lora, Work Sans, IBM Plex Mono), src/kiosk/kioskTheme.js, Field Journal design system, ActionGrid / ActionList (unified hub pages)

### Community 55 - "Build & Versioning"
Cohesion: 0.17
Nodes (8): vite@^5.2.0, vite-plugin-pwa@^0.20.5, @vitejs/plugin-react@^4.2.1, vite, vite-plugin-pwa, @vitejs/plugin-react, BUILD_LABEL, { version }

### Community 56 - "Machine Competencies"
Cohesion: 0.40
Nodes (7): getCurrentCompetencies(), saveCompetencies(), MachineCompetenciesTab(), competenciesFor(), handleSave(), openPerson(), refresh()

### Community 57 - "Equipment Doc Reminders Fn"
Cohesion: 0.22
Nodes (4): officeGroupEmails(), officeGroupId(), resend, supabase

### Community 58 - "Design Token Rules"
Cohesion: 0.28
Nodes (7): src/styles/tokens.css, Checkbox Size Tiers (--checkbox-size-sm/md/kiosk), Container Width Scale (--width-sm..2xl), Design Tokens (type, spacing, radius, elevation, motion, control-h), Px Tokenizing Sweep, --scrollbox-max-h Token, Touch Target Sizing (44px minimum)

### Community 59 - "Users Admin"
Cohesion: 0.33
Nodes (6): UsersTab(), handleDeactivate(), handleInvite(), handleReactivate(), handleSaveEdit(), refresh()

### Community 61 - "Contractor Job Email Fn"
Cohesion: 0.22
Nodes (3): corsHeaders, resend, supabaseAdmin

### Community 62 - "UI Component Library Rule"
Cohesion: 0.25
Nodes (6): src/ui components, Empty-State Sweep, Permission Matrix Sticky Column / Card View, Phase 2 - UI Primitives, Phase 4 - Screen-by-Screen Pass, /ui-gallery Dev Route

### Community 63 - "Manage Users Fn"
Cohesion: 0.25
Nodes (3): corsHeaders, resend, supabaseAdmin

### Community 64 - "Scheduled Jobs Generator Fn"
Cohesion: 0.32
Nodes (4): pushToRecipients(), resolveRecipients(), sendDueTodayReminders(), supabase

### Community 65 - "Meter CSV Export"
Cohesion: 0.39
Nodes (7): buildExportRows(), COLUMNS, downloadCsv(), exportMeterReadingsCsvs(), quoted(), toDdMmYyyy(), handleExport()

### Community 66 - "Activity Types & Safety Library"
Cohesion: 0.36
Nodes (6): job_subtasks_enforce_edit, public.activity_type_documents, public.can_see_document(), public.enforce_job_subtask_edit_permission(), public.ra_ms_documents, public.equipment_type_documents

### Community 67 - "UI Redesign Plan"
Cohesion: 0.32
Nodes (8): UI Redesign Plan, Admin Tabs as Real Routes (/admin/:tab), Admiralty Navy Palette, Decisions D1-D6, Five Navigation Idioms Problem, Mobile Bottom Tab Bar, Palette Drift (Field Journal vs Admiralty), Phase 3 - Navigation and Chrome Rebuild

### Community 68 - "App Bootstrap & Base Styles"
Cohesion: 0.29
Nodes (4): src/styles/base.css, Global :focus-visible Ring, No Stylesheet Finding (1,425 inline styles), Phase 1 - CSS Foundation and Token Layer

### Community 69 - "Seed Users Script"
Cohesion: 0.29
Nodes (4): @supabase/supabase-js@^2.45.4, @supabase/supabase-js, SEED_USERS, supabase

### Community 70 - "Groups Admin"
Cohesion: 0.38
Nodes (4): GroupsTab(), handleDelete(), handleSave(), refresh()

### Community 71 - "Roles & Permissions Admin"
Cohesion: 0.48
Nodes (6): RolesPermissionsTab(), addRole(), deleteRole(), refresh(), saveRename(), toggle()

### Community 72 - "Key Management Spec"
Cohesion: 0.33
Nodes (7): admin_force_check_in_key, log_key_tag_event, key_checkouts table, key_special_locations table, key_tag_events table, key_tags table, can_manage_keys

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

### Community 78 - "UI Polish Phase"
Cohesion: 0.40
Nodes (3): Overdue Pill, Phase 5 - Polish, Redesign Constraints (must not break)

## Ambiguous Edges - Review These
- `GitHub Pages deploy pipeline` → `Pro plan + Micro compute`  [AMBIGUOUS]
  RUNBOOK.md · relation: conceptually_related_to

## Knowledge Gaps
- **53 isolated node(s):** `graphify skill instructions`, `Andy`, `treetops-maintenance.jsx prototype`, `Tree Tops Caravan Park Ltd`, `Supabase backend` (+48 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 484 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Runbook` connect `Runbook & Secrets` to `Open Items & graphify`, `RLS & Permissions Schema`, `Seed Users Script`, `Platform & PWA Architecture`?**
  _High betweenness centrality (0.194) - this node is a cross-community bridge._
- **What connects `graphify skill instructions`, `Andy`, `treetops-maintenance.jsx prototype` to the rest of the system?**
  _53 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Shared Components & Auth Context` be split into smaller, more focused modules?**
  _Cohesion score 0.08373658741847255 - nodes in this community are weakly interconnected._
- **Why does `SQL run order` connect `RLS & Permissions Schema` to `Runbook & Secrets`, `Jobs Schema`?**
  _High betweenness centrality (0.185) - this node is a cross-community bridge._
- **Should `App Shell & Routing` be split into smaller, more focused modules?**
  _Cohesion score 0.09635651912074676 - nodes in this community are weakly interconnected._
- **Why does `public.profiles` connect `RLS & Permissions Schema` to `Organisations & Key Reasons`, `Equipment Types & Competencies Schema`, `RFID Kiosk Checkout Schema`, `Jobs Schema`, `Contractors Schema`, `Supabase Consolidation & Roles`, `Fault Reports & Repairs Schema`, `Holiday Accrual Schema`, `Pitches, Meters & Key Tags Schema`, `Job Photos & Subtasks Schema`, `Timesheets Schema`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `GitHub Pages deploy pipeline` and `Pro plan + Micro compute`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
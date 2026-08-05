// CSV export (Section 7) — reuses queryJobs/queryEquipmentCheckouts so this
// can never drift from what the job list/dashboard or admin checkout log
// show. Writes an export_logs row *before* returning data; if that insert
// is rejected by RLS (no can_export_jobs / can_manage_equipment_status
// permission — see export_logs_insert in 02-rls-policies.sql, widened by
// 18-equipment-checkout-log-admin.sql), the export is aborted rather than
// silently proceeding.

import { supabase } from "./supabaseClient.js";
import { queryJobs } from "./jobsQuery.js";
import { queryEquipmentCheckouts } from "./equipmentCheckoutsQuery.js";

function toCsvValue(value) {
  if (value == null) return "";
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function downloadCsv(columns, rows, filenamePrefix) {
  const csv = [columns, ...rows].map((row) => row.map(toCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportJobsCsv({ orgId, siteId, profileId, filters = {} }) {
  const { error: logError } = await supabase.from("export_logs").insert({
    exported_by: profileId,
    org_id: orgId,
    filters_used: filters,
  });
  if (logError) {
    throw new Error(`Export not permitted: ${logError.message}`);
  }

  const jobs = await queryJobs(siteId, filters);

  const columns = ["description", "priority", "status", "assignee", "due_date", "location", "created_at"];
  const rows = jobs.map((job) => [
    job.description,
    job.priority,
    job.job_status?.name,
    job.assignee?.display_name || job.assignee_group?.name || job.assignee_contractor?.name || "",
    job.due_date || "",
    job.pitch?.pitch_number_or_name || job.area?.name || "",
    job.created_at,
  ]);

  downloadCsv(columns, rows, "jobs-export");
}

export async function exportEquipmentCheckoutsCsv({ orgId, profileId, filters = {} }) {
  const { error: logError } = await supabase.from("export_logs").insert({
    exported_by: profileId,
    org_id: orgId,
    filters_used: { export_type: "equipment_checkouts", ...filters },
  });
  if (logError) {
    throw new Error(`Export not permitted: ${logError.message}`);
  }

  const checkouts = await queryEquipmentCheckouts(filters);

  const columns = [
    "equipment",
    "equipment_type",
    "checked_out_by",
    "checked_out_date",
    "checked_out_time",
    "checked_in_by",
    "checked_in_date",
    "checked_in_time",
    "status",
    "fault_reported",
    "fault_description",
  ];
  const rows = checkouts.map((c) => {
    const outAt = new Date(c.checked_out_at);
    const inAt = c.checked_in_at ? new Date(c.checked_in_at) : null;
    return [
      c.equipment?.name || "",
      c.equipment?.equipment_type?.name || "",
      c.checked_out_by?.display_name || "",
      outAt.toLocaleDateString("en-GB"),
      outAt.toLocaleTimeString("en-GB"),
      c.checked_in_by_profile?.display_name || "",
      inAt ? inAt.toLocaleDateString("en-GB") : "",
      inAt ? inAt.toLocaleTimeString("en-GB") : "",
      c.checked_in_at ? "Checked in" : "Still checked out",
      c.fault ? "Yes" : "No",
      c.fault?.description || "",
    ];
  });

  downloadCsv(columns, rows, "equipment-checkout-log");
}

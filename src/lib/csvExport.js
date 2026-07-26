// CSV export (Section 7) — reuses queryJobs so this can never drift from
// what the job list/dashboard show. Writes an export_logs row *before*
// returning data; if that insert is rejected by RLS (no can_export_jobs
// permission), the export is aborted rather than silently proceeding.

import { supabase } from "./supabaseClient.js";
import { queryJobs } from "./jobsQuery.js";

function toCsvValue(value) {
  if (value == null) return "";
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
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
    job.assignee?.display_name || job.assignee_group?.name || "",
    job.due_date || "",
    job.pitch?.pitch_number_or_name || job.area?.name || "",
    job.created_at,
  ]);

  const csv = [columns, ...rows].map((row) => row.map(toCsvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `jobs-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Single source of truth for "which jobs does the current filter set
// return" — reused by the job list, dashboard, and CSV export (Section 7)
// so the three surfaces can never drift out of sync. RLS is what
// actually enforces site scope x role visibility; the filters here are
// purely UI-level narrowing on top of whatever RLS already lets through.

import { supabase } from "./supabaseClient.js";

const JOB_SELECT = `
  id, description, priority, due_date, lead_in_date, created_at, closed_by, client_generated_id,
  job_status:job_statuses(id, name, is_completed, sort_order),
  job_type:job_types(id, name, requires_completion_photo),
  assignee:profiles!jobs_assignee_profile_id_fkey(id, display_name, role:roles(id, name)),
  assignee_group:groups(id, name),
  assignee_contractor:contractors(id, name),
  pitch:pitches(id, pitch_number_or_name),
  area:areas(id, name)
`;

export async function queryJobs(siteId, filters = {}) {
  let query = supabase.from("jobs").select(JOB_SELECT).eq("site_id", siteId);

  if (filters.statusIds?.length) {
    query = query.in("status_id", filters.statusIds);
  }
  if (filters.priorities?.length) {
    query = query.in("priority", filters.priorities);
  }
  if (filters.assigneeProfileId) {
    query = query.eq("assignee_profile_id", filters.assigneeProfileId);
  }
  if (filters.assigneeGroupId) {
    query = query.eq("assignee_group_id", filters.assigneeGroupId);
  }
  if (filters.dueBefore) {
    query = query.lte("due_date", filters.dueBefore);
  }
  if (filters.dueAfter) {
    query = query.gte("due_date", filters.dueAfter);
  }

  query = query.order("priority", { ascending: false }).order("due_date", { ascending: true, nullsFirst: false });

  const { data, error } = await query;
  if (error) {
    console.error("queryJobs failed", error);
    throw error;
  }
  return data;
}

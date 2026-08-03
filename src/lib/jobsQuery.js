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
  assignee:profiles!jobs_assignee_profile_id_fkey(id, display_name, role:roles(name)),
  assignee_group:groups(id, name),
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
  if (filters.search) {
    query = query.ilike("description", `%${filters.search}%`);
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

// Kiosk "View Jobs" deliberately shows only jobs assigned to the signed-in
// person or a group they belong to -- narrower than full can_see_job RLS
// visibility (no role_can_see_role/can_see_all_jobs parity), matching the
// literal kiosk spec rather than "everything this person could see".
export function filterToAssigneeOrGroups(jobs, profileId, groupIds) {
  return jobs.filter(
    (job) =>
      job.assignee?.id === profileId ||
      (job.assignee_group?.id && groupIds.includes(job.assignee_group.id))
  );
}

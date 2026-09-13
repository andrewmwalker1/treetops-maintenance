// Single source of truth for "which timesheet overrides match the admin
// log filters" -- same reasoning as queryKeyCheckouts in
// keyCheckoutsQuery.js: one table, two profile joins (whose timesheet,
// who changed it), no cross-table merge needed.

import { supabase } from "./supabaseClient.js";

const SELECT = `
  id, week_start, action, field_changes, occurred_at,
  profile:profiles!timesheet_audit_log_profile_id_fkey(id, display_name),
  actor:profiles!timesheet_audit_log_actor_profile_id_fkey(id, display_name)
`;

export async function queryTimesheetAuditLog(filters = {}) {
  let query = supabase.from("timesheet_audit_log").select(SELECT);
  if (filters.profileId) query = query.eq("profile_id", filters.profileId);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.from) query = query.gte("occurred_at", filters.from);
  if (filters.to) query = query.lte("occurred_at", filters.to);

  const { data, error } = await query.order("occurred_at", { ascending: false });
  if (error) {
    console.error("queryTimesheetAuditLog failed", error);
    throw error;
  }
  return data || [];
}

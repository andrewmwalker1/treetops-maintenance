// Single source of truth for "everything a job detail screen (or a printed
// job sheet) needs to show" -- used by JobDetail's own load and by the
// jobs list's bulk "print selected" flow, so the two can't drift apart.

import { supabase } from "./supabaseClient.js";

export const JOB_SELECT = `
  id, description, priority, due_date, completed_date, status_id, assignee_profile_id, assignee_group_id, assignee_contractor_id, closed_by, org_id, site_id, requires_photo, pitch_id, area_id, equipment_id, created_at,
  job_status:job_statuses(id, name, is_completed),
  job_type:job_types(id, name, requires_completion_photo),
  assignee:profiles!jobs_assignee_profile_id_fkey(id, display_name),
  assignee_group:groups(id, name),
  assignee_contractor:contractors(id, name, main_email),
  pitch:pitches(id, pitch_number_or_name),
  area:areas(id, name),
  equipment:equipment(id, name, status),
  creator:profiles!jobs_created_by_fkey(id, display_name)
`;

export async function loadJobForPrint(jobId) {
  const { data: job, error: jobError } = await supabase.from("jobs").select(JOB_SELECT).eq("id", jobId).single();
  if (jobError) throw jobError;

  const [{ data: subtaskRows }, { data: photoRows }, { data: activityRows }, { data: activityTypeLinks }] = await Promise.all([
    supabase.from("job_subtasks").select("id, label, is_checked, sort_order, requires_photo").eq("job_id", jobId).order("sort_order"),
    supabase.from("job_photos").select("id, storage_path, uploaded_at, job_subtask_id").eq("job_id", jobId).order("uploaded_at"),
    supabase
      .from("job_activity")
      .select("id, event_type, previous_value, new_value, created_at, actor:profiles(display_name)")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false }),
    supabase.from("job_activity_types").select("task_type:task_types(id, name)").eq("job_id", jobId),
  ]);

  const subtasks = subtaskRows || [];
  const photos = photoRows || [];
  const activity = activityRows || [];
  const activityTypes = (activityTypeLinks || []).map((l) => l.task_type).filter(Boolean);

  let documentsByActivityType = {};
  if (activityTypes.length > 0) {
    const { data: docLinks } = await supabase
      .from("activity_type_documents")
      .select("task_type_id, document:ra_ms_documents(id, type, title, description, pdf_storage_path)")
      .in("task_type_id", activityTypes.map((t) => t.id));
    for (const link of docLinks || []) {
      documentsByActivityType[link.task_type_id] = [...(documentsByActivityType[link.task_type_id] || []), link.document];
    }
    for (const docs of Object.values(documentsByActivityType)) {
      docs.sort((a, b) => a.title.localeCompare(b.title));
    }
  }

  return { job, subtasks, photos, activity, activityTypes, documentsByActivityType };
}

import { supabase } from "./supabaseClient.js";

// A small, deliberately partial mirror of the job-insert logic in
// NewJob.jsx's handleSubmit -- covers only what the Caravan Sale
// Tracker's "Prep caravan" / "Gas test" / "Electric test" buttons need
// (no photos, activity types, linked-job fields, or offline queueing,
// all of which NewJob.jsx still owns for its own, much larger form).
// Kept here rather than inlined in the Sale Tracker so the two things
// that matter most stay correct in one place:
//   - the id is generated client-side and the insert carries no
//     `.select()`, which sidesteps a real RLS self-reference bug (a
//     `RETURNING` re-checks jobs_select against the row being inserted
//     in the same statement, and unreliably fails to see it yet) --
//     see NewJob.jsx's own comment on this for the full explanation.
//   - job_subtasks are built by copying the template's checklist at
//     creation time, never referencing job_types.template_schema live.
export async function getDefaultOpenStatusId(orgId) {
  const { data, error } = await supabase
    .from("job_statuses")
    .select("id, sort_order")
    .eq("org_id", orgId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Couldn't determine the default status for a new job.");
  return data.id;
}

export async function createJob({
  orgId,
  siteId,
  jobTypeId = null,
  statusId,
  description,
  notes = null,
  assigneeProfileId = null,
  assigneeGroupId = null,
  assigneeContractorId = null,
  pitchId = null,
  dueDate = null,
  saleId = null,
  saleRole = null,
  createdBy,
  templateSchema = [],
}) {
  const jobData = {
    id: crypto.randomUUID(),
    org_id: orgId,
    site_id: siteId,
    job_type_id: jobTypeId,
    description,
    notes,
    priority: "medium",
    status_id: statusId,
    due_date: dueDate,
    assignee_profile_id: assigneeProfileId,
    assignee_group_id: assigneeGroupId,
    assignee_contractor_id: assigneeContractorId,
    pitch_id: pitchId,
    area_id: null,
    created_by: createdBy,
    requires_photo: false,
    sale_id: saleId,
    sale_role: saleRole,
  };

  const { error } = await supabase.from("jobs").insert(jobData);
  if (error) throw error;

  // A heading row (see ChecklistBuilder.jsx) just names the section for
  // whatever items follow it -- never a real checklist item itself.
  let currentSection = null;
  const subtaskRows = [];
  for (const item of templateSchema) {
    if (item.type === "heading") {
      currentSection = item.label;
      continue;
    }
    subtaskRows.push({
      job_id: jobData.id,
      label: item.label,
      requires_photo: item.requiresPhoto,
      section: currentSection,
      sort_order: subtaskRows.length,
    });
  }
  if (subtaskRows.length > 0) {
    const { error: checklistError } = await supabase.from("job_subtasks").insert(subtaskRows);
    if (checklistError) console.error("Failed to attach checklist to new job", checklistError);
  }

  return jobData;
}

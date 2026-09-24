// Linked jobs (79-linked-jobs.sql): a job raised from another job, as one
// of three kinds --
//   handoff  -- someone else does one checklist item of the parent job;
//               completing it ticks that item (done server-side by the
//               jobs_sync_linked_parent trigger).
//   needed   -- extra work needed before the parent can be finished (e.g.
//               ordering materials). The parent warns on completion while
//               it's open.
//   followon -- separate work spotted while doing the parent, for later.
//               Linked for reference only; never warns.

import { supabase } from "./supabaseClient.js";
import { resolveAssigneeRecipientIds } from "./jobAssignmentNotify.js";
import { sendNotification } from "../platform/notifications.js";

// How a linked job describes the job it came from ("Needed for: Relay path").
export const PARENT_LINK_LABEL = {
  handoff: "Handed off from",
  needed: "Needed for",
  followon: "Follow-on from",
};

// The kinds the parent job has to wait for -- follow-on work never holds it up.
export function isBlockingLink(linkedJob) {
  return linkedJob.link_kind === "handoff" || linkedJob.link_kind === "needed";
}

// Open linked jobs the parent is still waiting on. linkedJobs rows need
// link_kind and job_status.is_completed.
export function openBlockingLinks(linkedJobs) {
  return (linkedJobs || []).filter((j) => isBlockingLink(j) && !j.job_status?.is_completed);
}

export function newLinkedJobPath(parentJobId, kind, subtaskId) {
  const params = new URLSearchParams({ linkedTo: parentJobId, kind });
  if (subtaskId) params.set("item", subtaskId);
  return `/jobs/new?${params}`;
}

// Push the parent job's assignee when a linked job is completed or
// cancelled. The item tick/untick and the parent's activity-log entry
// happen server-side regardless (jobs_sync_linked_parent) -- this is only
// the heads-up, so a failure is logged, never surfaced.
// outcome: "completed" | "cancelled".
export async function notifyLinkedJobClosed({ jobId, outcome, actorProfileId, actorDisplayName }) {
  const { data: job, error } = await supabase
    .from("jobs")
    .select(
      "id, description, link_kind, parent_subtask_id, parent_job:parent_job_id(id, description, assignee_profile_id, assignee_group_id, assignee_contractor_id)"
    )
    .eq("id", jobId)
    .maybeSingle();
  if (error) {
    console.error("Failed to load linked job for notification", error);
    return;
  }
  const parent = job?.parent_job;
  if (!parent) return;

  const recipientIds = (await resolveAssigneeRecipientIds(parent)).filter((id) => id !== actorProfileId);
  if (recipientIds.length === 0) return;

  let itemLabel = null;
  if (job.link_kind === "handoff" && job.parent_subtask_id) {
    const { data: item } = await supabase.from("job_subtasks").select("label").eq("id", job.parent_subtask_id).maybeSingle();
    itemLabel = item?.label || null;
  }

  const who = actorDisplayName ? `${actorDisplayName}: ` : "";
  let title;
  let body;
  if (outcome === "completed") {
    title = "Linked job done";
    body =
      job.link_kind === "handoff" && itemLabel
        ? `${who}"${itemLabel}" is done and ticked off on "${parent.description}"`
        : job.link_kind === "needed"
        ? `${who}"${job.description}" is done. "${parent.description}" can carry on.`
        : `${who}"${job.description}" (from "${parent.description}") is done`;
  } else {
    title = "Linked job cancelled";
    body =
      job.link_kind === "handoff" && itemLabel
        ? `${who}"${job.description}" was cancelled. "${itemLabel}" is back with you.`
        : `${who}"${job.description}" (for "${parent.description}") was cancelled`;
  }

  await Promise.all(
    recipientIds.map((recipientProfileId) =>
      sendNotification({
        recipientProfileId,
        triggerType: "linked_job_closed",
        priority: "operational",
        title,
        body,
        data: { jobId: parent.id },
      }).catch((err) => console.error("Failed to push linked-job notification to", recipientProfileId, err))
    )
  );
}

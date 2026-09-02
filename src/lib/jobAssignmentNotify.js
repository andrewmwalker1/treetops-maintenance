// Fires an "operational" push notification (see platform/notifications.js)
// to whoever a job is assigned/reassigned to. Domain logic on top of the
// platform notification boundary, not part of it -- doesn't belong in
// platform/notifications.js itself, which knows nothing about jobs.
//
// A contractor COMPANY isn't a profile and can't hold a push subscription
// -- that's still notified separately via the "Send email to contractor"
// button (send-contractor-job-email). But the contractor's own logged-in
// staff (profiles.contractor_id, 43-contractor-linked-profiles.sql -- e.g.
// Kev/Ben Parry) are real profiles with real subscriptions, same as any
// other user, so they're notified the same way a group's members are.

import { supabase } from "./supabaseClient.js";
import { sendNotification } from "../platform/notifications.js";

async function resolveGroupMemberIds(groupId) {
  const { data, error } = await supabase.from("group_members").select("profile_id").eq("group_id", groupId);
  if (error) {
    console.error("Failed to resolve group members for job-assignment notification", error);
    return [];
  }
  return (data || []).map((row) => row.profile_id);
}

async function resolveContractorEmployeeIds(contractorId) {
  const { data, error } = await supabase.from("profiles").select("id").eq("contractor_id", contractorId);
  if (error) {
    console.error("Failed to resolve contractor employees for job-assignment notification", error);
    return [];
  }
  return (data || []).map((row) => row.id);
}

// job: needs assignee_profile_id, assignee_group_id, assignee_contractor_id, id, description.
// actorProfileId: whoever made the change -- excluded from recipients so
// nobody gets pushed a notification about their own action.
export async function notifyJobAssigned({ job, actorProfileId, actorDisplayName }) {
  let recipientIds = [];
  if (job.assignee_profile_id) {
    recipientIds = [job.assignee_profile_id];
  } else if (job.assignee_group_id) {
    recipientIds = await resolveGroupMemberIds(job.assignee_group_id);
  } else if (job.assignee_contractor_id) {
    recipientIds = await resolveContractorEmployeeIds(job.assignee_contractor_id);
  } else {
    return;
  }
  recipientIds = recipientIds.filter((id) => id !== actorProfileId);
  if (recipientIds.length === 0) return;

  const title = "New job assigned to you";
  const body = actorDisplayName ? `${actorDisplayName}: ${job.description}` : job.description;

  await Promise.all(
    recipientIds.map((recipientProfileId) =>
      sendNotification({
        recipientProfileId,
        triggerType: "job_assigned",
        priority: "operational",
        title,
        body,
        data: { jobId: job.id },
      }).catch((err) => console.error("Failed to push job-assignment notification to", recipientProfileId, err))
    )
  );
}

// Shared "mark a job complete" write, extracted from JobDetail.jsx's
// confirmComplete so the kiosk (KioskJobs.jsx) and the normal job detail
// screen genuinely share one code path rather than two copies that could
// drift apart. The "no completion photo" confirm dialog stays out of this
// function deliberately -- it's a UI concern each caller handles itself
// (the kiosk never targets photo-required templates, per policy: those
// templates simply aren't assigned to non-smartphone staff).
import { supabase } from "./supabaseClient.js";

export async function writeJobCompletion({ jobId, oldStatusId, completedStatusId, actorProfileId, completedDate, comment }) {
  const { error } = await supabase
    .from("jobs")
    .update({ status_id: completedStatusId, closed_by: actorProfileId, completed_date: completedDate })
    .eq("id", jobId);
  if (error) return { error };

  await supabase.from("job_activity").insert({
    job_id: jobId,
    event_type: "status_change",
    actor_profile_id: actorProfileId,
    previous_value: { status_id: oldStatusId },
    new_value: { status_id: completedStatusId, completed_date: completedDate },
  });

  if (comment && comment.trim()) {
    await supabase.from("job_activity").insert({
      job_id: jobId,
      event_type: "comment",
      actor_profile_id: actorProfileId,
      new_value: { text: comment.trim() },
    });
  }

  return { error: null };
}

// Shared "mark a job complete" write, extracted from JobDetail.jsx's
// confirmComplete so the kiosk (KioskJobs.jsx) and the normal job detail
// screen genuinely share one code path rather than two copies that could
// drift apart. The "no completion photo" confirm dialog stays out of this
// function deliberately -- it's a UI concern each caller handles itself
// (the kiosk never targets photo-required templates, per policy: those
// templates simply aren't assigned to non-smartphone staff).
import { supabase } from "./supabaseClient.js";

// equipmentResolution (optional): only meaningful when the job carries an
// equipment_id (see 49-equipment-repair-jobs.sql). Shape:
//   { equipmentId, outcome: "available" | "monitor" | "decommission" | "service",
//     note, cost, vendor,                        // outcome === "available"
//     monitorNote,                                // outcome === "monitor"
//     decommissionReason, decommissionNotes,      // outcome === "decommission"
//     tierUpdates }             // outcome === "service" -- [{tierId, nextDueHours, nextDueDate}]
// Kept a genuinely separate, best-effort step after the job itself is
// completed -- a failure here shouldn't undo or block the completion that
// already succeeded, just get surfaced to the caller as equipmentError so
// they know to fix the machine's status by hand.
async function resolveLinkedEquipment({ jobId, actorProfileId, completedDate, equipmentResolution }) {
  const { equipmentId, outcome, note, cost, vendor, monitorNote, decommissionReason, decommissionNotes, tierUpdates } = equipmentResolution;
  try {
    if (outcome === "service") {
      const { data: equipment, error: hoursErr } = await supabase
        .from("equipment")
        .select("last_hours_reading")
        .eq("id", equipmentId)
        .single();
      if (hoursErr) throw hoursErr;

      for (const t of tierUpdates) {
        const { error: tierErr } = await supabase
          .from("equipment_service_tier_state")
          .update({
            last_completed_at: new Date().toISOString(),
            last_completed_hours: equipment?.last_hours_reading ?? null,
            last_completed_by: actorProfileId,
            next_due_hours: t.nextDueHours ?? null,
            next_due_date: t.nextDueDate || null,
          })
          .eq("equipment_id", equipmentId)
          .eq("tier_id", t.tierId);
        if (tierErr) throw tierErr;
      }

      // Same "back into service, note cleared" shape as the "available"
      // outcome below -- a service visit isn't a fault repair (no
      // repair_records row), but it does the same job of taking the
      // machine off Monitor.
      const { error: statusErr } = await supabase.from("equipment").update({ status: "in_service", monitor_note: null }).eq("id", equipmentId);
      if (statusErr) throw statusErr;
      const { error: eventErr } = await supabase.from("equipment_monitor_events").insert({
        equipment_id: equipmentId,
        note: "Service completed",
        event_type: "cleared",
        created_by: actorProfileId,
      });
      if (eventErr) throw eventErr;
      return null;
    }
    if (outcome === "available") {
      const { data: fault } = await supabase
        .from("fault_reports")
        .select("id")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { error: statusErr } = await supabase.from("equipment").update({ status: "in_service" }).eq("id", equipmentId);
      if (statusErr) throw statusErr;
      const { error: repairErr } = await supabase.from("repair_records").insert({
        equipment_id: equipmentId,
        fault_report_id: fault?.id || null,
        note: note?.trim() || "Repaired",
        cost: cost ? Number(cost) : null,
        vendor: vendor || null,
        repaired_at: new Date().toISOString(),
        repaired_by: actorProfileId,
      });
      if (repairErr) throw repairErr;
    } else if (outcome === "monitor") {
      // Not a repair -- nothing was fixed, so this deliberately doesn't
      // touch repair_records. Equipment goes back into service (available
      // for checkout, same as in_service) but carries a visible note for
      // whoever checks it out next; equipment_monitor_events is its own
      // history-log source so it shows as "Monitoring", not "Repair".
      const trimmed = monitorNote?.trim();
      const { error: statusErr } = await supabase
        .from("equipment")
        .update({ status: "monitor", monitor_note: trimmed || null })
        .eq("id", equipmentId);
      if (statusErr) throw statusErr;
      const { error: eventErr } = await supabase.from("equipment_monitor_events").insert({
        equipment_id: equipmentId,
        note: trimmed || "Monitoring",
        event_type: "flagged",
        created_by: actorProfileId,
      });
      if (eventErr) throw eventErr;
    } else if (outcome === "decommission") {
      const { error: decommissionErr } = await supabase
        .from("equipment")
        .update({
          status: "decommissioned",
          decommissioned_at: completedDate,
          decommission_reason: decommissionReason,
          decommission_notes: decommissionNotes || null,
        })
        .eq("id", equipmentId);
      if (decommissionErr) throw decommissionErr;
    }
    return null;
  } catch (err) {
    return err.message;
  }
}

export async function writeJobCompletion({ jobId, oldStatusId, completedStatusId, actorProfileId, completedDate, comment, equipmentResolution }) {
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

  let equipmentError = null;
  if (equipmentResolution) {
    equipmentError = await resolveLinkedEquipment({ jobId, actorProfileId, completedDate, equipmentResolution });
  }

  return { error: null, equipmentError };
}

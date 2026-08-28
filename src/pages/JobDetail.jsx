import { useEffect, useState, useCallback } from "react";
import { useIsMobile } from "../lib/useIsMobile.js";
import { getAssignableTargets } from "../lib/assignableTargets.js";
import PitchPicker from "../components/PitchPicker.jsx";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { supabase } from "../lib/supabaseClient.js";
import { capturePhoto } from "../platform/camera.js";
import { loadJobForPrint } from "../lib/loadJobForPrint.js";
import { writeJobCompletion } from "../lib/completeJob.js";
import { notifyJobAssigned } from "../lib/jobAssignmentNotify.js";
import SafetyDocumentLink from "../components/SafetyDocumentLink.jsx";
import PhotoThumb from "../components/PhotoThumb.jsx";
import Modal from "../components/Modal.jsx";
import { openPrintWindow, writeAndPrintJobBundles } from "../lib/printJobCards.jsx";
import { colors, fonts, cardStyle, buttonStyle, priorityBarStyle, statusPillStyle, priorityColor } from "../lib/theme.js";

const PRIORITIES = ["immediate", "high", "medium", "low"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Starting point for the contractor-email modal's editable body -- same
// facts the old fixed-template email used to send (see
// send-contractor-job-email/index.ts's git history), just as plain text
// the office user can freely rewrite before sending rather than a
// template the Edge Function baked in unseen.
function buildDefaultContractorEmailBody(job, subtasks) {
  const location = job.pitch?.pitch_number_or_name || job.area?.name || "Not set";
  const lines = [
    `Hi ${job.assignee_contractor?.name || "there"},`,
    "",
    "Please find the details for this job below:",
    "",
    `Priority: ${job.priority}`,
    `Due date: ${job.due_date || "Not set"}`,
    `Location: ${location}`,
    `Requested by: ${job.creator?.display_name || "Tree Tops Maintenance"}`,
  ];
  if (subtasks.length > 0) {
    lines.push("", "Checklist:");
    subtasks.forEach((s) => lines.push(`- ${s.label}`));
  }
  return lines.join("\n");
}

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, org, activeSite, terminology, session } = useAuth();
  const permissions = usePermissions();
  const isMobile = useIsMobile();
  // job_types insert/update is RLS-gated on can_manage_reference_data (see
  // 06-activity-types-and-safety-library.sql), separately from
  // can_edit_job_checklist -- require both so these buttons don't offer an
  // action that the server will then reject.
  const canManageTemplates = permissions.has("can_edit_job_checklist") && permissions.has("can_manage_reference_data");
  const canDeleteJob = permissions.has("can_delete_jobs");
  // Completing/cancelling a job and reopening it are exempted server-side
  // (see 27-job-details-edit-permission.sql) -- this only gates due
  // date/priority/location and jumping status around otherwise.
  const canEditJobDetails = permissions.has("can_edit_job_details");
  // Distinct from requires_photo on the job itself (that's a whole-job
  // completion gate) -- these two govern the per-checklist-item camera
  // button below (see 32-checklist-item-photo-requirement.sql).
  const canRequireChecklistItemPhoto = permissions.has("can_require_checklist_item_photo");
  const canCheckOffWithoutPhoto = permissions.has("can_check_off_item_without_photo");
  // Same permission NewJob.jsx gates its "Require a photo" checkbox with --
  // reused here so editing this flag needs the same permission as setting
  // it did at creation, not the broader can_edit_job_details.
  const canRequireJobPhoto = permissions.has("can_require_job_photo");

  const [job, setJob] = useState(null);
  const [subtasks, setSubtasks] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [activity, setActivity] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [documentsByActivityType, setDocumentsByActivityType] = useState({});
  const [statuses, setStatuses] = useState([]);
  const [people, setPeople] = useState([]);
  const [groups, setGroups] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [pitches, setPitches] = useState([]);
  const [areas, setAreas] = useState([]);
  const [allActivityTypes, setAllActivityTypes] = useState([]);
  const [locationKind, setLocationKind] = useState("none");
  const [areaDraft, setAreaDraft] = useState("");
  const [comment, setComment] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [newChecklistItemRequiresPhoto, setNewChecklistItemRequiresPhoto] = useState(false);
  // Which checklist item's photo gallery modal is open, if any -- see the
  // "View photos" button in the checklist section below.
  const [viewPhotosSubtaskId, setViewPhotosSubtaskId] = useState(null);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  // Which subtask (if any) is mid photo-capture -- separate from
  // `uploading` above, which tracks the whole-job "Add photo" button.
  const [uploadingSubtaskId, setUploadingSubtaskId] = useState(null);
  const [sendingContractorEmail, setSendingContractorEmail] = useState(false);
  const [showContractorEmailModal, setShowContractorEmailModal] = useState(false);
  const [contractorEmailSubject, setContractorEmailSubject] = useState("");
  const [contractorEmailBody, setContractorEmailBody] = useState("");
  const [contractorEmailCc, setContractorEmailCc] = useState("");
  const [contractorEmailPhotoIds, setContractorEmailPhotoIds] = useState(new Set());
  const [contractorEmailUploading, setContractorEmailUploading] = useState(false);
  const [contractorEmailError, setContractorEmailError] = useState(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeDate, setCompleteDate] = useState(today());
  const [completeComment, setCompleteComment] = useState("");
  // Only relevant when job.equipment_id is set (see
  // 49-equipment-repair-jobs.sql) -- what completing this repair job should
  // do to the machine it's linked to.
  const [equipmentOutcome, setEquipmentOutcome] = useState("available"); // available | decommission
  const [equipmentRepairNote, setEquipmentRepairNote] = useState("");
  const [equipmentRepairCost, setEquipmentRepairCost] = useState("");
  const [equipmentRepairVendor, setEquipmentRepairVendor] = useState("");
  const [equipmentDecommissionReason, setEquipmentDecommissionReason] = useState("scrapped");
  const [equipmentDecommissionNotes, setEquipmentDecommissionNotes] = useState("");
  const [reopenTargetStatusId, setReopenTargetStatusId] = useState(null);
  const [reopenComment, setReopenComment] = useState("");
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [jobTypes, setJobTypes] = useState([]);
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [recallTemplateId, setRecallTemplateId] = useState("");
  const [recalling, setRecalling] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [loggingProgress, setLoggingProgress] = useState(false);
  const [progressLogged, setProgressLogged] = useState(false);

  const loadAll = useCallback(async () => {
    let data;
    try {
      data = await loadJobForPrint(id);
    } catch (err) {
      setError(err.message);
      return;
    }
    setJob(data.job);
    setDescriptionDraft(data.job.description);
    setLocationKind(data.job.pitch_id ? "pitch" : data.job.area_id ? "area" : "none");
    setAreaDraft(data.job.area?.name || "");
    setSubtasks(data.subtasks);
    setPhotos(data.photos);
    setActivity(data.activity);
    setActivityTypes(data.activityTypes);
    setDocumentsByActivityType(data.documentsByActivityType);
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!org) return;
    supabase.from("job_statuses").select("id, name, is_completed, sort_order").eq("org_id", org.id).order("sort_order").then(({ data }) => setStatuses(data || []));
    getAssignableTargets(org.id, profile.role_id).then(({ people: p, groups: g, error: assignErr }) => {
      setPeople(p);
      setGroups(g);
      if (assignErr) setError(`Couldn't load people/groups to assign to: ${assignErr}`);
    });
    supabase.from("contractors").select("id, name").eq("org_id", org.id).order("name").then(({ data }) => setContractors(data || []));
    supabase.from("job_types").select("id, name, template_schema").eq("org_id", org.id).order("name").then(({ data }) => setJobTypes(data || []));
    supabase.from("task_types").select("id, name").eq("org_id", org.id).order("name").then(({ data }) => setAllActivityTypes(data || []));
  }, [org]);

  useEffect(() => {
    if (!activeSite) return;
    supabase.from("pitches").select("id, pitch_number_or_name").eq("site_id", activeSite.id).then(({ data }) => setPitches(data || []));
    supabase.from("areas").select("id, name").eq("site_id", activeSite.id).then(({ data }) => setAreas(data || []));
  }, [activeSite]);

  async function toggleSubtask(subtask) {
    const { error: err } = await supabase.from("job_subtasks").update({ is_checked: !subtask.is_checked }).eq("id", subtask.id);
    if (err) console.error(err);
    else loadAll();
  }

  // Capture + upload + link a photo to a checklist item -- does NOT
  // check the item off. An item's photo requirement is often "document
  // everything you notice" (several angles, existing faults), not a
  // single proof-of-work shot, so checking off is now its own separate
  // action (the checkbox below, once at least one photo exists) rather
  // than happening automatically after the first capture.
  async function handleChecklistPhotoCapture(subtask) {
    setUploadingSubtaskId(subtask.id);
    setError(null);
    try {
      const file = await capturePhoto();
      const path = `${job.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("job-photos").upload(path, file);
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("job_photos").insert({
        job_id: job.id,
        storage_path: path,
        uploaded_by: profile.id,
        job_subtask_id: subtask.id,
      });
      if (insertError) throw insertError;
      loadAll();
    } catch (err) {
      if (err.message !== "Photo capture cancelled.") setError(err.message);
    } finally {
      setUploadingSubtaskId(null);
    }
  }

  // can_check_off_item_without_photo override -- explicit and visible
  // (a distinct button, not a silent fallback to an ordinary checkbox)
  // so using it is always a deliberate, on-the-record choice.
  async function handleCheckOffWithoutPhoto(subtask) {
    const { error: err } = await supabase.from("job_subtasks").update({ is_checked: true }).eq("id", subtask.id);
    if (err) setError(err.message);
    else loadAll();
  }

  async function toggleSubtaskRequiresPhoto(subtask) {
    const { error: err } = await supabase.from("job_subtasks").update({ requires_photo: !subtask.requires_photo }).eq("id", subtask.id);
    if (err) setError(err.message);
    else loadAll();
  }

  function editSubtaskLabelLocal(index, text) {
    setSubtasks((prev) => prev.map((s, i) => (i === index ? { ...s, label: text } : s)));
  }

  async function persistSubtaskLabel(subtask) {
    const { error: err } = await supabase.from("job_subtasks").update({ label: subtask.label }).eq("id", subtask.id);
    if (err) setError(err.message);
  }

  async function addSubtask(e) {
    e.preventDefault();
    const label = newChecklistItem.trim();
    if (!label) return;
    const nextSortOrder = subtasks.length > 0 ? Math.max(...subtasks.map((s) => s.sort_order)) + 1 : 0;
    const { error: err } = await supabase
      .from("job_subtasks")
      .insert({ job_id: job.id, label, requires_photo: canRequireChecklistItemPhoto && newChecklistItemRequiresPhoto, sort_order: nextSortOrder });
    if (err) setError(err.message);
    else {
      setNewChecklistItem("");
      setNewChecklistItemRequiresPhoto(false);
      loadAll();
    }
  }

  async function removeSubtask(subtaskId) {
    const { error: err } = await supabase.from("job_subtasks").delete().eq("id", subtaskId);
    if (err) setError(err.message);
    else loadAll();
  }

  async function moveSubtask(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= subtasks.length) return;
    const a = subtasks[index];
    const b = subtasks[target];
    const [{ error: err1 }, { error: err2 }] = await Promise.all([
      supabase.from("job_subtasks").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("job_subtasks").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    if (err1 || err2) setError((err1 || err2).message);
    else loadAll();
  }

  async function handleSaveAsTemplate(e) {
    e.preventDefault();
    const name = newTemplateName.trim();
    if (!name) return;
    setSavingTemplate(true);
    const { error: err } = await supabase.from("job_types").insert({
      org_id: job.org_id,
      name,
      template_schema: subtasks.map((s) => ({ label: s.label, requiresPhoto: s.requires_photo })),
    });
    setSavingTemplate(false);
    if (err) {
      setError(err.message);
      return;
    }
    setShowSaveAsModal(false);
    setNewTemplateName("");
  }

  async function handleUpdateTemplate() {
    if (!job.job_type) return;
    const proceed = window.confirm(
      `Update the "${job.job_type.name}" template's checklist to match this job's checklist? This changes the default checklist for any new jobs created from this template from now on.`
    );
    if (!proceed) return;
    const { error: err } = await supabase
      .from("job_types")
      .update({ template_schema: subtasks.map((s) => ({ label: s.label, requiresPhoto: s.requires_photo })) })
      .eq("id", job.job_type.id);
    if (err) setError(err.message);
  }

  // "Recall checklist" pulls a job_type's template_schema onto this job's
  // actual job_subtasks. Overwrite deletes the existing rows first;
  // append just continues sort_order from whatever's already there --
  // either way the insert itself is the same shape.
  async function handleRecallChecklist(mode) {
    const template = jobTypes.find((t) => t.id === recallTemplateId);
    const items = template?.template_schema || [];
    if (items.length === 0) return;

    setRecalling(true);
    setError(null);

    if (mode === "overwrite" && subtasks.length > 0) {
      const { error: delErr } = await supabase.from("job_subtasks").delete().eq("job_id", job.id);
      if (delErr) {
        setRecalling(false);
        setError(delErr.message);
        return;
      }
    }

    const startOrder = mode === "append" && subtasks.length > 0 ? Math.max(...subtasks.map((s) => s.sort_order)) + 1 : 0;
    const rows = items.map((item, i) => ({ job_id: job.id, label: item.label, requires_photo: item.requiresPhoto, sort_order: startOrder + i }));
    const { error: insErr } = await supabase.from("job_subtasks").insert(rows);
    setRecalling(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }

    setShowRecallModal(false);
    setRecallTemplateId("");
    loadAll();
  }

  // A job can't be completed while any checklist item still needs a photo
  // -- distinct from job.requires_photo (the whole-job flag below). The
  // escape valve is at the item itself (can_check_off_item_without_photo,
  // see the checklist section), not here -- once an item is checked off
  // (with or without a photo), it drops out of this list. Enforced
  // server-side too, see 33-checklist-photo-blocks-completion.sql.
  const outstandingPhotoItems = subtasks.filter((s) => s.requires_photo && !s.is_checked);

  function openCompleteModal() {
    setError(null);
    setEquipmentOutcome("available");
    setEquipmentRepairNote("");
    setEquipmentRepairCost("");
    setEquipmentRepairVendor("");
    setEquipmentDecommissionReason("scrapped");
    setEquipmentDecommissionNotes("");
    setShowCompleteModal(true);
  }

  async function handleStatusChange(newStatusId) {
    if (newStatusId === job.status_id) return;
    const newStatus = statuses.find((s) => s.id === newStatusId);
    const oldCompleted = job.job_status?.is_completed;

    // Completing now always goes through the Complete button/modal below,
    // so the completed date, optional comment, and photo can all be
    // captured together — the plain dropdown just redirects there instead
    // of applying the change itself.
    if (newStatus?.name === "Completed" && !oldCompleted) {
      openCompleteModal();
      return;
    }

    // Reopening a completed/cancelled job requires can_reopen_completed_jobs
    // (also enforced server-side by the jobs_enforce_reopen trigger) and a
    // mandatory comment explaining why, so it goes through its own modal
    // rather than committing immediately.
    if (oldCompleted && !newStatus?.is_completed) {
      if (!permissions.has("can_reopen_completed_jobs")) {
        setError("You don't have permission to reopen a completed or cancelled job.");
        return;
      }
      setError(null);
      setReopenComment("");
      setReopenTargetStatusId(newStatusId);
      return;
    }

    // Any other plain transition (Open <-> In Progress, or -> Cancelled).
    // The confirm dialog only applies when the person closing the job is
    // the assignee — completing on someone else's behalf skips it
    // entirely (Section 5).
    const closingNow = newStatus?.is_completed && !oldCompleted;
    if (closingNow && outstandingPhotoItems.length > 0) {
      setError(`${outstandingPhotoItems.length} checklist item${outstandingPhotoItems.length === 1 ? "" : "s"} still need${outstandingPhotoItems.length === 1 ? "s" : ""} a photo before this job can be completed.`);
      return;
    }
    if (closingNow && job.requires_photo && photos.length === 0 && !permissions.has("can_complete_job_without_photo")) {
      setError("This job requires a photo before it can be completed. Add one below.");
      return;
    }
    const closerIsAssignee = job.assignee_profile_id === profile.id;
    if (closingNow && job.job_type?.requires_completion_photo && photos.length === 0 && closerIsAssignee) {
      const proceed = window.confirm("No photo added — complete anyway?");
      if (!proceed) return;
    }

    const update = { status_id: newStatusId };
    if (closingNow) update.closed_by = profile.id;

    const { error: err } = await supabase.from("jobs").update(update).eq("id", job.id);
    if (err) {
      setError(err.message);
      return;
    }
    await supabase.from("job_activity").insert({
      job_id: job.id,
      event_type: "status_change",
      actor_profile_id: profile.id,
      previous_value: { status_id: job.status_id },
      new_value: { status_id: newStatusId },
    });
    loadAll();
  }

  async function confirmComplete() {
    const completedStatus = statuses.find((s) => s.name === "Completed");
    if (!completedStatus) {
      setError('No "Completed" status is configured for this site.');
      return;
    }

    if (outstandingPhotoItems.length > 0) {
      setError(`${outstandingPhotoItems.length} checklist item${outstandingPhotoItems.length === 1 ? "" : "s"} still need${outstandingPhotoItems.length === 1 ? "s" : ""} a photo before this job can be completed.`);
      return;
    }
    if (job.requires_photo && photos.length === 0 && !permissions.has("can_complete_job_without_photo")) {
      setError("This job requires a photo before it can be completed. Add one below.");
      return;
    }
    const closerIsAssignee = job.assignee_profile_id === profile.id;
    if (job.job_type?.requires_completion_photo && photos.length === 0 && closerIsAssignee) {
      const proceed = window.confirm("No photo added — complete anyway?");
      if (!proceed) return;
    }

    const { error: err, equipmentError } = await writeJobCompletion({
      jobId: job.id,
      oldStatusId: job.status_id,
      completedStatusId: completedStatus.id,
      actorProfileId: profile.id,
      completedDate: completeDate,
      comment: completeComment,
      equipmentResolution: job.equipment_id
        ? equipmentOutcome === "decommission"
          ? {
              equipmentId: job.equipment_id,
              outcome: "decommission",
              decommissionReason: equipmentDecommissionReason,
              decommissionNotes: equipmentDecommissionNotes,
            }
          : {
              equipmentId: job.equipment_id,
              outcome: "available",
              note: equipmentRepairNote,
              cost: equipmentRepairCost,
              vendor: equipmentRepairVendor,
            }
        : null,
    });
    if (err) {
      setError(err.message);
      return;
    }

    setShowCompleteModal(false);
    setCompleteDate(today());
    setCompleteComment("");
    if (equipmentError) setError(`Job completed, but updating the equipment failed: ${equipmentError}`);
    loadAll();
  }

  async function confirmReopen() {
    if (!reopenComment.trim()) {
      setError("A comment is required when reopening a completed or cancelled job.");
      return;
    }

    const { error: err } = await supabase
      .from("jobs")
      .update({ status_id: reopenTargetStatusId, closed_by: null })
      .eq("id", job.id);
    if (err) {
      setError(err.message);
      return;
    }

    await supabase.from("job_activity").insert({
      job_id: job.id,
      event_type: "status_change",
      actor_profile_id: profile.id,
      previous_value: { status_id: job.status_id },
      new_value: { status_id: reopenTargetStatusId },
    });
    await supabase.from("job_activity").insert({
      job_id: job.id,
      event_type: "comment",
      actor_profile_id: profile.id,
      new_value: { text: reopenComment.trim() },
    });

    setReopenTargetStatusId(null);
    setReopenComment("");
    loadAll();
  }

  async function persistDescription() {
    const trimmed = descriptionDraft.trim();
    if (!trimmed || trimmed === job.description) {
      setDescriptionDraft(job.description);
      return;
    }
    const { error: err } = await supabase.from("jobs").update({ description: trimmed }).eq("id", job.id);
    if (err) {
      setError(err.message);
      setDescriptionDraft(job.description);
      return;
    }
    await supabase.from("job_activity").insert({
      job_id: job.id,
      event_type: "edit",
      actor_profile_id: profile.id,
      previous_value: { description: job.description },
      new_value: { description: trimmed },
    });
    loadAll();
  }

  async function handleDueDateChange(newDueDate) {
    if (newDueDate === job.due_date) return;
    const { error: err } = await supabase.from("jobs").update({ due_date: newDueDate }).eq("id", job.id);
    if (err) {
      setError(err.message);
      return;
    }
    await supabase.from("job_activity").insert({
      job_id: job.id,
      event_type: "edit",
      actor_profile_id: profile.id,
      previous_value: { due_date: job.due_date },
      new_value: { due_date: newDueDate },
    });
    loadAll();
  }

  async function handlePriorityChange(newPriority) {
    if (newPriority === job.priority) return;
    const { error: err } = await supabase.from("jobs").update({ priority: newPriority }).eq("id", job.id);
    if (err) {
      setError(err.message);
      return;
    }
    await supabase.from("job_activity").insert({
      job_id: job.id,
      event_type: "edit",
      actor_profile_id: profile.id,
      previous_value: { priority: job.priority },
      new_value: { priority: newPriority },
    });
    loadAll();
  }

  async function handleRequiresPhotoChange(newValue) {
    if (newValue === job.requires_photo) return;
    const { error: err } = await supabase.from("jobs").update({ requires_photo: newValue }).eq("id", job.id);
    if (err) {
      setError(err.message);
      return;
    }
    await supabase.from("job_activity").insert({
      job_id: job.id,
      event_type: "edit",
      actor_profile_id: profile.id,
      previous_value: { requires_photo: job.requires_photo },
      new_value: { requires_photo: newValue },
    });
    loadAll();
  }

  async function handleReallocate(kind, newId) {
    const update = {
      assignee_profile_id: kind === "person" ? newId || null : null,
      assignee_group_id: kind === "group" ? newId || null : null,
      assignee_contractor_id: kind === "contractor" ? newId || null : null,
    };
    const { error: err } = await supabase.from("jobs").update(update).eq("id", job.id);
    if (err) {
      setError(err.message);
      return;
    }
    await supabase.from("job_activity").insert({
      job_id: job.id,
      event_type: "reallocation",
      actor_profile_id: profile.id,
      previous_value: { assignee_profile_id: job.assignee_profile_id, assignee_group_id: job.assignee_group_id, assignee_contractor_id: job.assignee_contractor_id },
      new_value: update,
    });
    if (update.assignee_profile_id || update.assignee_group_id) {
      notifyJobAssigned({ job: { ...job, ...update }, actorProfileId: profile.id, actorDisplayName: profile.display_name }).catch((err) =>
        console.error("Failed to send job-assignment notification", err)
      );
    }
    loadAll();
  }

  async function persistLocation(update) {
    const { error: err } = await supabase.from("jobs").update(update).eq("id", job.id);
    if (err) {
      setError(err.message);
      return;
    }
    await supabase.from("job_activity").insert({
      job_id: job.id,
      event_type: "edit",
      actor_profile_id: profile.id,
      previous_value: { pitch_id: job.pitch_id, area_id: job.area_id },
      new_value: update,
    });
    loadAll();
  }

  function handleLocationKindChange(kind) {
    setLocationKind(kind);
    if (kind === "none") persistLocation({ pitch_id: null, area_id: null });
    // pitch/area: wait for an actual selection below before persisting.
  }

  function handlePitchChange(pitchId) {
    if (!pitchId) return;
    persistLocation({ pitch_id: pitchId, area_id: null });
  }

  // Areas are free text (see NewJob.jsx's identical resolve-or-create) --
  // resolve the typed name to an existing area or create a new one.
  async function handleAreaBlur() {
    const trimmed = areaDraft.trim();
    if (!trimmed || trimmed === job.area?.name) return;
    const existing = areas.find((a) => a.name.toLowerCase() === trimmed.toLowerCase());
    let areaId = existing?.id;
    if (!areaId) {
      const { data: newArea, error: areaError } = await supabase
        .from("areas")
        .insert({ site_id: job.site_id, name: trimmed, created_by: profile.id })
        .select()
        .single();
      if (areaError) {
        setError(areaError.message);
        return;
      }
      areaId = newArea.id;
      setAreas((prev) => [...prev, newArea]);
    }
    await persistLocation({ area_id: areaId, pitch_id: null });
  }

  // Gated by can_edit_job_details server-side too (see
  // 28-job-activity-types-edit-permission.sql) -- the UI only ever calls
  // this from checkboxes that are themselves hidden without the
  // permission, but the RLS policy is what actually stops a direct call.
  async function toggleJobActivityType(taskTypeId) {
    const isLinked = activityTypes.some((t) => t.id === taskTypeId);
    const { error: err } = isLinked
      ? await supabase.from("job_activity_types").delete().eq("job_id", job.id).eq("task_type_id", taskTypeId)
      : await supabase.from("job_activity_types").insert({ job_id: job.id, task_type_id: taskTypeId });
    if (err) {
      setError(err.message);
      return;
    }
    loadAll();
  }

  // Mirrors KioskJobs.jsx's identical handler -- a progress-update note is
  // just a job_activity row (event_type "progress_update"), independent of
  // the job's actual status_id. Previously only the kiosk could log one;
  // this brings the same control here so it's not a kiosk-only affordance.
  async function handleLogProgress() {
    setLoggingProgress(true);
    setError(null);
    const { error: err } = await supabase.from("job_activity").insert({
      job_id: job.id,
      event_type: "progress_update",
      actor_profile_id: profile.id,
      new_value: { percent: progressPercent },
    });
    setLoggingProgress(false);
    if (err) {
      setError(err.message);
      return;
    }
    setProgressLogged(true);
    loadAll();
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    const { error: err } = await supabase.from("job_activity").insert({
      job_id: job.id,
      event_type: "comment",
      actor_profile_id: profile.id,
      new_value: { text: comment },
    });
    if (err) setError(err.message);
    else {
      setComment("");
      loadAll();
    }
  }

  async function handlePrint() {
    let printWindow;
    try {
      printWindow = openPrintWindow();
    } catch (err) {
      setError(err.message);
      return;
    }
    try {
      const photosWithUrls = await Promise.all(
        photos.map(async (p) => {
          const { data } = await supabase.storage.from("job-photos").createSignedUrl(p.storage_path, 3600);
          return { ...p, signedUrl: data?.signedUrl };
        })
      );
      writeAndPrintJobBundles(
        printWindow,
        [{ job, subtasks, photos: photosWithUrls, activity, activityTypes, documentsByActivityType }],
        terminology
      );
    } catch (err) {
      printWindow.close();
      setError(err.message);
    }
  }

  async function handleAddPhoto() {
    setUploading(true);
    setError(null);
    try {
      const file = await capturePhoto();
      const path = `${job.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("job-photos").upload(path, file);
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("job_photos").insert({
        job_id: job.id,
        storage_path: path,
        uploaded_by: profile.id,
      });
      if (insertError) throw insertError;
      loadAll();
    } catch (err) {
      if (err.message !== "Photo capture cancelled.") setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function openContractorEmailModal() {
    setContractorEmailSubject(`Job instruction: ${job.description}`);
    setContractorEmailBody(buildDefaultContractorEmailBody(job, subtasks));
    setContractorEmailCc(session?.user?.email || "");
    setContractorEmailPhotoIds(new Set());
    setContractorEmailError(null);
    setShowContractorEmailModal(true);
  }

  function toggleContractorEmailPhoto(photoId) {
    setContractorEmailPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  }

  // Same capture/upload/insert as handleAddPhoto -- a photo attached from
  // this modal is a real job photo like any other (kept for the record,
  // not a throwaway email-only attachment), just pre-selected for this
  // send since that's obviously why it was just added.
  async function handleContractorEmailAddPhoto() {
    setContractorEmailUploading(true);
    setContractorEmailError(null);
    try {
      const file = await capturePhoto();
      const path = `${job.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("job-photos").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: inserted, error: insertError } = await supabase
        .from("job_photos")
        .insert({ job_id: job.id, storage_path: path, uploaded_by: profile.id })
        .select("id")
        .single();
      if (insertError) throw insertError;
      setContractorEmailPhotoIds((prev) => new Set(prev).add(inserted.id));
      loadAll();
    } catch (err) {
      if (err.message !== "Photo capture cancelled.") setContractorEmailError(err.message);
    } finally {
      setContractorEmailUploading(false);
    }
  }

  async function handleSendContractorEmail() {
    setSendingContractorEmail(true);
    setContractorEmailError(null);
    const ccList = contractorEmailCc.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    const { error: err } = await supabase.functions.invoke("send-contractor-job-email", {
      body: {
        jobId: job.id,
        subject: contractorEmailSubject.trim(),
        bodyText: contractorEmailBody,
        cc: ccList,
        photoIds: Array.from(contractorEmailPhotoIds),
      },
    });
    setSendingContractorEmail(false);
    if (err) {
      setContractorEmailError(err.message);
      return;
    }
    setShowContractorEmailModal(false);
    loadAll();
  }

  async function handleDeleteJob() {
    const proceed = window.confirm(`Permanently delete "${job.description}"? This can't be undone.`);
    if (!proceed) return;
    const { error: err } = await supabase.rpc("delete_job", { p_job_id: job.id });
    if (err) {
      setError(err.message);
      return;
    }
    if (photos.length > 0) {
      await supabase.storage.from("job-photos").remove(photos.map((p) => p.storage_path));
    }
    navigate("/");
  }

  if (!job) {
    return error ? <p style={{ color: colors.immediate }}>{error}</p> : <p style={{ color: colors.inkSoft }}>Loading…</p>;
  }

  return (
    <div style={{ maxWidth: "640px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
        <button onClick={() => navigate(-1)} style={buttonStyle.secondary}>← Back</button>
        <div style={{ display: "flex", gap: "8px" }}>
          <button type="button" onClick={handlePrint} style={buttonStyle.secondary}>Print job card</button>
          {canDeleteJob && (
            <button type="button" onClick={handleDeleteJob} style={{ ...buttonStyle.secondary, color: colors.immediate }}>Delete job</button>
          )}
        </div>
      </div>

      {error && <p style={{ color: colors.immediate, fontSize: "14px" }}>{error}</p>}

      <div style={{ ...cardStyle, padding: "20px", display: "flex", gap: "14px", marginBottom: "20px" }}>
        <div style={priorityBarStyle(job.priority)} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
            <input
              value={descriptionDraft}
              onChange={(e) => setDescriptionDraft(e.target.value)}
              onBlur={persistDescription}
              style={{
                fontFamily: fonts.display,
                color: colors.mossDark,
                margin: 0,
                fontSize: "22px",
                fontWeight: 700,
                border: `1px solid ${colors.lineStrong}`,
                borderRadius: "10px",
                background: colors.bg,
                padding: "6px 12px",
                flex: 1,
                minWidth: 0,
              }}
            />
            <span style={statusPillStyle(job.job_status?.name)}>{job.job_status?.name}</span>
          </div>
          {job.completed_date && <p style={{ fontFamily: fonts.mono, color: colors.inkSoft, fontSize: "13px" }}>Completed {job.completed_date}</p>}

          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.inkSoft, marginTop: "14px" }}>Due date</label>
          {canEditJobDetails ? (
            <input
              type="date"
              value={job.due_date || ""}
              onChange={(e) => handleDueDateChange(e.target.value || null)}
              style={selectStyle}
            />
          ) : (
            <p style={{ fontSize: "14px", margin: "4px 0 14px" }}>{job.due_date || "No due date"}</p>
          )}

          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.inkSoft, marginTop: "14px" }}>Status</label>
          {canEditJobDetails ? (
            <select value={job.status_id} onChange={(e) => handleStatusChange(e.target.value)} style={selectStyle}>
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          ) : (
            // Marking a job Completed still works without can_edit_job_details --
            // that goes through the separate "Complete" button below, not this
            // dropdown, and the server-side trigger exempts that transition.
            <p style={{ fontSize: "14px", margin: "4px 0 14px" }}>{job.job_status?.name}</p>
          )}

          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.inkSoft, marginTop: "14px" }}>Priority</label>
          {canEditJobDetails ? (
            <select
              value={job.priority}
              onChange={(e) => handlePriorityChange(e.target.value)}
              style={{ ...selectStyle, color: priorityColor[job.priority], fontWeight: 600 }}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p} style={{ color: priorityColor[p] }}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
          ) : (
            <p style={{ fontSize: "14px", margin: "4px 0 14px", color: priorityColor[job.priority], fontWeight: 600 }}>
              {job.priority.charAt(0).toUpperCase() + job.priority.slice(1)}
            </p>
          )}

          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.inkSoft, marginTop: "14px" }}>Location</label>
          {canEditJobDetails ? (
            <>
              <div style={{ display: "flex", gap: "10px", marginBottom: "10px", fontSize: "14px" }}>
                <label><input type="radio" checked={locationKind === "pitch"} onChange={() => handleLocationKindChange("pitch")} /> {terminology.pitch || "Pitch"}</label>
                <label><input type="radio" checked={locationKind === "area"} onChange={() => handleLocationKindChange("area")} /> {terminology.area || "Area"}</label>
                <label><input type="radio" checked={locationKind === "none"} onChange={() => handleLocationKindChange("none")} /> None</label>
              </div>
              {locationKind === "pitch" && (
                <PitchPicker pitches={pitches} value={job.pitch_id || ""} onChange={handlePitchChange} style={selectStyle} />
              )}
              {locationKind === "area" && (
                <>
                  <input
                    list="job-detail-area-suggestions"
                    value={areaDraft}
                    onChange={(e) => setAreaDraft(e.target.value)}
                    onBlur={handleAreaBlur}
                    placeholder={`Type a ${(terminology.area || "area").toLowerCase()} name…`}
                    style={selectStyle}
                  />
                  <datalist id="job-detail-area-suggestions">
                    {areas.map((a) => (
                      <option key={a.id} value={a.name} />
                    ))}
                  </datalist>
                </>
              )}
            </>
          ) : (
            <p style={{ fontSize: "14px", margin: "4px 0 14px" }}>
              {job.pitch ? `${terminology.pitch || "Pitch"} ${job.pitch.pitch_number_or_name}` : job.area ? job.area.name : "None"}
            </p>
          )}

          {job.equipment_id && (
            <p style={{ fontSize: "14px", margin: "4px 0 14px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: colors.inkSoft }}>Equipment: </span>
              <span
                onClick={() => navigate(`/equipment/${job.equipment_id}`)}
                style={{ color: colors.moss, fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}
              >
                {job.equipment?.name || "View machine"}
              </span>
            </p>
          )}

          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.inkSoft, marginTop: "14px" }}>Photo required to complete</label>
          {canRequireJobPhoto ? (
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", margin: "4px 0 14px", cursor: "pointer" }}>
              <input type="checkbox" checked={job.requires_photo} onChange={(e) => handleRequiresPhotoChange(e.target.checked)} />
              Require a photo before this job can be completed
            </label>
          ) : (
            <p style={{ fontSize: "14px", margin: "4px 0 14px" }}>{job.requires_photo ? "Yes" : "No"}</p>
          )}

          {permissions.has("can_reallocate_jobs") && (
            <>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.inkSoft, marginTop: "14px" }}>Reassign to</label>
              <select
                defaultValue={job.assignee_profile_id ? `person:${job.assignee_profile_id}` : job.assignee_group_id ? `group:${job.assignee_group_id}` : job.assignee_contractor_id ? `contractor:${job.assignee_contractor_id}` : ""}
                onChange={(e) => {
                  const [kind, val] = e.target.value.split(":");
                  handleReallocate(kind, val);
                }}
                style={selectStyle}
              >
                <option value="">Unassigned</option>
                <optgroup label="People">
                  {people.map((p) => <option key={p.id} value={`person:${p.id}`}>{p.display_name}</option>)}
                </optgroup>
                <optgroup label="Groups">
                  {groups.map((g) => <option key={g.id} value={`group:${g.id}`}>{g.name}</option>)}
                </optgroup>
                <optgroup label="Contractors">
                  {contractors.map((c) => <option key={c.id} value={`contractor:${c.id}`}>{c.name}</option>)}
                </optgroup>
              </select>
            </>
          )}
          {!permissions.has("can_reallocate_jobs") && (job.assignee?.display_name || job.assignee_group?.name || job.assignee_contractor?.name) && (
            <p style={{ fontSize: "14px", marginTop: "10px" }}>Assigned to {job.assignee?.display_name || job.assignee_group?.name || job.assignee_contractor?.name}</p>
          )}
          {job.assignee_contractor && permissions.has("can_manage_contractors") && (
            <button type="button" onClick={openContractorEmailModal} style={{ ...buttonStyle.secondary, marginTop: "10px" }}>
              Send email to contractor
            </button>
          )}
        </div>
      </div>

      {(activityTypes.length > 0 || (canEditJobDetails && allActivityTypes.length > 0)) && (
        <Section title="⚠ Safety">
          {canEditJobDetails && allActivityTypes.length > 0 && (
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: colors.inkSoft, marginBottom: "6px" }}>Activity types</div>
              {allActivityTypes.map((t) => (
                <label key={t.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "3px 0", fontSize: "14px" }}>
                  <input type="checkbox" checked={activityTypes.some((a) => a.id === t.id)} onChange={() => toggleJobActivityType(t.id)} />
                  {t.name}
                </label>
              ))}
            </div>
          )}
          {/* Without can_edit_job_details, only the types already selected on
              this job show -- each still links through to its RA/MS
              documents below, so viewing safety info never requires the
              edit permission, only changing the selection does. */}
          {activityTypes.map((t) => (
            <div key={t.id} style={{ marginBottom: "10px" }}>
              <div style={{ fontWeight: 600, fontSize: "14px" }}>{t.name}</div>
              {(documentsByActivityType[t.id] || []).length === 0 && (
                <p style={{ color: colors.inkSoft, fontSize: "13px", margin: "2px 0" }}>No RA/MS documents linked yet.</p>
              )}
              {(documentsByActivityType[t.id] || []).map((doc) => (
                <SafetyDocumentLink key={doc.id} doc={doc} />
              ))}
            </div>
          ))}
        </Section>
      )}

      {(subtasks.length > 0 || permissions.has("can_edit_job_checklist")) && (
        <Section title="Checklist">
          {subtasks.map((s, i) => {
            const itemPhotos = photos.filter((p) => p.job_subtask_id === s.id);
            const canEdit = permissions.has("can_edit_job_checklist");

            const label = canEdit ? (
              <input
                value={s.label}
                onChange={(e) => editSubtaskLabelLocal(i, e.target.value)}
                onBlur={() => persistSubtaskLabel(subtasks[i])}
                style={{
                  flex: 1,
                  minWidth: isMobile ? "80px" : "120px",
                  boxSizing: "border-box",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  border: `1px solid ${colors.lineStrong}`,
                  fontFamily: fonts.body,
                  fontSize: "14px",
                  textDecoration: s.is_checked ? "line-through" : "none",
                  color: s.is_checked ? colors.inkSoft : colors.ink,
                }}
              />
            ) : (
              <span style={{ flex: 1, minWidth: isMobile ? "80px" : "120px", textDecoration: s.is_checked ? "line-through" : "none", color: s.is_checked ? colors.inkSoft : colors.ink }}>{s.label}</span>
            );

            // Photos accumulate here without checking the item off -- e.g.
            // several angles/faults for "photograph the caravan before you
            // start". Checking off is a separate, explicit action once at
            // least one photo exists.
            const checkControls = s.requires_photo ? (
              <>
                {!s.is_checked && (
                  <button
                    type="button"
                    onClick={() => handleChecklistPhotoCapture(s)}
                    disabled={uploadingSubtaskId === s.id}
                    title="Add photo"
                    aria-label="Add photo"
                    style={checklistIconStyle}
                  >
                    {uploadingSubtaskId === s.id ? "…" : "📷"}
                  </button>
                )}
                {itemPhotos.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setViewPhotosSubtaskId(s.id)}
                    style={{ ...buttonStyle.secondary, padding: "4px 10px", fontSize: "13px" }}
                  >
                    🖼 View photos ({itemPhotos.length})
                  </button>
                )}
                {!s.is_checked && itemPhotos.length === 0 && canCheckOffWithoutPhoto && (
                  <button
                    type="button"
                    onClick={() => handleCheckOffWithoutPhoto(s)}
                    style={{ background: "none", border: "none", color: colors.inkSoft, textDecoration: "underline", cursor: "pointer", fontFamily: fonts.body, fontSize: "12px", padding: 0 }}
                  >
                    Check off without photo
                  </button>
                )}
                {(s.is_checked || itemPhotos.length > 0) && (
                  <input type="checkbox" checked={s.is_checked} onChange={() => toggleSubtask(s)} />
                )}
              </>
            ) : (
              <input type="checkbox" checked={s.is_checked} onChange={() => toggleSubtask(s)} />
            );

            const editIcons = canEdit && (
              <>
                {canRequireChecklistItemPhoto && (
                  <button
                    type="button"
                    onClick={() => toggleSubtaskRequiresPhoto(s)}
                    title={s.requires_photo ? "Requires a photo to check off — click to remove" : "Click to require a photo to check off"}
                    style={{
                      ...checklistIconStyle,
                      background: s.requires_photo ? colors.mossDark : "transparent",
                      color: s.requires_photo ? "#FFFFFF" : colors.inkSoft,
                      border: `1px solid ${s.requires_photo ? colors.mossDark : colors.lineStrong}`,
                    }}
                  >
                    📷
                  </button>
                )}
                <button type="button" onClick={() => moveSubtask(i, -1)} disabled={i === 0} style={checklistIconStyle}>↑</button>
                <button type="button" onClick={() => moveSubtask(i, 1)} disabled={i === subtasks.length - 1} style={checklistIconStyle}>↓</button>
                <button type="button" onClick={() => removeSubtask(s.id)} style={{ ...checklistIconStyle, color: colors.immediate }}>✕</button>
              </>
            );

            // On a narrow phone, the label + fixed-width controls column +
            // reorder/remove icons don't all fit on one line -- they used to
            // just wrap wherever flexbox happened to break, splitting a
            // truncated-looking label from a stray row of icon buttons
            // underneath. The photo/checkbox controls are compact icon
            // buttons now (see checklistIconStyle above), so those stay on
            // the same line as the label; only the reorder/remove icons
            // (only shown at all with edit permission) drop to a second
            // line, and only when there's edit permission to show them.
            if (isMobile) {
              return (
                <div key={s.id} style={{ padding: "8px 0", borderBottom: `1px solid ${colors.line}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    {label}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>{checkControls}</div>
                  </div>
                  {editIcons && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px", marginTop: "6px" }}>{editIcons}</div>
                  )}
                </div>
              );
            }

            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0", flexWrap: "wrap" }}>
                {label}
                {/* Controls live in a fixed-width right-hand column, flush
                    against the row's right edge (label's flex:1 pushes it
                    there), so checkboxes and "Add photo" buttons line up in
                    one column down the list instead of the item text
                    starting at a different x on every row. */}
                <div style={{ width: "160px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", flexWrap: "wrap" }}>
                  {checkControls}
                </div>
                {editIcons}
              </div>
            );
          })}
          {permissions.has("can_edit_job_checklist") && (
            <form onSubmit={addSubtask} style={{ display: "flex", gap: "8px", marginTop: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <input
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                placeholder="Add an item…"
                style={{ ...selectStyle, flex: 1, marginBottom: 0 }}
              />
              {canRequireChecklistItemPhoto && (
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: colors.inkSoft, whiteSpace: "nowrap" }}>
                  <input type="checkbox" checked={newChecklistItemRequiresPhoto} onChange={(e) => setNewChecklistItemRequiresPhoto(e.target.checked)} />
                  📷 Requires photo
                </label>
              )}
              <button type="submit" style={buttonStyle.secondary}>Add</button>
            </form>
          )}
          {permissions.has("can_edit_job_checklist") && (
            <div style={{ marginTop: "10px" }}>
              <button type="button" onClick={() => setShowRecallModal(true)} style={buttonStyle.secondary}>
                Recall checklist…
              </button>
            </div>
          )}
          {canManageTemplates && (
            <div style={{ display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
              <button type="button" onClick={() => setShowSaveAsModal(true)} style={buttonStyle.secondary}>
                Save as new template
              </button>
              {job.job_type && (
                <button type="button" onClick={handleUpdateTemplate} style={buttonStyle.secondary}>
                  Update "{job.job_type.name}" template
                </button>
              )}
            </div>
          )}
        </Section>
      )}

      <Section title="Photos">
        {job.requires_photo && photos.length === 0 && (
          <p style={{ color: colors.immediate, fontSize: "13px", marginTop: 0 }}>Photo required before this job can be completed.</p>
        )}
        {/* Checklist-item photos live under their own item ("View photos"
            button, above) -- this grid is only general job photos, not
            tied to a specific item, so the two don't duplicate each other. */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
          {photos.filter((p) => !p.job_subtask_id).map((p) => (
            <PhotoThumb key={p.id} path={p.storage_path} />
          ))}
        </div>
        <button onClick={handleAddPhoto} disabled={uploading} style={buttonStyle.secondary}>
          {uploading ? "Uploading…" : "Add photo"}
        </button>
      </Section>

      {!job.job_status?.is_completed && (
        <Section title="Progress update">
          <p style={{ fontSize: "28px", fontWeight: 700, color: colors.mossDark, textAlign: "center", margin: "0 0 8px" }}>
            {progressPercent}%
          </p>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={progressPercent}
            onChange={(e) => {
              setProgressPercent(Number(e.target.value));
              setProgressLogged(false);
            }}
            style={{ width: "100%" }}
          />
          <button
            type="button"
            onClick={handleLogProgress}
            disabled={loggingProgress}
            style={{ ...buttonStyle.secondary, width: "100%", marginTop: "12px" }}
          >
            {loggingProgress ? "Logging…" : progressLogged ? "Logged ✓" : "Log update"}
          </button>
        </Section>
      )}

      <Section title="Activity">
        <form onSubmit={handleAddComment} style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" style={{ ...selectStyle, flex: 1, marginBottom: 0 }} />
          <button type="submit" style={buttonStyle.primary}>Post</button>
        </form>
        {activity.map((a) => (
          <div key={a.id} style={{ padding: "8px 0", borderBottom: `1px solid ${colors.line}` }}>
            <div style={{ fontSize: "13px", color: colors.inkSoft }}>
              <strong style={{ color: colors.ink }}>{a.actor?.display_name}</strong> ·{" "}
              {a.event_type === "contractor_email" ? "emailed contractor" : a.event_type === "progress_update" ? "progress update" : a.event_type} ·{" "}
              {new Date(a.created_at).toLocaleString()}
            </div>
            {a.event_type === "comment" && <div>{a.new_value?.text}</div>}
            {a.event_type === "contractor_email" && (
              <div>
                Job details sent to {a.new_value?.contractor_name} ({a.new_value?.sent_to})
                {a.new_value?.cc?.length > 0 && <> — cc: {a.new_value.cc.join(", ")}</>}
                {a.new_value?.photo_count > 0 && <> — {a.new_value.photo_count} photo{a.new_value.photo_count === 1 ? "" : "s"} attached</>}
              </div>
            )}
            {a.event_type === "progress_update" && <div>Progress: {a.new_value?.percent}%</div>}
          </div>
        ))}
        {/* Not a job_activity row -- read straight off jobs.created_by/
            created_at, which every job has had since day one. Always the
            oldest event, so it belongs after the (newest-first) list above,
            at the bottom. created_by is null only for schedule-generated
            jobs (see 01-schema.sql). */}
        <div style={{ padding: "8px 0" }}>
          <div style={{ fontSize: "13px", color: colors.inkSoft }}>
            <strong style={{ color: colors.ink }}>{job.creator?.display_name || "Schedule"}</strong> ·{" "}
            {job.creator ? "created" : "created automatically"} ·{" "}
            {new Date(job.created_at).toLocaleString()}
          </div>
        </div>
      </Section>

      {!job.job_status?.is_completed && (
        <>
          {outstandingPhotoItems.length > 0 && (
            <p style={{ color: colors.immediate, fontSize: "13px", textAlign: "center", marginBottom: "8px" }}>
              {outstandingPhotoItems.length} checklist item{outstandingPhotoItems.length === 1 ? "" : "s"} still need{outstandingPhotoItems.length === 1 ? "s" : ""} a photo before this job can be completed.
            </p>
          )}
          <button
            type="button"
            onClick={openCompleteModal}
            disabled={outstandingPhotoItems.length > 0}
            title={outstandingPhotoItems.length > 0 ? "Check off all photo-required checklist items first" : undefined}
            style={{
              ...buttonStyle.primary,
              width: "100%",
              opacity: outstandingPhotoItems.length > 0 ? 0.5 : 1,
              cursor: outstandingPhotoItems.length > 0 ? "not-allowed" : "pointer",
            }}
          >
            ✓ Complete
          </button>
        </>
      )}

      {showCompleteModal && (
        <Modal title="Complete job" onClose={() => setShowCompleteModal(false)}>
          <label style={modalLabelStyle}>Completed date</label>
          <input
            type="date"
            value={completeDate}
            onChange={(e) => setCompleteDate(e.target.value)}
            style={selectStyle}
          />

          <label style={modalLabelStyle}>Comment (optional)</label>
          <textarea
            value={completeComment}
            onChange={(e) => setCompleteComment(e.target.value)}
            rows={3}
            style={{ ...selectStyle, resize: "vertical" }}
          />

          <label style={modalLabelStyle}>{job.requires_photo ? "Photos (required)" : "Photos (optional)"}</label>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
            {photos.map((p) => (
              <PhotoThumb key={p.id} path={p.storage_path} />
            ))}
          </div>
          <button type="button" onClick={handleAddPhoto} disabled={uploading} style={{ ...buttonStyle.secondary, marginBottom: "16px" }}>
            {uploading ? "Uploading…" : "Add photo"}
          </button>

          {outstandingPhotoItems.length > 0 && (
            <p style={{ color: colors.immediate, fontSize: "13px" }}>
              {outstandingPhotoItems.length} checklist item{outstandingPhotoItems.length === 1 ? "" : "s"} still need{outstandingPhotoItems.length === 1 ? "s" : ""} a photo — go back to the checklist and add {outstandingPhotoItems.length === 1 ? "it" : "them"} before completing.
            </p>
          )}

          {job.equipment_id && (
            <div style={{ borderTop: `1px solid ${colors.line}`, marginTop: "4px", paddingTop: "14px" }}>
              <label style={modalLabelStyle}>
                This job is linked to <strong>{job.equipment?.name || "a machine"}</strong> — what's the outcome?
              </label>
              <div style={{ display: "flex", gap: "16px", marginBottom: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px" }}>
                  <input type="radio" checked={equipmentOutcome === "available"} onChange={() => setEquipmentOutcome("available")} /> Mark available again
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px" }}>
                  <input type="radio" checked={equipmentOutcome === "decommission"} onChange={() => setEquipmentOutcome("decommission")} /> Decommission
                </label>
              </div>

              {equipmentOutcome === "available" ? (
                <>
                  <label style={modalLabelStyle}>Repair note (optional)</label>
                  <textarea
                    value={equipmentRepairNote}
                    onChange={(e) => setEquipmentRepairNote(e.target.value)}
                    rows={2}
                    style={{ ...selectStyle, resize: "vertical" }}
                  />
                  <div style={{ display: "flex", gap: "10px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={modalLabelStyle}>Cost (optional)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={equipmentRepairCost}
                        onChange={(e) => setEquipmentRepairCost(e.target.value)}
                        style={selectStyle}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={modalLabelStyle}>Vendor (optional)</label>
                      <input
                        value={equipmentRepairVendor}
                        onChange={(e) => setEquipmentRepairVendor(e.target.value)}
                        style={selectStyle}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <label style={modalLabelStyle}>Reason</label>
                  <select
                    value={equipmentDecommissionReason}
                    onChange={(e) => setEquipmentDecommissionReason(e.target.value)}
                    style={selectStyle}
                  >
                    <option value="scrapped">Scrapped</option>
                    <option value="sold">Sold</option>
                    <option value="other">Other</option>
                  </select>
                  <label style={modalLabelStyle}>Notes (optional)</label>
                  <textarea
                    value={equipmentDecommissionNotes}
                    onChange={(e) => setEquipmentDecommissionNotes(e.target.value)}
                    rows={2}
                    style={{ ...selectStyle, resize: "vertical" }}
                  />
                </>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setShowCompleteModal(false)} style={buttonStyle.secondary}>Cancel</button>
            <button type="button" onClick={confirmComplete} disabled={outstandingPhotoItems.length > 0} style={buttonStyle.primary}>Mark complete</button>
          </div>
        </Modal>
      )}

      {showContractorEmailModal && (
        <Modal title={`Email ${job.assignee_contractor?.name || "contractor"}`} onClose={() => setShowContractorEmailModal(false)} maxWidth="560px">
          <p style={{ fontSize: "13px", color: colors.inkSoft, marginTop: 0 }}>
            To: {job.assignee_contractor?.name}
            {job.assignee_contractor?.main_email ? ` <${job.assignee_contractor.main_email}>` : " — no email address on file"}
          </p>

          <label style={modalLabelStyle}>Subject</label>
          <input value={contractorEmailSubject} onChange={(e) => setContractorEmailSubject(e.target.value)} style={selectStyle} />

          <label style={modalLabelStyle}>Message</label>
          <textarea
            value={contractorEmailBody}
            onChange={(e) => setContractorEmailBody(e.target.value)}
            rows={11}
            style={{ ...selectStyle, resize: "vertical" }}
          />

          <label style={modalLabelStyle}>CC</label>
          <input
            value={contractorEmailCc}
            onChange={(e) => setContractorEmailCc(e.target.value)}
            placeholder="name@example.com"
            style={selectStyle}
          />

          <label style={modalLabelStyle}>Photos</label>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" }}>
            {photos.map((p) => (
              <div key={p.id} style={{ position: "relative", display: "inline-block" }}>
                <PhotoThumb path={p.storage_path} size={64} />
                <input
                  type="checkbox"
                  checked={contractorEmailPhotoIds.has(p.id)}
                  onChange={() => toggleContractorEmailPhoto(p.id)}
                  style={{ position: "absolute", top: "4px", right: "4px", width: "18px", height: "18px", cursor: "pointer" }}
                />
              </div>
            ))}
            {photos.length === 0 && <p style={{ color: colors.inkSoft, fontSize: "13px", margin: 0 }}>No photos on this job yet.</p>}
          </div>
          <button type="button" onClick={handleContractorEmailAddPhoto} disabled={contractorEmailUploading} style={{ ...buttonStyle.secondary, marginBottom: "16px" }}>
            {contractorEmailUploading ? "Uploading…" : "Add photo"}
          </button>

          {contractorEmailError && <p style={{ color: colors.immediate, fontSize: "13px" }}>{contractorEmailError}</p>}

          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setShowContractorEmailModal(false)} style={buttonStyle.secondary}>Cancel</button>
            <button
              type="button"
              onClick={handleSendContractorEmail}
              disabled={sendingContractorEmail || !job.assignee_contractor?.main_email || !contractorEmailSubject.trim() || !contractorEmailBody.trim()}
              style={buttonStyle.primary}
            >
              {sendingContractorEmail ? "Sending…" : "Send"}
            </button>
          </div>
        </Modal>
      )}

      {showSaveAsModal && (
        <Modal title="Save as new template" onClose={() => setShowSaveAsModal(false)}>
          <form onSubmit={handleSaveAsTemplate}>
            <label style={modalLabelStyle}>Template name</label>
            <input
              autoFocus
              required
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              style={selectStyle}
            />
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowSaveAsModal(false)} style={buttonStyle.secondary}>Cancel</button>
              <button type="submit" disabled={savingTemplate} style={buttonStyle.primary}>{savingTemplate ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </Modal>
      )}

      {showRecallModal && (
        <Modal title="Recall checklist" onClose={() => { setShowRecallModal(false); setRecallTemplateId(""); }}>
          <label style={modalLabelStyle}>Template</label>
          <select value={recallTemplateId} onChange={(e) => setRecallTemplateId(e.target.value)} style={selectStyle}>
            <option value="">Choose a template…</option>
            {jobTypes.filter((t) => (t.template_schema || []).length > 0).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.template_schema.length} item{t.template_schema.length === 1 ? "" : "s"})
              </option>
            ))}
          </select>
          {jobTypes.filter((t) => (t.template_schema || []).length > 0).length === 0 && (
            <p style={{ color: colors.inkSoft, fontSize: "13px" }}>No job templates have a checklist yet.</p>
          )}
          {recallTemplateId && subtasks.length > 0 && (
            <p style={{ fontSize: "13px", color: colors.inkSoft }}>
              This job already has {subtasks.length} checklist item{subtasks.length === 1 ? "" : "s"}. Append the
              template's items to the end, or overwrite the existing checklist entirely?
            </p>
          )}
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "14px" }}>
            <button type="button" onClick={() => { setShowRecallModal(false); setRecallTemplateId(""); }} style={buttonStyle.secondary}>
              Cancel
            </button>
            {subtasks.length > 0 ? (
              <>
                <button type="button" disabled={!recallTemplateId || recalling} onClick={() => handleRecallChecklist("append")} style={buttonStyle.secondary}>
                  {recalling ? "Working…" : "Append"}
                </button>
                <button type="button" disabled={!recallTemplateId || recalling} onClick={() => handleRecallChecklist("overwrite")} style={buttonStyle.primary}>
                  {recalling ? "Working…" : "Overwrite"}
                </button>
              </>
            ) : (
              <button type="button" disabled={!recallTemplateId || recalling} onClick={() => handleRecallChecklist("append")} style={buttonStyle.primary}>
                {recalling ? "Working…" : "Apply"}
              </button>
            )}
          </div>
        </Modal>
      )}

      {viewPhotosSubtaskId && (() => {
        const subtask = subtasks.find((s) => s.id === viewPhotosSubtaskId);
        const itemPhotos = photos.filter((p) => p.job_subtask_id === viewPhotosSubtaskId);
        return (
          <Modal title={subtask?.label || "Photos"} onClose={() => setViewPhotosSubtaskId(null)}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {itemPhotos.map((p) => (
                <PhotoThumb key={p.id} path={p.storage_path} size={100} />
              ))}
            </div>
          </Modal>
        );
      })()}

      {reopenTargetStatusId && (
        <Modal title="Reopen job" onClose={() => setReopenTargetStatusId(null)}>
          <p style={{ fontSize: "14px", color: colors.inkSoft, marginTop: 0 }}>
            This job is {job.job_status?.name}. Say what was found so it's on record — this is required.
          </p>
          <label style={modalLabelStyle}>Comment</label>
          <textarea
            autoFocus
            value={reopenComment}
            onChange={(e) => setReopenComment(e.target.value)}
            rows={3}
            style={{ ...selectStyle, resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setReopenTargetStatusId(null)} style={buttonStyle.secondary}>Cancel</button>
            <button type="button" onClick={confirmReopen} style={buttonStyle.primary}>Reopen</button>
          </div>
        </Modal>
      )}

    </div>
  );
}

const selectStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 14px",
  borderRadius: "10px",
  border: `1px solid ${colors.lineStrong}`,
  fontFamily: fonts.body,
  marginBottom: "14px",
};

const modalLabelStyle = {
  display: "block",
  fontSize: "13px",
  fontWeight: 600,
  color: colors.inkSoft,
  marginBottom: "6px",
};

const checklistIconStyle = {
  background: "transparent",
  border: `1px solid ${colors.lineStrong}`,
  borderRadius: "6px",
  width: "28px",
  height: "28px",
  cursor: "pointer",
  color: colors.inkSoft,
  fontSize: "13px",
};


function Section({ title, children }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ ...cardStyle, padding: isMobile ? "18px 10px" : "18px", marginBottom: "16px" }}>
      <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, marginTop: 0 }}>{title}</h2>
      {children}
    </div>
  );
}

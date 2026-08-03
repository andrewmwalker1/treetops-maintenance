import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { supabase } from "../lib/supabaseClient.js";
import { capturePhoto } from "../platform/camera.js";
import { loadJobForPrint } from "../lib/loadJobForPrint.js";
import { writeJobCompletion } from "../lib/completeJob.js";
import SafetyDocumentLink from "../components/SafetyDocumentLink.jsx";
import PhotoThumb from "../components/PhotoThumb.jsx";
import PrintableJobCard from "../components/PrintableJobCard.jsx";
import PrintStyles from "../components/PrintStyles.jsx";
import { colors, fonts, cardStyle, buttonStyle, priorityBarStyle, statusPillStyle, priorityColor } from "../lib/theme.js";

const PRIORITIES = ["immediate", "high", "medium", "low"];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, org, activeSite, terminology } = useAuth();
  const permissions = usePermissions();
  // job_types insert/update is RLS-gated on can_manage_reference_data (see
  // 06-activity-types-and-safety-library.sql), separately from
  // can_edit_job_checklist -- require both so these buttons don't offer an
  // action that the server will then reject.
  const canManageTemplates = permissions.has("can_edit_job_checklist") && permissions.has("can_manage_reference_data");

  const [job, setJob] = useState(null);
  const [subtasks, setSubtasks] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [activity, setActivity] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [documentsByActivityType, setDocumentsByActivityType] = useState({});
  const [statuses, setStatuses] = useState([]);
  const [people, setPeople] = useState([]);
  const [groups, setGroups] = useState([]);
  const [comment, setComment] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeDate, setCompleteDate] = useState(today());
  const [completeComment, setCompleteComment] = useState("");
  const [reopenTargetStatusId, setReopenTargetStatusId] = useState(null);
  const [reopenComment, setReopenComment] = useState("");
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");

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
    supabase.from("profiles").select("id, display_name").eq("org_id", org.id).then(({ data }) => setPeople(data || []));
    supabase.from("groups").select("id, name").eq("org_id", org.id).then(({ data }) => setGroups(data || []));
  }, [org]);

  async function toggleSubtask(subtask) {
    const { error: err } = await supabase.from("job_subtasks").update({ is_checked: !subtask.is_checked }).eq("id", subtask.id);
    if (err) console.error(err);
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
    const { error: err } = await supabase.from("job_subtasks").insert({ job_id: job.id, label, sort_order: nextSortOrder });
    if (err) setError(err.message);
    else {
      setNewChecklistItem("");
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
      template_schema: subtasks.map((s) => s.label),
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
      .update({ template_schema: subtasks.map((s) => s.label) })
      .eq("id", job.job_type.id);
    if (err) setError(err.message);
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
      setError(null);
      setShowCompleteModal(true);
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

    const closerIsAssignee = job.assignee_profile_id === profile.id;
    if (job.job_type?.requires_completion_photo && photos.length === 0 && closerIsAssignee) {
      const proceed = window.confirm("No photo added — complete anyway?");
      if (!proceed) return;
    }

    const { error: err } = await writeJobCompletion({
      jobId: job.id,
      oldStatusId: job.status_id,
      completedStatusId: completedStatus.id,
      actorProfileId: profile.id,
      completedDate: completeDate,
      comment: completeComment,
    });
    if (err) {
      setError(err.message);
      return;
    }

    setShowCompleteModal(false);
    setCompleteDate(today());
    setCompleteComment("");
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

  async function handleReallocate(kind, newId) {
    const update = {
      assignee_profile_id: kind === "person" ? newId || null : null,
      assignee_group_id: kind === "group" ? newId || null : null,
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
      previous_value: { assignee_profile_id: job.assignee_profile_id, assignee_group_id: job.assignee_group_id },
      new_value: update,
    });
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

  if (!job) {
    return error ? <p style={{ color: colors.immediate }}>{error}</p> : <p style={{ color: colors.inkSoft }}>Loading…</p>;
  }

  return (
    <div style={{ maxWidth: "640px" }}>
      <PrintStyles />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <button onClick={() => navigate(-1)} style={buttonStyle.secondary}>← Back</button>
        <button type="button" onClick={() => window.print()} style={buttonStyle.secondary}>Print job card</button>
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
                border: "none",
                borderBottom: `1px solid ${colors.lineStrong}`,
                background: "transparent",
                padding: "0 0 2px",
                flex: 1,
                minWidth: 0,
              }}
            />
            <span style={statusPillStyle(job.job_status?.name)}>{job.job_status?.name}</span>
          </div>
          {job.due_date && <p style={{ fontFamily: fonts.mono, color: colors.inkSoft, fontSize: "13px" }}>Due {job.due_date}</p>}
          {job.completed_date && <p style={{ fontFamily: fonts.mono, color: colors.inkSoft, fontSize: "13px" }}>Completed {job.completed_date}</p>}

          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.inkSoft, marginTop: "14px" }}>Status</label>
          <select value={job.status_id} onChange={(e) => handleStatusChange(e.target.value)} style={selectStyle}>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.inkSoft, marginTop: "14px" }}>Priority</label>
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

          {permissions.has("can_reallocate_jobs") && (
            <>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.inkSoft, marginTop: "14px" }}>Reassign to</label>
              <select
                defaultValue={job.assignee_profile_id ? `person:${job.assignee_profile_id}` : job.assignee_group_id ? `group:${job.assignee_group_id}` : ""}
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
              </select>
            </>
          )}
          {!permissions.has("can_reallocate_jobs") && (job.assignee?.display_name || job.assignee_group?.name) && (
            <p style={{ fontSize: "14px", marginTop: "10px" }}>Assigned to {job.assignee?.display_name || job.assignee_group?.name}</p>
          )}
        </div>
      </div>

      {activityTypes.length > 0 && (
        <Section title="⚠ Safety">
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
          {subtasks.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 0" }}>
              <input type="checkbox" checked={s.is_checked} onChange={() => toggleSubtask(s)} />
              {permissions.has("can_edit_job_checklist") ? (
                <input
                  value={s.label}
                  onChange={(e) => editSubtaskLabelLocal(i, e.target.value)}
                  onBlur={() => persistSubtaskLabel(subtasks[i])}
                  style={{
                    flex: 1,
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
                <span style={{ flex: 1, textDecoration: s.is_checked ? "line-through" : "none", color: s.is_checked ? colors.inkSoft : colors.ink }}>{s.label}</span>
              )}
              {permissions.has("can_edit_job_checklist") && (
                <>
                  <button type="button" onClick={() => moveSubtask(i, -1)} disabled={i === 0} style={checklistIconStyle}>↑</button>
                  <button type="button" onClick={() => moveSubtask(i, 1)} disabled={i === subtasks.length - 1} style={checklistIconStyle}>↓</button>
                  <button type="button" onClick={() => removeSubtask(s.id)} style={{ ...checklistIconStyle, color: colors.immediate }}>✕</button>
                </>
              )}
            </div>
          ))}
          {permissions.has("can_edit_job_checklist") && (
            <form onSubmit={addSubtask} style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
              <input
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                placeholder="Add an item…"
                style={{ ...selectStyle, flex: 1, marginBottom: 0 }}
              />
              <button type="submit" style={buttonStyle.secondary}>Add</button>
            </form>
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
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
          {photos.map((p) => (
            <PhotoThumb key={p.id} path={p.storage_path} />
          ))}
        </div>
        <button onClick={handleAddPhoto} disabled={uploading} style={buttonStyle.secondary}>
          {uploading ? "Uploading…" : "Add photo"}
        </button>
      </Section>

      <Section title="Activity">
        <form onSubmit={handleAddComment} style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" style={{ ...selectStyle, flex: 1, marginBottom: 0 }} />
          <button type="submit" style={buttonStyle.primary}>Post</button>
        </form>
        {activity.map((a) => (
          <div key={a.id} style={{ padding: "8px 0", borderBottom: `1px solid ${colors.line}` }}>
            <div style={{ fontSize: "13px", color: colors.inkSoft }}>
              <strong style={{ color: colors.ink }}>{a.actor?.display_name}</strong> · {a.event_type} · {new Date(a.created_at).toLocaleString()}
            </div>
            {a.event_type === "comment" && <div>{a.new_value?.text}</div>}
          </div>
        ))}
      </Section>

      {!job.job_status?.is_completed && (
        <button type="button" onClick={() => setShowCompleteModal(true)} style={{ ...buttonStyle.primary, width: "100%" }}>
          ✓ Complete
        </button>
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

          <label style={modalLabelStyle}>Photos (optional)</label>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
            {photos.map((p) => (
              <PhotoThumb key={p.id} path={p.storage_path} />
            ))}
          </div>
          <button type="button" onClick={handleAddPhoto} disabled={uploading} style={{ ...buttonStyle.secondary, marginBottom: "16px" }}>
            {uploading ? "Uploading…" : "Add photo"}
          </button>

          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button type="button" onClick={() => setShowCompleteModal(false)} style={buttonStyle.secondary}>Cancel</button>
            <button type="button" onClick={confirmComplete} style={buttonStyle.primary}>Mark complete</button>
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

      <div className="print-sheet">
        <PrintableJobCard
          job={job}
          subtasks={subtasks}
          photos={photos}
          activity={activity}
          activityTypes={activityTypes}
          documentsByActivityType={documentsByActivityType}
          terminology={terminology}
        />
      </div>
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


function Modal({ title, onClose, children }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(49, 56, 45, 0.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "24px 16px",
        overflowY: "auto",
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div style={{ ...cardStyle, padding: "20px", width: "100%", maxWidth: "440px" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, margin: 0 }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", fontSize: "20px", color: colors.inkSoft, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ ...cardStyle, padding: "18px", marginBottom: "16px" }}>
      <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, marginTop: 0 }}>{title}</h2>
      {children}
    </div>
  );
}

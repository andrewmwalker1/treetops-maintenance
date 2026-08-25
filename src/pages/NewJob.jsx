import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { supabase } from "../lib/supabaseClient.js";
import { queueJob } from "../platform/syncQueue.js";
import { capturePhoto } from "../platform/camera.js";
import { notifyJobAssigned } from "../lib/jobAssignmentNotify.js";
import { getAssignableTargets } from "../lib/assignableTargets.js";
import ChecklistBuilder from "../components/ChecklistBuilder.jsx";
import Modal from "../components/Modal.jsx";
import { colors, fonts, cardStyle, buttonStyle } from "../lib/theme.js";

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 14px",
  borderRadius: "10px",
  border: `1px solid ${colors.lineStrong}`,
  fontFamily: fonts.body,
  fontSize: "15px",
  marginBottom: "14px",
};

const labelStyle = { display: "block", fontWeight: 600, marginBottom: "6px", fontSize: "13px", color: colors.inkSoft };

export default function NewJob() {
  const { profile, org, activeSite, terminology } = useAuth();
  const permissions = usePermissions();
  const navigate = useNavigate();
  const canEditChecklist = permissions.has("can_edit_job_checklist");
  const canRequirePhoto = permissions.has("can_require_job_photo");
  // Distinct from canRequirePhoto above -- that one is the whole-job "at
  // least one photo before completing" flag; this gates the per-checklist
  // -item camera toggle in ChecklistBuilder (see
  // 32-checklist-item-photo-requirement.sql for why they're separate).
  const canRequireChecklistItemPhoto = permissions.has("can_require_checklist_item_photo");
  // Same gating as JobDetail's identical buttons -- job_types insert/update
  // is RLS-gated on can_manage_reference_data separately from
  // can_edit_job_checklist, so require both or the server rejects it.
  const canManageTemplates = permissions.has("can_edit_job_checklist") && permissions.has("can_manage_reference_data");

  const [jobTypes, setJobTypes] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [people, setPeople] = useState([]);
  const [groups, setGroups] = useState([]);
  const [pitches, setPitches] = useState([]);
  const [areas, setAreas] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [defaultActivitiesByType, setDefaultActivitiesByType] = useState({}); // job_type_id -> [task_type_id]

  const [description, setDescription] = useState("");
  const [jobTypeId, setJobTypeId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeKind, setAssigneeKind] = useState("person"); // person | group
  const [assigneeId, setAssigneeId] = useState("");
  const [locationKind, setLocationKind] = useState("pitch"); // pitch | area | none
  const [locationId, setLocationId] = useState("");
  const [areaName, setAreaName] = useState("");
  const [activityTypeIds, setActivityTypeIds] = useState([]);
  const [checklistItems, setChecklistItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [queuedNotice, setQueuedNotice] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);
  const [photoError, setPhotoError] = useState(null);
  const [requiresPhoto, setRequiresPhoto] = useState(false);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);

  useEffect(() => {
    if (!org || !activeSite) return;
    supabase.from("job_types").select("id, name, template_schema").eq("org_id", org.id).then(({ data }) => setJobTypes(data || []));
    supabase.from("job_statuses").select("id, name, sort_order").eq("org_id", org.id).order("sort_order").then(({ data }) => setStatuses(data || []));
    getAssignableTargets(org.id, profile.role_id).then(({ people: p, groups: g, error: assignErr }) => {
      setPeople(p);
      setGroups(g);
      if (assignErr) setSubmitError(`Couldn't load people/groups to assign to: ${assignErr}`);
    });
    supabase.from("contractors").select("id, name").eq("org_id", org.id).order("name").then(({ data }) => setContractors(data || []));
    supabase.from("pitches").select("id, pitch_number_or_name").eq("site_id", activeSite.id).then(({ data }) => setPitches(data || []));
    supabase.from("areas").select("id, name").eq("site_id", activeSite.id).then(({ data }) => setAreas(data || []));
    supabase.from("task_types").select("id, name").eq("org_id", org.id).then(({ data }) => setActivityTypes(data || []));
    supabase.from("job_type_task_types").select("job_type_id, task_type_id").then(({ data }) => {
      const grouped = {};
      for (const link of data || []) {
        grouped[link.job_type_id] = [...(grouped[link.job_type_id] || []), link.task_type_id];
      }
      setDefaultActivitiesByType(grouped);
    });
  }, [org, activeSite]);

  function handleJobTypeChange(newJobTypeId) {
    setJobTypeId(newJobTypeId);
    const jobType = jobTypes.find((jt) => jt.id === newJobTypeId);
    // Don't clobber a description the user has already started typing.
    setDescription((current) => (current.trim() ? current : jobType?.name || ""));
    setChecklistItems(jobType?.template_schema || []);
    setActivityTypeIds(defaultActivitiesByType[newJobTypeId] || []);
  }

  function toggleActivityType(id) {
    setActivityTypeIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  async function handleSaveAsTemplate(e) {
    e.preventDefault();
    const name = newTemplateName.trim();
    if (!name) return;
    setSavingTemplate(true);
    const { error: err } = await supabase.from("job_types").insert({
      org_id: org.id,
      name,
      template_schema: checklistItems,
    });
    setSavingTemplate(false);
    if (err) {
      setSubmitError(err.message);
      return;
    }
    setShowSaveAsModal(false);
    setNewTemplateName("");
  }

  async function handleUpdateTemplate() {
    const jobType = jobTypes.find((jt) => jt.id === jobTypeId);
    if (!jobType) return;
    const proceed = window.confirm(
      `Update the "${jobType.name}" template's checklist to match what's shown here? This changes the default checklist for any new jobs created from this template from now on.`
    );
    if (!proceed) return;
    const { error: err } = await supabase.from("job_types").update({ template_schema: checklistItems }).eq("id", jobType.id);
    if (err) {
      setSubmitError(err.message);
      return;
    }
    setJobTypes((prev) => prev.map((jt) => (jt.id === jobType.id ? { ...jt, template_schema: checklistItems } : jt)));
  }

  async function handleAddPhoto() {
    setPhotoError(null);
    try {
      const file = await capturePhoto();
      setPhotoFile(file);
      setPhotoPreviewUrl(URL.createObjectURL(file));
    } catch (err) {
      if (err.message !== "Photo capture cancelled.") setPhotoError(err.message);
    }
  }

  function handleRemovePhoto() {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
  }

  async function uploadPhotoForJob(jobId) {
    const path = `${jobId}/${crypto.randomUUID()}-${photoFile.name}`;
    const { error: uploadError } = await supabase.storage.from("job-photos").upload(path, photoFile);
    if (uploadError) throw uploadError;
    const { error: insertError } = await supabase.from("job_photos").insert({
      job_id: jobId,
      storage_path: path,
      uploaded_by: profile.id,
    });
    if (insertError) throw insertError;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError(null);

    // job_statuses hasn't finished loading yet — submitting now would send
    // a request with no status_id (a required column) and fail. Rather
    // than let that happen silently, stop and ask the user to wait a
    // moment rather than mask it as a queued/offline save.
    if (statuses.length === 0) {
      setSubmitError("Still loading — please wait a moment and try again.");
      return;
    }
    const openStatus = statuses.find((s) => s.sort_order === Math.min(...statuses.map((x) => x.sort_order)));
    if (!openStatus) {
      setSubmitError("Couldn't determine the default status for a new job. Try again, or contact support.");
      return;
    }

    // Areas are free text (see areas table) -- resolve the typed name to an
    // existing area or create a new one, rather than requiring the user to
    // pick from a fixed list.
    let areaId = null;
    if (locationKind === "area" && areaName.trim()) {
      const trimmed = areaName.trim();
      const existing = areas.find((a) => a.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) {
        areaId = existing.id;
      } else if (!navigator.onLine) {
        setSubmitError("That's a new area and you're offline -- pick an existing one from the list, or try again once you're back online.");
        return;
      } else {
        const { data: newArea, error: areaError } = await supabase
          .from("areas")
          .insert({ site_id: activeSite.id, name: trimmed, created_by: profile.id })
          .select()
          .single();
        if (areaError) {
          setSubmitError("Failed to save the new area: " + areaError.message);
          return;
        }
        areaId = newArea.id;
        setAreas((prev) => [...prev, newArea]);
      }
    }

    setSubmitting(true);

    const jobData = {
      id: crypto.randomUUID(),
      org_id: org.id,
      site_id: activeSite.id,
      job_type_id: jobTypeId || null,
      description,
      priority,
      status_id: openStatus.id,
      due_date: dueDate || null,
      assignee_profile_id: assigneeKind === "person" && assigneeId ? assigneeId : null,
      assignee_group_id: assigneeKind === "group" && assigneeId ? assigneeId : null,
      assignee_contractor_id: assigneeKind === "contractor" && assigneeId ? assigneeId : null,
      pitch_id: locationKind === "pitch" && locationId ? locationId : null,
      area_id: areaId,
      created_by: profile.id,
      requires_photo: canRequirePhoto && requiresPhoto,
    };

    if (!navigator.onLine) {
      await queueJob(jobData);
      setQueuedNotice(true);
      navigate("/");
      setSubmitting(false);
      return;
    }

    try {
      // Plain insert with no RETURNING (no .select()) -- with RETURNING,
      // Postgres re-checks the jobs_select RLS policy (can_see_job, which
      // re-queries jobs by id) against the row being inserted in the same
      // statement, and that self-referencing lookup unreliably fails to
      // see the row within the same command, throwing a spurious
      // "violates row-level security policy" error even though the row is
      // written and fully visible to a subsequent query. Generating the id
      // client-side sidesteps this entirely -- no need to read it back.
      const { error } = await supabase.from("jobs").insert(jobData);
      if (error) throw error;

      // Best-effort follow-up writes — the job itself is already
      // created, so a failure here shouldn't block navigation.
      if (jobData.assignee_profile_id || jobData.assignee_group_id) {
        notifyJobAssigned({ job: jobData, actorProfileId: profile.id, actorDisplayName: profile.display_name }).catch((err) =>
          console.error("Failed to send job-assignment notification", err)
        );
      }
      if (photoFile) {
        try {
          await uploadPhotoForJob(jobData.id);
        } catch (photoErr) {
          console.error("Failed to attach photo to new job", photoErr);
        }
      }
      if (activityTypeIds.length > 0) {
        const { error: activityError } = await supabase
          .from("job_activity_types")
          .insert(activityTypeIds.map((task_type_id) => ({ job_id: jobData.id, task_type_id })));
        if (activityError) console.error("Failed to attach activity types to new job", activityError);
      }
      if (checklistItems.length > 0) {
        const { error: checklistError } = await supabase
          .from("job_subtasks")
          .insert(checklistItems.map((item, i) => ({ job_id: jobData.id, label: item.label, requires_photo: item.requiresPhoto, sort_order: i })));
        if (checklistError) console.error("Failed to attach checklist to new job", checklistError);
      }
      navigate("/");
    } catch (err) {
      // Only genuine network failures get queued for later sync — a real
      // rejection from the server (permission denied, bad data, etc.)
      // would just fail the same way on retry, so surface it instead of
      // hiding it behind a misleading "queued" message.
      if (err instanceof TypeError) {
        console.error("Network error creating job, queueing for later sync", err);
        await queueJob(jobData);
        setQueuedNotice(true);
        navigate("/");
      } else {
        console.error("Failed to create job", err);
        setSubmitError(err.message || "Failed to create job.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!org || !activeSite) return null;

  return (
    <div style={{ maxWidth: "520px" }}>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>New job</h1>
      <form onSubmit={handleSubmit} style={{ ...cardStyle, padding: "20px" }}>
        <label style={labelStyle}>Job template (optional)</label>
        <select value={jobTypeId} onChange={(e) => handleJobTypeChange(e.target.value)} style={fieldStyle}>
          <option value="">—</option>
          {jobTypes.map((jt) => (
            <option key={jt.id} value={jt.id}>{jt.name}</option>
          ))}
        </select>

        <label style={labelStyle}>Description</label>
        <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...fieldStyle, resize: "vertical" }} />

        <label style={labelStyle}>Activity types (optional)</label>
        <div style={{ ...fieldStyle, height: "auto", padding: "10px 14px" }}>
          {activityTypes.length === 0 && <span style={{ color: colors.inkSoft, fontSize: "14px" }}>None set up yet.</span>}
          {activityTypes.map((a) => (
            <label key={a.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "3px 0", fontSize: "14px" }}>
              <input type="checkbox" checked={activityTypeIds.includes(a.id)} onChange={() => toggleActivityType(a.id)} />
              {a.name}
            </label>
          ))}
        </div>

        <label style={labelStyle}>Checklist</label>
        <div style={{ ...cardStyle, padding: "12px 14px", marginBottom: "14px" }}>
          <ChecklistBuilder
            items={checklistItems}
            onChange={setChecklistItems}
            readOnly={!canEditChecklist}
            canRequirePhoto={canRequireChecklistItemPhoto}
          />
          {!canEditChecklist && checklistItems.length === 0 && (
            <p style={{ color: colors.inkSoft, fontSize: "13px", margin: 0 }}>Pick a job template above to attach its checklist.</p>
          )}
          {canManageTemplates && (
            <div style={{ display: "flex", gap: "8px", marginTop: "14px", flexWrap: "wrap" }}>
              <button type="button" onClick={() => setShowSaveAsModal(true)} style={buttonStyle.secondary}>
                Save as new template
              </button>
              {jobTypeId && (
                <button type="button" onClick={handleUpdateTemplate} style={buttonStyle.secondary}>
                  Update "{jobTypes.find((jt) => jt.id === jobTypeId)?.name}" template
                </button>
              )}
            </div>
          )}
        </div>

        <label style={labelStyle}>Priority</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} style={fieldStyle}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="immediate">Immediate</option>
        </select>

        <label style={labelStyle}>Due date (optional)</label>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={fieldStyle} />

        <label style={labelStyle}>Assign to</label>
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          <label><input type="radio" checked={assigneeKind === "person"} onChange={() => { setAssigneeKind("person"); setAssigneeId(""); }} /> Person</label>
          <label><input type="radio" checked={assigneeKind === "group"} onChange={() => { setAssigneeKind("group"); setAssigneeId(""); }} /> Group</label>
          <label><input type="radio" checked={assigneeKind === "contractor"} onChange={() => { setAssigneeKind("contractor"); setAssigneeId(""); }} /> Contractor</label>
        </div>
        <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={fieldStyle}>
          <option value="">Unassigned</option>
          {(assigneeKind === "person" ? people : assigneeKind === "group" ? groups : contractors).map((item) => (
            <option key={item.id} value={item.id}>{item.display_name || item.name}</option>
          ))}
        </select>

        <label style={labelStyle}>Location</label>
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          <label><input type="radio" checked={locationKind === "pitch"} onChange={() => { setLocationKind("pitch"); setLocationId(""); setAreaName(""); }} /> {terminology.pitch || "Pitch"}</label>
          <label><input type="radio" checked={locationKind === "area"} onChange={() => { setLocationKind("area"); setLocationId(""); setAreaName(""); }} /> {terminology.area || "Area"}</label>
          <label><input type="radio" checked={locationKind === "none"} onChange={() => { setLocationKind("none"); setLocationId(""); setAreaName(""); }} /> None</label>
        </div>
        {locationKind === "pitch" && (
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)} style={fieldStyle}>
            <option value="">—</option>
            {pitches.map((item) => (
              <option key={item.id} value={item.id}>{item.pitch_number_or_name}</option>
            ))}
          </select>
        )}
        {locationKind === "area" && (
          <>
            <input
              list="area-suggestions"
              value={areaName}
              onChange={(e) => setAreaName(e.target.value)}
              placeholder={`Type a ${(terminology.area || "area").toLowerCase()} name…`}
              style={fieldStyle}
            />
            <datalist id="area-suggestions">
              {areas.map((a) => (
                <option key={a.id} value={a.name} />
              ))}
            </datalist>
          </>
        )}

        {canRequirePhoto && (
          <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", fontSize: "14px" }}>
            <input type="checkbox" checked={requiresPhoto} onChange={(e) => setRequiresPhoto(e.target.checked)} />
            Require a photo before this job can be completed
          </label>
        )}

        <label style={labelStyle}>Photo (optional)</label>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
          {photoPreviewUrl && (
            <img src={photoPreviewUrl} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }} />
          )}
          <button type="button" onClick={photoFile ? handleRemovePhoto : handleAddPhoto} style={buttonStyle.secondary}>
            {photoFile ? "Remove photo" : "Add photo"}
          </button>
        </div>
        {photoError && <p style={{ color: colors.immediate, fontSize: "13px" }}>{photoError}</p>}

        {queuedNotice && (
          <p style={{ color: colors.gold }}>
            You're offline — this job will save once you're back online.
            {photoFile && " The photo wasn't queued — add it from the job's detail screen after it syncs."}
          </p>
        )}

        {submitError && <p style={{ color: colors.immediate, fontSize: "13px" }}>{submitError}</p>}

        <button type="submit" disabled={submitting} style={{ ...buttonStyle.primary, width: "100%" }}>
          {submitting ? "Saving…" : "Create job"}
        </button>
      </form>

      {showSaveAsModal && (
        <Modal title="Save as new template" onClose={() => setShowSaveAsModal(false)}>
          <form onSubmit={handleSaveAsTemplate}>
            <label style={labelStyle}>Template name</label>
            <input
              autoFocus
              required
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              style={fieldStyle}
            />
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setShowSaveAsModal(false)} style={buttonStyle.secondary}>Cancel</button>
              <button type="submit" disabled={savingTemplate} style={buttonStyle.primary}>{savingTemplate ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

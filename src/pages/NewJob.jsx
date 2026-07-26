import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { queueJob } from "../platform/syncQueue.js";
import { capturePhoto } from "../platform/camera.js";
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
  const navigate = useNavigate();

  const [jobTypes, setJobTypes] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [people, setPeople] = useState([]);
  const [groups, setGroups] = useState([]);
  const [pitches, setPitches] = useState([]);
  const [areas, setAreas] = useState([]);

  const [description, setDescription] = useState("");
  const [jobTypeId, setJobTypeId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [assigneeKind, setAssigneeKind] = useState("person"); // person | group
  const [assigneeId, setAssigneeId] = useState("");
  const [locationKind, setLocationKind] = useState("pitch"); // pitch | area | none
  const [locationId, setLocationId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [queuedNotice, setQueuedNotice] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);
  const [photoError, setPhotoError] = useState(null);

  useEffect(() => {
    if (!org || !activeSite) return;
    supabase.from("job_types").select("id, name").eq("org_id", org.id).then(({ data }) => setJobTypes(data || []));
    supabase.from("job_statuses").select("id, name, sort_order").eq("org_id", org.id).order("sort_order").then(({ data }) => setStatuses(data || []));
    supabase.from("profiles").select("id, display_name").eq("org_id", org.id).then(({ data }) => setPeople(data || []));
    supabase.from("groups").select("id, name").eq("org_id", org.id).then(({ data }) => setGroups(data || []));
    supabase.from("pitches").select("id, pitch_number_or_name").eq("site_id", activeSite.id).then(({ data }) => setPitches(data || []));
    supabase.from("areas").select("id, name").eq("site_id", activeSite.id).then(({ data }) => setAreas(data || []));
  }, [org, activeSite]);

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
    setSubmitting(true);

    const openStatus = statuses.find((s) => s.sort_order === Math.min(...statuses.map((x) => x.sort_order)));

    const jobData = {
      org_id: org.id,
      site_id: activeSite.id,
      job_type_id: jobTypeId || null,
      description,
      priority,
      status_id: openStatus?.id,
      due_date: dueDate || null,
      assignee_profile_id: assigneeKind === "person" && assigneeId ? assigneeId : null,
      assignee_group_id: assigneeKind === "group" && assigneeId ? assigneeId : null,
      pitch_id: locationKind === "pitch" && locationId ? locationId : null,
      area_id: locationKind === "area" && locationId ? locationId : null,
      created_by: profile.id,
    };

    try {
      if (navigator.onLine) {
        const { data: newJob, error } = await supabase.from("jobs").insert(jobData).select().single();
        if (error) throw error;
        if (photoFile) {
          try {
            await uploadPhotoForJob(newJob.id);
          } catch (photoErr) {
            // The job itself was created successfully — a failed photo
            // upload shouldn't block that or stop navigation.
            console.error("Failed to attach photo to new job", photoErr);
          }
        }
      } else {
        await queueJob(jobData);
        setQueuedNotice(true);
      }
      navigate("/");
    } catch (err) {
      console.error("Failed to create job, queueing for later sync", err);
      await queueJob(jobData);
      setQueuedNotice(true);
      navigate("/");
    } finally {
      setSubmitting(false);
    }
  }

  if (!org || !activeSite) return null;

  return (
    <div style={{ maxWidth: "520px" }}>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>New job</h1>
      <form onSubmit={handleSubmit} style={{ ...cardStyle, padding: "20px" }}>
        <label style={labelStyle}>Description</label>
        <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...fieldStyle, resize: "vertical" }} />

        <label style={labelStyle}>Job type (optional)</label>
        <select value={jobTypeId} onChange={(e) => setJobTypeId(e.target.value)} style={fieldStyle}>
          <option value="">—</option>
          {jobTypes.map((jt) => (
            <option key={jt.id} value={jt.id}>{jt.name}</option>
          ))}
        </select>

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
        </div>
        <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={fieldStyle}>
          <option value="">Unassigned</option>
          {(assigneeKind === "person" ? people : groups).map((item) => (
            <option key={item.id} value={item.id}>{item.display_name || item.name}</option>
          ))}
        </select>

        <label style={labelStyle}>Location</label>
        <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
          <label><input type="radio" checked={locationKind === "pitch"} onChange={() => { setLocationKind("pitch"); setLocationId(""); }} /> {terminology.pitch || "Pitch"}</label>
          <label><input type="radio" checked={locationKind === "area"} onChange={() => { setLocationKind("area"); setLocationId(""); }} /> {terminology.area || "Area"}</label>
          <label><input type="radio" checked={locationKind === "none"} onChange={() => { setLocationKind("none"); setLocationId(""); }} /> None</label>
        </div>
        {locationKind !== "none" && (
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)} style={fieldStyle}>
            <option value="">—</option>
            {(locationKind === "pitch" ? pitches : areas).map((item) => (
              <option key={item.id} value={item.id}>{item.pitch_number_or_name || item.name}</option>
            ))}
          </select>
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

        <button type="submit" disabled={submitting} style={{ ...buttonStyle.primary, width: "100%" }}>
          {submitting ? "Saving…" : "Create job"}
        </button>
      </form>
    </div>
  );
}

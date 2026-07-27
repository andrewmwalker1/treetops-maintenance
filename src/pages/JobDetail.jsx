import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { supabase } from "../lib/supabaseClient.js";
import { capturePhoto } from "../platform/camera.js";
import SafetyDocumentLink from "../components/SafetyDocumentLink.jsx";
import { colors, fonts, cardStyle, buttonStyle, priorityBarStyle, statusPillStyle } from "../lib/theme.js";

const JOB_SELECT = `
  id, description, priority, due_date, status_id, assignee_profile_id, assignee_group_id, closed_by, org_id, site_id,
  job_status:job_statuses(id, name, is_completed),
  job_type:job_types(id, name, requires_completion_photo),
  assignee:profiles!jobs_assignee_profile_id_fkey(id, display_name),
  assignee_group:groups(id, name)
`;

export default function JobDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, org, activeSite } = useAuth();
  const permissions = usePermissions();

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

  const loadAll = useCallback(async () => {
    const { data: jobRow, error: jobError } = await supabase.from("jobs").select(JOB_SELECT).eq("id", id).single();
    if (jobError) {
      setError(jobError.message);
      return;
    }
    setJob(jobRow);

    const [{ data: subtaskRows }, { data: photoRows }, { data: activityRows }, { data: activityTypeLinks }] = await Promise.all([
      supabase.from("job_subtasks").select("id, label, is_checked, sort_order").eq("job_id", id).order("sort_order"),
      supabase.from("job_photos").select("id, storage_path, uploaded_at").eq("job_id", id).order("uploaded_at"),
      supabase
        .from("job_activity")
        .select("id, event_type, previous_value, new_value, created_at, actor:profiles(display_name)")
        .eq("job_id", id)
        .order("created_at", { ascending: false }),
      supabase.from("job_activity_types").select("task_type:task_types(id, name)").eq("job_id", id),
    ]);
    setSubtasks(subtaskRows || []);
    setPhotos(photoRows || []);
    setActivity(activityRows || []);

    const types = (activityTypeLinks || []).map((l) => l.task_type).filter(Boolean);
    setActivityTypes(types);

    if (types.length > 0) {
      const { data: docLinks } = await supabase
        .from("activity_type_documents")
        .select("task_type_id, document:ra_ms_documents(id, type, title, description, pdf_storage_path)")
        .in("task_type_id", types.map((t) => t.id));
      const grouped = {};
      for (const link of docLinks || []) {
        grouped[link.task_type_id] = [...(grouped[link.task_type_id] || []), link.document];
      }
      setDocumentsByActivityType(grouped);
    } else {
      setDocumentsByActivityType({});
    }
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

  async function handleStatusChange(newStatusId) {
    const newStatus = statuses.find((s) => s.id === newStatusId);
    const closingNow = newStatus?.is_completed && !job.job_status?.is_completed;

    // The confirm dialog only applies when the person closing the job is
    // the assignee — completing on someone else's behalf skips it
    // entirely (Section 5).
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

  if (error) return <p style={{ color: colors.immediate }}>{error}</p>;
  if (!job) return <p style={{ color: colors.inkSoft }}>Loading…</p>;

  return (
    <div style={{ maxWidth: "640px" }}>
      <button onClick={() => navigate(-1)} style={{ ...buttonStyle.secondary, marginBottom: "16px" }}>
        ← Back
      </button>

      <div style={{ ...cardStyle, padding: "20px", display: "flex", gap: "14px", marginBottom: "20px" }}>
        <div style={priorityBarStyle(job.priority)} />
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
            <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, margin: 0, fontSize: "22px" }}>{job.description}</h1>
            <span style={statusPillStyle(job.job_status?.name)}>{job.job_status?.name}</span>
          </div>
          {job.due_date && <p style={{ fontFamily: fonts.mono, color: colors.inkSoft, fontSize: "13px" }}>Due {job.due_date}</p>}

          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.inkSoft, marginTop: "14px" }}>Status</label>
          <select value={job.status_id} onChange={(e) => handleStatusChange(e.target.value)} style={selectStyle}>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
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
              <label style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                <input type="checkbox" checked={s.is_checked} onChange={() => toggleSubtask(s)} />
                <span style={{ textDecoration: s.is_checked ? "line-through" : "none", color: s.is_checked ? colors.inkSoft : colors.ink }}>{s.label}</span>
              </label>
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
  return (
    <div style={{ ...cardStyle, padding: "18px", marginBottom: "16px" }}>
      <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, marginTop: 0 }}>{title}</h2>
      {children}
    </div>
  );
}

function PhotoThumb({ path }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from("job-photos")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled && data) setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!url) return <div style={{ width: 80, height: 80, background: colors.line, borderRadius: 8 }} />;
  return <img src={url} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8 }} />;
}

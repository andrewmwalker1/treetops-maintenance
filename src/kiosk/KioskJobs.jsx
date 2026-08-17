import { useEffect, useState, useCallback, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { supabase } from "../lib/supabaseClient.js";
import { queryJobs } from "../lib/jobsQuery.js";
import { writeJobCompletion } from "../lib/completeJob.js";
import { loadJobForPrint } from "../lib/loadJobForPrint.js";
import { capturePhoto } from "../platform/camera.js";
import SafetyDocumentLink from "../components/SafetyDocumentLink.jsx";
import PhotoThumb from "../components/PhotoThumb.jsx";
import { colors, fonts, statusColor, statusPillStyle, priorityBarStyle } from "../lib/theme.js";
import { kioskButtonStyle, kioskSecondaryButtonStyle, kioskCardStyle } from "./kioskTheme.js";

function today() {
  return new Date().toISOString().slice(0, 10);
}

// The status pill carries its name as text, which needs room -- once a
// job's description already wraps onto a second line, keeping the pill
// forces the row taller still. Swapping to a plain colour-coded dot once
// wrapped keeps rows compact without losing the status at a glance
// (name available via the dot's title tooltip). Detected by rendered
// line count, not word/character count, so it tracks the real column
// width rather than an arbitrary guess.
function JobRow({ job, terminology = {}, onClick }) {
  const descRef = useRef(null);
  const [wrapped, setWrapped] = useState(false);

  useLayoutEffect(() => {
    const el = descRef.current;
    if (!el) return;
    setWrapped(el.getClientRects().length > 1);
  }, [job.description]);

  const location = job.pitch
    ? `${terminology.pitch || "Pitch"} ${job.pitch.pitch_number_or_name}`
    : job.area
    ? job.area.name
    : null;

  return (
    <button
      onClick={onClick}
      style={{
        ...kioskCardStyle,
        display: "flex",
        gap: "12px",
        width: "100%",
        textAlign: "left",
        marginBottom: "14px",
        cursor: "pointer",
        font: "inherit",
      }}
    >
      <div style={priorityBarStyle(job.priority)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", alignItems: "flex-start" }}>
          <span ref={descRef} style={{ fontWeight: 700, fontSize: "18px" }}>{job.description}</span>
          {wrapped ? (
            <span
              title={job.job_status?.name}
              style={{ width: "16px", height: "16px", borderRadius: "50%", flexShrink: 0, marginTop: "3px", background: statusColor[job.job_status?.name] || colors.inkSoft }}
            />
          ) : (
            <span style={statusPillStyle(job.job_status?.name)}>{job.job_status?.name}</span>
          )}
        </div>
        {(location || job.assignee || job.assignee_group || job.assignee_contractor || job.due_date) && (
          <div style={{ fontSize: "14px", color: colors.inkSoft, marginTop: "6px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {location && <span>{location}</span>}
            {job.assignee && <span>{job.assignee.display_name}</span>}
            {job.assignee_group && <span>{job.assignee_group.name}</span>}
            {job.assignee_contractor && <span>{job.assignee_contractor.name}</span>}
            {job.due_date && <span style={{ fontFamily: fonts.mono }}>Due {job.due_date}</span>}
          </div>
        )}
      </div>
    </button>
  );
}

function FilterChip({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `2px solid ${active ? colors.mossDark : colors.lineStrong}`,
        background: active ? colors.mossDark : "transparent",
        color: active ? "#FFFFFF" : colors.inkSoft,
        borderRadius: "999px",
        padding: "8px 16px",
        fontFamily: fonts.body,
        fontSize: "15px",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

export default function KioskJobs() {
  const navigate = useNavigate();
  const { profile, activeSite, terminology } = useAuth();
  const permissions = usePermissions();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [activeStatusId, setActiveStatusId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [subtasks, setSubtasks] = useState([]);
  const [activityTypes, setActivityTypes] = useState([]);
  const [documentsByActivityType, setDocumentsByActivityType] = useState({});
  const [completing, setCompleting] = useState(false);
  const [completeComment, setCompleteComment] = useState("");
  const [photos, setPhotos] = useState([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [loggingProgress, setLoggingProgress] = useState(false);
  const [progressLogged, setProgressLogged] = useState(false);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("job_statuses")
      .select("id, name, is_completed")
      .eq("org_id", profile.org_id)
      .then(({ data }) => setStatuses(data || []));
  }, [profile]);

  const refresh = useCallback(async () => {
    if (!activeSite) return;
    // job_statuses hasn't loaded yet, so there's no way to know which
    // statuses count as "open" -- wait rather than momentarily querying
    // with no status filter at all, which would show every job including
    // Completed until statuses arrives and this re-runs.
    if (!activeStatusId && statuses.length === 0) return;
    setLoading(true);
    // Same visibility as the main Jobs screen -- queryJobs is already
    // scoped by RLS (can_see_job: assignee, assignee's group, role
    // visibility, or can_see_all_jobs), so no extra client-side
    // narrowing here. Previously filtered down to direct assignee/group
    // membership only, which was narrower than what the same person
    // sees signed into the main app -- not what the kiosk is meant to be.
    //
    // Default view matches the main Jobs screen: open/in-progress only,
    // Completed reachable via the Filters chip row, not shown by default
    // (Andy: "should not show completed jobs, but should allow the
    // viewing of completed jobs when the filter button is pressed").
    const filters = {};
    if (activeStatusId) {
      filters.statusIds = [activeStatusId];
    } else if (statuses.length) {
      const openStatusIds = statuses.filter((s) => !s.is_completed).map((s) => s.id);
      if (openStatusIds.length) filters.statusIds = openStatusIds;
    }
    const allJobs = await queryJobs(activeSite.id, filters);
    setJobs(allJobs);
    setLoading(false);
  }, [activeSite, activeStatusId, statuses]);

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, [refresh]);

  async function openJob(job) {
    setError(null);
    setCompleteComment("");
    setProgressPercent(0);
    setProgressLogged(false);
    setPhotos([]);
    setSelectedJob(job);
    // The list row (queryJobs) doesn't select requires_photo -- reload via
    // loadJobForPrint (same source as the desktop detail screen) so the
    // hard per-job photo requirement (supabase/19-job-completion-photo-
    // requirement.sql) is known before the user tries to complete it.
    const { job: freshJob, subtasks: subtaskRows, activityTypes: types, documentsByActivityType: docs, photos: photoRows } = await loadJobForPrint(job.id);
    setSubtasks(subtaskRows);
    setActivityTypes(types);
    setDocumentsByActivityType(docs);
    setPhotos(photoRows);
    setSelectedJob((prev) => (prev && prev.id === freshJob.id ? { ...prev, ...freshJob } : prev));
  }

  async function handleAddPhoto() {
    setUploadingPhoto(true);
    setError(null);
    try {
      const file = await capturePhoto();
      const path = `${selectedJob.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("job-photos").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: photoRow, error: insertError } = await supabase
        .from("job_photos")
        .insert({ job_id: selectedJob.id, storage_path: path, uploaded_by: profile.id })
        .select("id, storage_path, uploaded_at")
        .single();
      if (insertError) throw insertError;
      setPhotos((prev) => [...prev, photoRow]);
    } catch (err) {
      if (err.message !== "Photo capture cancelled.") setError(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function toggleSubtask(subtask) {
    const { error: err } = await supabase.from("job_subtasks").update({ is_checked: !subtask.is_checked }).eq("id", subtask.id);
    if (err) {
      setError(err.message);
      return;
    }
    setSubtasks((prev) => prev.map((s) => (s.id === subtask.id ? { ...s, is_checked: !s.is_checked } : s)));
  }

  async function handleLogProgress() {
    setLoggingProgress(true);
    setError(null);
    const { error: err } = await supabase.from("job_activity").insert({
      job_id: selectedJob.id,
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
  }

  async function handleComplete() {
    const completedStatus = statuses.find((s) => s.name === "Completed");
    if (!completedStatus) {
      setError('No "Completed" status is configured for this site.');
      return;
    }
    if (selectedJob.requires_photo && photos.length === 0 && !permissions.has("can_complete_job_without_photo")) {
      setError("This job requires a photo before it can be completed. Add one below.");
      return;
    }
    setCompleting(true);
    const { error: err } = await writeJobCompletion({
      jobId: selectedJob.id,
      oldStatusId: selectedJob.job_status?.id,
      completedStatusId: completedStatus.id,
      actorProfileId: profile.id,
      completedDate: today(),
      comment: completeComment,
    });
    setCompleting(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSelectedJob(null);
    refresh();
  }

  if (selectedJob) {
    const isCompleted = selectedJob.job_status?.is_completed;
    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <button style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }} onClick={() => setSelectedJob(null)}>
          ← Back
        </button>

        <div style={{ ...kioskCardStyle, marginBottom: "20px" }}>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
            <div style={priorityBarStyle(selectedJob.priority)} />
            <div style={{ flex: 1 }}>
              <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "22px", margin: "0 0 8px" }}>
                {selectedJob.description}
              </h1>
              <span style={statusPillStyle(selectedJob.job_status?.name)}>{selectedJob.job_status?.name}</span>
              {selectedJob.due_date && (
                <p style={{ fontFamily: fonts.mono, color: colors.inkSoft, fontSize: "14px" }}>Due {selectedJob.due_date}</p>
              )}
            </div>
          </div>
        </div>

        {activityTypes.length > 0 && (
          <div style={{ ...kioskCardStyle, marginBottom: "20px", border: `2px solid ${colors.immediate}` }}>
            <h2 style={{ fontFamily: fonts.display, fontSize: "18px", color: colors.immediate, marginTop: 0 }}>⚠ Safety</h2>
            {activityTypes.map((t) => (
              <div key={t.id} style={{ marginBottom: "10px" }}>
                <div style={{ fontWeight: 700, fontSize: "16px" }}>{t.name}</div>
                {(documentsByActivityType[t.id] || []).length === 0 && (
                  <p style={{ color: colors.inkSoft, fontSize: "14px", margin: "2px 0" }}>No RA/MS documents linked yet.</p>
                )}
                {(documentsByActivityType[t.id] || []).map((doc) => (
                  <SafetyDocumentLink key={doc.id} doc={doc} />
                ))}
              </div>
            ))}
          </div>
        )}

        <div style={{ ...kioskCardStyle, marginBottom: "20px" }}>
          <h2 style={{ fontFamily: fonts.display, fontSize: "18px", color: colors.mossDark, marginTop: 0 }}>Checklist</h2>
          {subtasks.length === 0 && <p style={{ color: colors.inkSoft, fontSize: "16px" }}>No checklist items.</p>}
          {subtasks.map((s) => (
            <label key={s.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", fontSize: "16px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={s.is_checked}
                onChange={() => toggleSubtask(s)}
                style={{ width: "24px", height: "24px", flexShrink: 0 }}
              />
              <span style={{ textDecoration: s.is_checked ? "line-through" : "none", color: s.is_checked ? colors.inkSoft : colors.ink }}>
                {s.label}
              </span>
            </label>
          ))}
        </div>

        {error && <p style={{ color: colors.immediate }}>{error}</p>}

        {(photos.length > 0 || !isCompleted) && (
          <div style={{ ...kioskCardStyle, marginBottom: "20px" }}>
            <h2 style={{ fontFamily: fonts.display, fontSize: "18px", color: colors.mossDark, marginTop: 0 }}>Photos</h2>
            {selectedJob.requires_photo && photos.length === 0 && (
              <p style={{ color: colors.immediate, fontSize: "14px", marginTop: 0 }}>Photo required before this job can be completed.</p>
            )}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
              {photos.map((p) => (
                <PhotoThumb key={p.id} path={p.storage_path} size={72} />
              ))}
            </div>
            {!isCompleted && (
              <button type="button" style={kioskSecondaryButtonStyle} onClick={handleAddPhoto} disabled={uploadingPhoto}>
                {uploadingPhoto ? "Uploading…" : "Add photo"}
              </button>
            )}
          </div>
        )}

        {!isCompleted && (
          <div style={{ ...kioskCardStyle, marginBottom: "20px" }}>
            <h2 style={{ fontFamily: fonts.display, fontSize: "18px", color: colors.mossDark, marginTop: 0 }}>Progress update</h2>
            <p style={{ fontSize: "36px", fontWeight: 700, color: colors.mossDark, textAlign: "center", margin: "0 0 8px" }}>
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
              style={{ width: "100%", height: "32px" }}
            />
            <button
              type="button"
              style={{ ...kioskSecondaryButtonStyle, width: "100%", marginTop: "12px" }}
              onClick={handleLogProgress}
              disabled={loggingProgress}
            >
              {loggingProgress ? "Logging…" : progressLogged ? "Logged ✓" : "Log update"}
            </button>
          </div>
        )}

        {!isCompleted && (
          <>
            <label style={{ display: "block", fontSize: "16px", fontWeight: 600, color: colors.inkSoft, marginBottom: "8px" }}>
              Comment (optional)
            </label>
            <textarea
              value={completeComment}
              onChange={(e) => setCompleteComment(e.target.value)}
              rows={3}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "14px",
                borderRadius: "12px",
                border: `1px solid ${colors.lineStrong}`,
                fontFamily: fonts.body,
                fontSize: "16px",
                marginBottom: "20px",
              }}
            />
            <button style={kioskButtonStyle} onClick={handleComplete} disabled={completing}>
              {completing ? "Completing…" : "Mark job complete"}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
        <button style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px" }} onClick={() => navigate("/kiosk")}>
          ← Menu
        </button>
        <button style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px" }} onClick={() => setShowFilters((v) => !v)}>
          Filters{activeStatusId ? " •" : ""}
        </button>
      </div>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>Your jobs</h1>

      {showFilters && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
          <FilterChip active={activeStatusId === null} onClick={() => setActiveStatusId(null)} label="Open" />
          {statuses.map((s) => (
            <FilterChip key={s.id} active={activeStatusId === s.id} onClick={() => setActiveStatusId(s.id)} label={s.name} />
          ))}
        </div>
      )}

      {loading && <p style={{ color: colors.inkSoft }}>Loading…</p>}
      {error && <p style={{ color: colors.immediate }}>{error}</p>}
      {!loading && jobs.length === 0 && <p style={{ color: colors.inkSoft }}>No jobs to show.</p>}

      {jobs.map((job) => (
        <JobRow key={job.id} job={job} terminology={terminology} onClick={() => openJob(job)} />
      ))}
    </div>
  );
}

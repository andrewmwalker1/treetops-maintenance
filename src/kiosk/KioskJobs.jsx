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
import { Alert, Button, Card, Chip, EmptyState, Field, IconArrowLeft, IconFilter, PageHeader, SkeletonList, Textarea } from "../ui/index.js";

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
    <Card
      as="button"
      type="button"
      interactive
      pad="lg"
      onClick={onClick}
      style={{
        display: "flex",
        gap: "var(--space-3)",
        width: "100%",
        textAlign: "left",
        marginBottom: "var(--space-4)",
        font: "inherit",
        color: "inherit",
      }}
    >
      <div style={priorityBarStyle(job.priority)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)", alignItems: "flex-start" }}>
          <span ref={descRef} style={{ fontWeight: 700, fontSize: "var(--text-md)" }}>{job.description}</span>
          {wrapped ? (
            <span
              title={job.job_status?.name}
              style={{ width: "16px", height: "16px", borderRadius: "50%", flexShrink: 0, marginTop: "var(--space-1)", background: statusColor[job.job_status?.name] || colors.inkSoft }}
            />
          ) : (
            <span style={statusPillStyle(job.job_status?.name)}>{job.job_status?.name}</span>
          )}
        </div>
        {(location || job.assignee || job.assignee_group || job.assignee_contractor || job.due_date) && (
          <div style={{ fontSize: "var(--text-base)", color: colors.inkSoft, marginTop: "var(--space-2)", display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            {location && <span>{location}</span>}
            {job.assignee && <span>{job.assignee.display_name}</span>}
            {job.assignee_group && <span>{job.assignee_group.name}</span>}
            {job.assignee_contractor && <span>{job.assignee_contractor.name}</span>}
            {job.due_date && <span style={{ fontFamily: fonts.mono }}>Due {job.due_date}</span>}
          </div>
        )}
      </div>
    </Card>
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

  // Mirrors JobDetail.jsx's outstandingPhotoItems -- see
  // 33-checklist-photo-blocks-completion.sql for the server-side twin of
  // this check. The kiosk checklist has no camera-capture affordance
  // (§12.4/§17 of SYSTEMSPEC.md), so a photo-required item here can only
  // be cleared via can_check_off_item_without_photo; this just stops
  // "Mark job complete" from being pressed while one's still outstanding
  // rather than letting it hit the raw trigger error.
  const outstandingPhotoItems = subtasks.filter((s) => s.requires_photo && !s.is_checked);

  async function handleComplete() {
    const completedStatus = statuses.find((s) => s.name === "Completed");
    if (!completedStatus) {
      setError('No "Completed" status is configured for this site.');
      return;
    }
    if (outstandingPhotoItems.length > 0) {
      setError(`${outstandingPhotoItems.length} checklist item${outstandingPhotoItems.length === 1 ? "" : "s"} still need${outstandingPhotoItems.length === 1 ? "s" : ""} a photo before this job can be completed.`);
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
      <div style={{ padding: "var(--space-6)", maxWidth: "640px", margin: "0 auto" }}>
        <Button onClick={() => setSelectedJob(null)} icon={<IconArrowLeft size={16} />} style={{ marginBottom: "var(--space-5)" }}>
          Back
        </Button>

        <Card pad="lg" style={{ marginBottom: "var(--space-5)" }}>
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
            <div style={priorityBarStyle(selectedJob.priority)} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "var(--text-lg)", margin: "0 0 var(--space-2)" }}>
                {selectedJob.description}
              </h1>
              <span style={statusPillStyle(selectedJob.job_status?.name)}>{selectedJob.job_status?.name}</span>
              {selectedJob.due_date && (
                <p style={{ fontFamily: fonts.mono, color: colors.inkSoft, fontSize: "var(--text-base)" }}>Due {selectedJob.due_date}</p>
              )}
            </div>
          </div>
        </Card>

        {activityTypes.length > 0 && (
          <Alert tone="danger" title="Safety" style={{ marginBottom: "var(--space-5)" }}>
            {activityTypes.map((t) => (
              <div key={t.id} style={{ marginBottom: "var(--space-3)" }}>
                <div style={{ fontWeight: 700 }}>{t.name}</div>
                {(documentsByActivityType[t.id] || []).length === 0 && (
                  <p style={{ color: colors.inkSoft, fontSize: "var(--text-base)", margin: "var(--space-1) 0" }}>No RA/MS documents linked yet.</p>
                )}
                {(documentsByActivityType[t.id] || []).map((doc) => (
                  <SafetyDocumentLink key={doc.id} doc={doc} />
                ))}
              </div>
            ))}
          </Alert>
        )}

        <Card pad="lg" style={{ marginBottom: "var(--space-5)" }}>
          <PageHeader title="Checklist" level={2} />
          {subtasks.length === 0 && <p style={{ color: colors.inkSoft }}>No checklist items.</p>}
          {subtasks.map((s) => (
            <label key={s.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-3) 0", fontSize: "var(--text-md)", cursor: "pointer" }}>
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
        </Card>

        {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}

        {(photos.length > 0 || !isCompleted) && (
          <Card pad="lg" style={{ marginBottom: "var(--space-5)" }}>
            <PageHeader title="Photos" level={2} />
            {selectedJob.requires_photo && photos.length === 0 && (
              <Alert tone="warn">Photo required before this job can be completed.</Alert>
            )}
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-3)" }}>
              {photos.map((p) => (
                <PhotoThumb key={p.id} path={p.storage_path} size={72} />
              ))}
            </div>
            {!isCompleted && (
              <Button size="kiosk" onClick={handleAddPhoto} loading={uploadingPhoto}>
                {uploadingPhoto ? "Uploading…" : "Add photo"}
              </Button>
            )}
          </Card>
        )}

        {!isCompleted && (
          <Card pad="lg" style={{ marginBottom: "var(--space-5)" }}>
            <PageHeader title="Progress update" level={2} />
            <p style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: colors.mossDark, textAlign: "center", margin: "0 0 var(--space-2)" }}>
              {progressPercent}%
            </p>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={progressPercent}
              aria-label="Progress percentage"
              onChange={(e) => {
                setProgressPercent(Number(e.target.value));
                setProgressLogged(false);
              }}
              style={{ width: "100%", height: "32px" }}
            />
            <Button size="kiosk" loading={loggingProgress} onClick={handleLogProgress} style={{ marginTop: "var(--space-3)" }}>
              {loggingProgress ? "Logging…" : progressLogged ? "Logged ✓" : "Log update"}
            </Button>
          </Card>
        )}

        {!isCompleted && (
          <>
            <Field label="Comment (optional)" style={{ marginBottom: "var(--space-5)" }}>
              {({ id }) => (
                <Textarea
                  id={id}
                  value={completeComment}
                  onChange={(e) => setCompleteComment(e.target.value)}
                  rows={3}
                  className="tt-input--kiosk"
                />
              )}
            </Field>
            {outstandingPhotoItems.length > 0 && (
              <Alert tone="warn">
                {outstandingPhotoItems.length} checklist item{outstandingPhotoItems.length === 1 ? "" : "s"} still need
                {outstandingPhotoItems.length === 1 ? "s" : ""} a photo before this job can be completed.
              </Alert>
            )}
            <Button
              variant="primary"
              size="kiosk"
              onClick={handleComplete}
              loading={completing}
              disabled={outstandingPhotoItems.length > 0}
            >
              {completing ? "Completing…" : "Mark job complete"}
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--space-6)", maxWidth: "640px", margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--space-3)",
          marginBottom: "var(--space-5)",
        }}
      >
        <Button onClick={() => navigate("/kiosk")} icon={<IconArrowLeft size={16} />}>
          Menu
        </Button>
        <Button onClick={() => setShowFilters((v) => !v)} icon={<IconFilter size={16} />} aria-expanded={showFilters}>
          Filters{activeStatusId ? " •" : ""}
        </Button>
      </div>
      <PageHeader title="Your jobs" />

      {showFilters && (
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
          <Chip active={activeStatusId === null} onClick={() => setActiveStatusId(null)}>
            Open
          </Chip>
          {statuses.map((s) => (
            <Chip key={s.id} active={activeStatusId === s.id} onClick={() => setActiveStatusId(s.id)}>
              {s.name}
            </Chip>
          ))}
        </div>
      )}

      {loading && <SkeletonList rows={4} height={96} />}
      {error && (
        <Alert tone="danger" title="Something went wrong">
          {error}
        </Alert>
      )}
      {!loading && jobs.length === 0 && (
        <EmptyState
          title="No jobs to show"
          action={
            activeStatusId ? (
              <Button
                variant="primary"
                onClick={() => {
                  setActiveStatusId(null);
                  setShowFilters(false);
                }}
              >
                Clear filter
              </Button>
            ) : null
          }
        >
          {activeStatusId ? "Nothing matches that filter." : "Nothing is outstanding for you right now."}
        </EmptyState>
      )}

      {jobs.map((job) => (
        <JobRow key={job.id} job={job} terminology={terminology} onClick={() => openJob(job)} />
      ))}
    </div>
  );
}

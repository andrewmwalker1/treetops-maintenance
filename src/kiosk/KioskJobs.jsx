import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { queryJobs } from "../lib/jobsQuery.js";
import { writeJobCompletion } from "../lib/completeJob.js";
import { colors, fonts, statusPillStyle, priorityBarStyle } from "../lib/theme.js";
import { kioskButtonStyle, kioskSecondaryButtonStyle, kioskCardStyle } from "./kioskTheme.js";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function KioskJobs() {
  const navigate = useNavigate();
  const { profile, activeSite } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statuses, setStatuses] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [subtasks, setSubtasks] = useState([]);
  const [completing, setCompleting] = useState(false);
  const [completeComment, setCompleteComment] = useState("");
  const [progressPercent, setProgressPercent] = useState(50);
  const [loggingProgress, setLoggingProgress] = useState(false);
  const [progressLogged, setProgressLogged] = useState(false);

  const refresh = useCallback(async () => {
    if (!activeSite || !profile) return;
    setLoading(true);
    // Same visibility as the main Jobs screen -- queryJobs is already
    // scoped by RLS (can_see_job: assignee, assignee's group, role
    // visibility, or can_see_all_jobs), so no extra client-side
    // narrowing here. Previously filtered down to direct assignee/group
    // membership only, which was narrower than what the same person
    // sees signed into the main app -- not what the kiosk is meant to be.
    const [allJobs, { data: statusRows }] = await Promise.all([
      queryJobs(activeSite.id, {}),
      supabase.from("job_statuses").select("id, name, is_completed").eq("org_id", profile.org_id),
    ]);
    setJobs(allJobs);
    setStatuses(statusRows || []);
    setLoading(false);
  }, [activeSite, profile]);

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, [refresh]);

  async function openJob(job) {
    setError(null);
    setCompleteComment("");
    setProgressPercent(50);
    setProgressLogged(false);
    setSelectedJob(job);
    const { data } = await supabase
      .from("job_subtasks")
      .select("id, label, is_checked, sort_order")
      .eq("job_id", job.id)
      .order("sort_order");
    setSubtasks(data || []);
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
      <button style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }} onClick={() => navigate("/kiosk")}>
        ← Menu
      </button>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>Your jobs</h1>

      {loading && <p style={{ color: colors.inkSoft }}>Loading…</p>}
      {error && <p style={{ color: colors.immediate }}>{error}</p>}
      {!loading && jobs.length === 0 && <p style={{ color: colors.inkSoft }}>No jobs assigned to you or your groups.</p>}

      {jobs.map((job) => (
        <button
          key={job.id}
          onClick={() => openJob(job)}
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
            <div style={{ display: "flex", justifyContent: "space-between", gap: "8px" }}>
              <span style={{ fontWeight: 700, fontSize: "18px" }}>{job.description}</span>
              <span style={statusPillStyle(job.job_status?.name)}>{job.job_status?.name}</span>
            </div>
            {job.due_date && <p style={{ fontFamily: fonts.mono, color: colors.inkSoft, fontSize: "14px", margin: "6px 0 0" }}>Due {job.due_date}</p>}
          </div>
        </button>
      ))}
    </div>
  );
}

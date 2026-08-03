import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { queryJobs, filterToAssigneeOrGroups } from "../lib/jobsQuery.js";
import { writeJobCompletion } from "../lib/completeJob.js";
import ChecklistBuilder from "../components/ChecklistBuilder.jsx";
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

  const refresh = useCallback(async () => {
    if (!activeSite || !profile) return;
    setLoading(true);
    const [{ data: groupRows }, allJobs, { data: statusRows }] = await Promise.all([
      supabase.from("group_members").select("group_id").eq("profile_id", profile.id),
      queryJobs(activeSite.id, {}),
      supabase.from("job_statuses").select("id, name, is_completed").eq("org_id", profile.org_id),
    ]);
    const groupIds = (groupRows || []).map((g) => g.group_id);
    setJobs(filterToAssigneeOrGroups(allJobs, profile.id, groupIds));
    setStatuses(statusRows || []);
    setLoading(false);
  }, [activeSite, profile]);

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, [refresh]);

  async function openJob(job) {
    setError(null);
    setCompleteComment("");
    setSelectedJob(job);
    const { data } = await supabase
      .from("job_subtasks")
      .select("id, label, is_checked, sort_order")
      .eq("job_id", job.id)
      .order("sort_order");
    setSubtasks(data || []);
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
          <ChecklistBuilder items={subtasks.map((s) => s.label)} onChange={() => {}} readOnly />
        </div>

        {error && <p style={{ color: colors.immediate }}>{error}</p>}

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

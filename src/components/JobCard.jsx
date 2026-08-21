import { Link } from "react-router-dom";
import { colors, fonts, cardStyle, priorityBarStyle, priorityColor, statusPillStyle } from "../lib/theme.js";

export default function JobCard({ job, terminology = {}, selectable = false, selected = false, onToggleSelect }) {
  const location = job.pitch
    ? `${terminology.pitch || "Pitch"} ${job.pitch.pitch_number_or_name}`
    : job.area
    ? job.area.name
    : null;

  // A settled job (completed/cancelled -- job_status.is_completed) never
  // counts as overdue regardless of its due_date; only open/in-progress work
  // still needs the flag. Confirmed with the overdue mockup, 2026-08-21.
  const isOverdue = Boolean(job.due_date) && !job.job_status?.is_completed && job.due_date < new Date().toISOString().slice(0, 10);

  return (
    <Link
      to={`/jobs/${job.id}`}
      style={{
        ...cardStyle,
        display: "flex",
        gap: "12px",
        padding: "14px 16px",
        marginBottom: "10px",
        textDecoration: "none",
        color: colors.ink,
        ...(isOverdue ? { borderTop: `3px solid ${priorityColor.immediate}` } : null),
      }}
    >
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onToggleSelect?.(job.id)}
          style={{ alignSelf: "center", width: "18px", height: "18px", flexShrink: 0, cursor: "pointer" }}
        />
      )}
      <div style={priorityBarStyle(job.priority)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
          <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{job.description}</div>
          <span style={statusPillStyle(job.job_status?.name)}>{job.job_status?.name}</span>
        </div>
        <div style={{ fontSize: "13px", color: colors.inkSoft, marginTop: "4px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {location && <span>{location}</span>}
          {job.assignee && <span>{job.assignee.display_name}</span>}
          {job.assignee_group && <span>{job.assignee_group.name}</span>}
          {job.assignee_contractor && <span>{job.assignee_contractor.name}</span>}
          {job.due_date && (
            <span style={{ fontFamily: fonts.mono, ...(isOverdue ? { color: priorityColor.immediate, fontWeight: 700 } : null) }}>
              {isOverdue ? "Overdue since " : "Due "}{job.due_date}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

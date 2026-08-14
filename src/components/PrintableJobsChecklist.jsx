// A compact, one-page-per-many-jobs report -- unlike PrintableJobCard
// (one full sheet per job, with photos/subtasks/activity), this mirrors
// the on-screen jobs list as a table with a blank tick-box per row, for
// managers doing a walk-round checklist rather than a per-job record.
export default function PrintableJobsChecklist({ jobs, terminology }) {
  return (
    <div style={{ padding: "24px", fontFamily: "'Work Sans', sans-serif", color: "#000", fontSize: "12px" }}>
      <img src="/logo.png" alt="Tree Tops Caravan Park" style={{ width: "60px", height: "53px", marginBottom: "6px" }} />
      <h1 style={{ fontFamily: "'Lora', serif", fontSize: "18px", margin: "0 0 4px" }}>Job checklist</h1>
      <p style={{ margin: "0 0 14px", color: "#444" }}>
        {jobs.length} job{jobs.length === 1 ? "" : "s"}
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={thStyle}></th>
            <th style={thStyle}>Job</th>
            <th style={thStyle}>{terminology?.pitch || "Pitch"} / {terminology?.area || "Area"}</th>
            <th style={thStyle}>Assigned to</th>
            <th style={thStyle}>Priority</th>
            <th style={thStyle}>Due</th>
            <th style={thStyle}>Status</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const location = job.pitch
              ? `${terminology?.pitch || "Pitch"} ${job.pitch.pitch_number_or_name}`
              : job.area
              ? job.area.name
              : "—";
            const assignee =
              job.assignee?.display_name || job.assignee_group?.name || job.assignee_contractor?.name || "Unassigned";
            return (
              <tr key={job.id} style={{ borderBottom: "1px solid #ccc" }}>
                <td style={tdStyle}>
                  <span style={{ display: "inline-block", width: "14px", height: "14px", border: "1px solid #000" }} />
                </td>
                <td style={tdStyle}>{job.description}</td>
                <td style={tdStyle}>{location}</td>
                <td style={tdStyle}>{assignee}</td>
                <td style={{ ...tdStyle, textTransform: "capitalize" }}>{job.priority}</td>
                <td style={tdStyle}>{job.due_date || "—"}</td>
                <td style={tdStyle}>{job.job_status?.name || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const thStyle = {
  textAlign: "left",
  padding: "6px 8px",
  borderBottom: "2px solid #000",
  fontSize: "10px",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const tdStyle = { padding: "8px", verticalAlign: "top" };

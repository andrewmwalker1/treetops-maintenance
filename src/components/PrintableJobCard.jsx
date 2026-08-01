import PhotoThumb from "./PhotoThumb.jsx";

// One printable job sheet. Used both for the single "Print job card" button
// on the job detail screen and for the bulk "Print selected" flow on the
// jobs list -- kept here as the one place this layout is defined so the two
// call sites can't drift apart.
export default function PrintableJobCard({ job, subtasks, photos, activity, activityTypes, documentsByActivityType, terminology }) {
  return (
    <div className="print-job-card" style={{ padding: "24px", fontFamily: "'Work Sans', sans-serif", color: "#000", fontSize: "13px" }}>
      <img src="/logo.png" alt="Tree Tops Caravan Park" style={{ width: "89px", height: "79px", marginBottom: "8px" }} />
      <h1 style={{ fontFamily: "'Lora', serif", fontSize: "20px", margin: "0 0 4px" }}>{job.description}</h1>
      <p style={{ margin: "0 0 12px", color: "#444" }}>Printed {new Date().toLocaleString()}</p>

      <table style={{ borderCollapse: "collapse" }}>
        <tbody>
          <PrintRow label="Job type" value={job.job_type?.name || "—"} />
          <PrintRow label="Status" value={job.job_status?.name || "—"} />
          <PrintRow label="Priority" value={job.priority.charAt(0).toUpperCase() + job.priority.slice(1)} />
          <PrintRow label="Due date" value={job.due_date || "—"} />
          <PrintRow label="Completed date" value={job.completed_date || "—"} />
          <PrintRow label="Assigned to" value={job.assignee?.display_name || job.assignee_group?.name || "Unassigned"} />
          <PrintRow label={terminology?.pitch || "Pitch"} value={job.pitch?.pitch_number_or_name || "—"} />
          <PrintRow label={terminology?.area || "Area"} value={job.area?.name || "—"} />
        </tbody>
      </table>

      {activityTypes.length > 0 && (
        <>
          <h2 style={printSectionHeading}>Safety</h2>
          <ul style={{ margin: 0, paddingLeft: "18px" }}>
            {activityTypes.map((t) => (
              <li key={t.id} style={{ marginBottom: "4px" }}>
                {t.name}
                {(documentsByActivityType[t.id] || []).length > 0 && (
                  <ul style={{ margin: "2px 0", paddingLeft: "18px" }}>
                    {documentsByActivityType[t.id].map((d) => (
                      <li key={d.id}>{d.title}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 style={printSectionHeading}>Checklist</h2>
      {subtasks.length === 0 ? (
        <p style={{ margin: 0 }}>No checklist items.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {subtasks.map((s) => (
            <li key={s.id} style={{ marginBottom: "4px" }}>
              <span
                style={{
                  display: "inline-block",
                  width: "13px",
                  height: "13px",
                  border: "1px solid #000",
                  marginRight: "8px",
                  textAlign: "center",
                  lineHeight: "13px",
                  fontSize: "10px",
                  verticalAlign: "middle",
                }}
              >
                {s.is_checked ? "X" : ""}
              </span>
              {s.label}
            </li>
          ))}
        </ul>
      )}

      <h2 style={printSectionHeading}>Photos</h2>
      {photos.length === 0 ? (
        <p style={{ margin: 0 }}>No photos attached.</p>
      ) : (
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {photos.map((p) => (
            <PhotoThumb key={p.id} path={p.storage_path} url={p.signedUrl} size={140} />
          ))}
        </div>
      )}

      <h2 style={printSectionHeading}>Activity</h2>
      {activity.length === 0 ? (
        <p style={{ margin: 0 }}>No activity recorded.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {activity
            .slice()
            .reverse()
            .map((a) => (
              <li key={a.id} style={{ marginBottom: "6px" }}>
                <strong>{a.actor?.display_name}</strong> · {a.event_type} · {new Date(a.created_at).toLocaleString()}
                {a.event_type === "comment" && <div>{a.new_value?.text}</div>}
              </li>
            ))}
        </ul>
      )}

      <h2 style={printSectionHeading}>Sign-off</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "6px" }}>
        <tbody>
          <tr>
            <SignOffField label="Signature" />
            <SignOffField label="Print name" />
          </tr>
          <tr>
            <SignOffField label="Date completed" />
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const printSectionHeading = { fontFamily: "'Lora', serif", fontSize: "15px", margin: "18px 0 6px", borderBottom: "1px solid #999", paddingBottom: "4px" };

function PrintRow({ label, value }) {
  return (
    <tr>
      <td style={{ padding: "4px 12px 4px 0", fontWeight: 600, verticalAlign: "top", whiteSpace: "nowrap" }}>{label}</td>
      <td style={{ padding: "4px 0" }}>{value}</td>
    </tr>
  );
}

function SignOffField({ label }) {
  return (
    <td style={{ width: "50%", padding: "22px 16px 6px 0", verticalAlign: "bottom" }}>
      <div style={{ borderBottom: "1px solid #000", height: "26px" }} />
      <div style={{ fontSize: "11px", color: "#444", marginTop: "2px" }}>{label}</div>
    </td>
  );
}
